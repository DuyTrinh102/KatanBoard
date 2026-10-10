/**
 * GameHub — lõi máy chủ chế độ TV + điện thoại, không phụ thuộc transport (test được không cần mạng).
 * - Chạy engine qua GameSession (hàng đợi tuần tự, lưu bền trước khi phát).
 * - Phân quyền theo token ghế: điện thoại chỉ ra lệnh cho đúng người chơi của token đó.
 * - Phát view theo vai trò: TV nhận PublicGameView; điện thoại nhận thêm PrivateGameView của chính mình.
 */
import { createGame, type PlayerConfig, type SeatId } from '../games/catan-ck/engine';
import { getActionsView, getBankRatios, getPrivateView, getPublicView } from '../games/catan-ck/projections/views';
import { DEV_RULESET_ID } from '../games/catan-ck/rules';
import { GameSession } from '../games/catan-ck/session';
import type { GameStore } from '../persistence/store';
import type { ClientMsg, GameSummary, SeatStatus, ServerMsg } from './protocol';

export interface Conn {
  send(msg: ServerMsg): void;
  role: 'lobby' | 'tv' | 'player';
  gameId?: string;
  playerId?: string;
}

/** Lưu token ghế (tách khỏi save ván để file cứu hộ không chứa quyền vào ghế). */
export interface SeatStore {
  save(gameId: string, seats: Record<string, string>): Promise<void>;
  load(gameId: string): Promise<Record<string, string> | null>;
}

export class MemorySeatStore implements SeatStore {
  private m = new Map<string, Record<string, string>>();
  async save(gameId: string, seats: Record<string, string>) {
    this.m.set(gameId, { ...seats });
  }
  async load(gameId: string) {
    return this.m.get(gameId) ?? null;
  }
}

interface LiveGame {
  readonly session: GameSession;
  readonly seats: Record<string, string>;
  readonly conns: Set<Conn>;
}

const SEAT_ORDER: readonly SeatId[] = ['B', 'T', 'R', 'L'];

function randomToken(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function randomSeed(): number {
  const b = new Uint32Array(1);
  globalThis.crypto.getRandomValues(b);
  return b[0]!;
}

export interface HubOptions {
  readonly lanHosts?: () => string[];
  readonly newGameId?: () => string;
}

export class GameHub {
  private games = new Map<string, LiveGame>();
  private loading = new Map<string, Promise<LiveGame | null>>();

  constructor(
    private readonly store: GameStore,
    private readonly seatStore: SeatStore,
    private readonly opts: HubOptions = {},
  ) {}

  async handle(conn: Conn, msg: ClientMsg): Promise<void> {
    try {
      switch (msg.t) {
        case 'list':
          conn.send({ t: 'games', games: await this.list() });
          return;
        case 'create': {
          const gameId = await this.create(msg.players);
          conn.send({ t: 'created', gameId });
          return;
        }
        case 'hello-tv': {
          const g = await this.get(msg.gameId);
          if (!g) return conn.send({ t: 'error', message: 'Không tìm thấy ván' });
          this.detach(conn);
          conn.role = 'tv';
          conn.gameId = msg.gameId;
          delete conn.playerId;
          g.conns.add(conn);
          this.broadcast(msg.gameId);
          return;
        }
        case 'hello-player': {
          const g = await this.get(msg.gameId);
          if (!g) return conn.send({ t: 'error', message: 'Không tìm thấy ván' });
          const playerId = Object.keys(g.seats).find((p) => g.seats[p] === msg.token);
          if (!playerId) return conn.send({ t: 'error', message: 'Mã ghế không hợp lệ — hãy quét lại mã QR trên TV' });
          this.detach(conn);
          conn.role = 'player';
          conn.gameId = msg.gameId;
          conn.playerId = playerId;
          g.conns.add(conn);
          this.broadcast(msg.gameId);
          return;
        }
        case 'cmd': {
          if (conn.role !== 'player' || !conn.gameId || !conn.playerId) {
            return conn.send({ t: 'ack', commandId: msg.commandId, ok: false, reason: 'Chỉ điện thoại của người chơi mới gửi được thao tác' });
          }
          const g = this.games.get(conn.gameId);
          if (!g) return conn.send({ t: 'ack', commandId: msg.commandId, ok: false, reason: 'Ván không còn hoạt động' });
          // actorId luôn lấy từ token đã xác thực, không tin dữ liệu client.
          const r = await g.session.dispatch(conn.playerId, msg.body, msg.commandId, msg.expectedRevision);
          if (r.ok) conn.send({ t: 'ack', commandId: msg.commandId, ok: true });
          else conn.send({ t: 'ack', commandId: msg.commandId, ok: false, reason: 'privateReason' in r && r.privateReason ? r.privateReason : r.publicReason });
          return;
        }
      }
    } catch (e) {
      conn.send({ t: 'error', message: `Lỗi máy chủ: ${(e as Error).message}` });
    }
  }

  disconnect(conn: Conn): void {
    const gameId = conn.gameId;
    this.detach(conn);
    if (gameId) this.broadcast(gameId);
  }

  private detach(conn: Conn): void {
    if (conn.gameId) this.games.get(conn.gameId)?.conns.delete(conn);
  }

  private async list(): Promise<GameSummary[]> {
    const rows = await this.store.list();
    const out: GameSummary[] = [];
    for (const r of rows) {
      if (!(await this.seatStore.load(r.gameId))) continue; // chỉ ván tạo ở chế độ TV
      const save = await this.store.load(r.gameId);
      out.push({ ...r, players: save?.current.state.meta.config.players.map((p) => p.name) ?? [] });
    }
    return out;
  }

  private async create(players: readonly Omit<PlayerConfig, 'seat'>[]): Promise<string> {
    const gameId = this.opts.newGameId?.() ?? `tv-${Date.now().toString(36)}-${randomToken().slice(0, 4)}`;
    const cfgPlayers = players.map((p, i) => ({ ...p, seat: SEAT_ORDER[i]! }));
    const initial = createGame(
      { rulesetId: DEV_RULESET_ID, rulesetMode: 'dev-unverified', players: cfgPlayers, turnOrder: cfgPlayers.map((p) => p.id), openTable: false },
      randomSeed(),
      gameId,
    );
    const seats = Object.fromEntries(cfgPlayers.map((p) => [p.id, randomToken()]));
    await this.seatStore.save(gameId, seats);
    const session = await GameSession.create(initial, this.store);
    this.attach(gameId, session, seats);
    return gameId;
  }

  private attach(gameId: string, session: GameSession, seats: Record<string, string>): LiveGame {
    const g: LiveGame = { session, seats, conns: new Set() };
    this.games.set(gameId, g);
    // Chỉ phát sau khi đã ghi bền (snapshot.saving = false) — điện thoại/TV không thấy state chưa lưu.
    session.subscribe((snap) => {
      if (!snap.saving) this.broadcast(gameId);
    });
    return g;
  }

  private async get(gameId: string): Promise<LiveGame | null> {
    const live = this.games.get(gameId);
    if (live) return live;
    let p = this.loading.get(gameId);
    if (!p) {
      p = (async () => {
        const [save, seats] = await Promise.all([this.store.load(gameId), this.seatStore.load(gameId)]);
        if (!save || !seats) return null;
        return this.attach(gameId, GameSession.fromSave(save.current, this.store), seats);
      })();
      this.loading.set(gameId, p);
    }
    try {
      return await p;
    } finally {
      this.loading.delete(gameId);
    }
  }

  private broadcast(gameId: string): void {
    const g = this.games.get(gameId);
    if (!g) return;
    const snap = g.session.snapshot();
    const state = snap.state;
    const view = getPublicView(state);
    const connected = new Set([...g.conns].filter((c) => c.role === 'player').map((c) => c.playerId));
    const seats: SeatStatus[] = state.meta.config.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      connected: connected.has(p.id),
      token: g.seats[p.id]!,
    }));
    for (const c of g.conns) {
      if (c.role === 'tv') {
        c.send({ t: 'tv-state', view, seats, lanHosts: this.opts.lanHosts?.() ?? [] });
      } else if (c.role === 'player' && c.playerId) {
        c.send({
          t: 'player-state',
          playerId: c.playerId,
          view,
          priv: getPrivateView(state, c.playerId),
          actions: getActionsView(state, c.playerId, true),
          bankRatios: getBankRatios(state, c.playerId),
        });
      }
    }
  }
}
