import { describe, expect, it } from 'vitest';
import { GameHub, MemorySeatStore, type Conn } from '../../src/remote/hub';
import type { ServerMsg } from '../../src/remote/protocol';
import { MemoryGameStore } from '../../src/persistence/store';

const PLAYERS = [
  { id: 'p1', name: 'Đỏ', color: '#c0392b', icon: 'shield' },
  { id: 'p2', name: 'Xanh', color: '#2471a3', icon: 'leaf' },
  { id: 'p3', name: 'Cam', color: '#d68910', icon: 'star' },
];

function conn(): Conn & { inbox: ServerMsg[]; last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> } {
  const inbox: ServerMsg[] = [];
  return {
    role: 'lobby',
    inbox,
    send: (m) => inbox.push(JSON.parse(JSON.stringify(m))),
    last(t) {
      const m = [...inbox].reverse().find((x) => x.t === t);
      if (!m) throw new Error(`không có tin ${t}`);
      return m as never;
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup() {
  const store = new MemoryGameStore();
  const seats = new MemorySeatStore();
  const hub = new GameHub(store, seats, { newGameId: () => 'tv-test', lanHosts: () => ['192.168.1.20'] });
  const tv = conn();
  await hub.handle(tv, { t: 'create', players: PLAYERS });
  const gameId = tv.last('created').gameId;
  await hub.handle(tv, { t: 'hello-tv', gameId });
  const tokens = Object.fromEntries(tv.last('tv-state').seats.map((s) => [s.playerId, s.token]));
  return { hub, store, seats, tv, gameId, tokens };
}

describe('GameHub (chế độ TV + điện thoại)', () => {
  it('tạo ván, TV nhận view công khai + mã ghế; điện thoại vào đúng ghế bằng token', async () => {
    const { hub, tv, gameId, tokens } = await setup();
    const tvState = tv.last('tv-state');
    expect(tvState.seats.map((s) => s.connected)).toEqual([false, false, false]);
    expect(tvState.lanHosts).toEqual(['192.168.1.20']);
    const phone = conn();
    await hub.handle(phone, { t: 'hello-player', gameId, token: tokens.p2! });
    const ps = phone.last('player-state');
    expect(ps.playerId).toBe('p2');
    expect(ps.priv.hand).toBeDefined();
    expect(tv.last('tv-state').seats.find((s) => s.playerId === 'p2')!.connected).toBe(true);
  });

  it('token sai bị từ chối; điện thoại không ra lệnh thay người khác; TV không ra lệnh được', async () => {
    const { hub, tv, gameId, tokens } = await setup();
    const bad = conn();
    await hub.handle(bad, { t: 'hello-player', gameId, token: 'xxx' });
    expect(bad.last('error').message).toMatch(/không hợp lệ/);
    // p2 cố đặt quân khi đang là lượt p1
    const p2 = conn();
    await hub.handle(p2, { t: 'hello-player', gameId, token: tokens.p2! });
    const v = p2.last('player-state').actions.find((a) => a.type === 'placeSetupBuilding')!;
    expect(v.enabled).toBe(false);
    await hub.handle(p2, { t: 'cmd', commandId: 'c1', expectedRevision: 0, body: { type: 'placeSetupBuilding', vertex: 'v:0,0|0,1|1,0' as never } });
    expect(p2.last('ack')).toMatchObject({ ok: false, reason: 'Không phải lượt của bạn' });
    await hub.handle(tv, { t: 'cmd', commandId: 'c2', expectedRevision: 0, body: { type: 'rollDice' } });
    expect(tv.last('ack').ok).toBe(false);
  });

  it('thao tác trên điện thoại cập nhật realtime lên TV và các điện thoại khác', async () => {
    const { hub, tv, gameId, tokens } = await setup();
    const p1 = conn();
    const p3 = conn();
    await hub.handle(p1, { t: 'hello-player', gameId, token: tokens.p1! });
    await hub.handle(p3, { t: 'hello-player', gameId, token: tokens.p3! });
    const target = p1.last('player-state').actions.find((a) => a.type === 'placeSetupBuilding')!.targets![0]!;
    await hub.handle(p1, { t: 'cmd', commandId: 'c1', expectedRevision: 0, body: { type: 'placeSetupBuilding', vertex: target as never } });
    await flush();
    expect(p1.last('ack').ok).toBe(true);
    expect(tv.last('tv-state').view.buildings[target as never]).toEqual({ owner: 'p1', kind: 'settlement' });
    expect(p3.last('player-state').view.revision).toBe(1);
  });

  it('TV không bao giờ nhận tay bài, lựa chọn riêng hay rng', async () => {
    const { hub, tv, gameId, tokens } = await setup();
    // Chơi hết setup để có tài nguyên (city vòng 2 cho tài nguyên).
    const phones: Record<string, ReturnType<typeof conn>> = {};
    for (const p of ['p1', 'p2', 'p3']) {
      phones[p] = conn();
      await hub.handle(phones[p]!, { t: 'hello-player', gameId, token: tokens[p]! });
    }
    for (let i = 0; i < 12; i++) {
      const view = tv.last('tv-state').view;
      const ph = phones[view.activePlayerId]!;
      const st = ph.last('player-state');
      const kind = view.setup!.step === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad';
      const t = st.actions.find((a) => a.type === kind)!.targets![0]!;
      const body = kind === 'placeSetupBuilding' ? { type: kind, vertex: t as never } : { type: kind, edge: t as never };
      await hub.handle(ph, { t: 'cmd', commandId: `s${i}`, expectedRevision: view.revision, body } as never);
      await flush();
    }
    expect(tv.last('tv-state').view.phase).toBe('PRE_ROLL');
    const tvJson = JSON.stringify(tv.inbox.filter((m) => m.t === 'tv-state'));
    expect(tvJson).not.toContain('"hand"');
    expect(tvJson).not.toContain('"rng"');
    expect(tvJson).not.toContain('"secretLog"');
    // Mỗi điện thoại chỉ nhận tay của chính mình.
    const p2msgs = phones.p2!.inbox.filter((m) => m.t === 'player-state');
    expect(p2msgs.every((m) => m.t === 'player-state' && m.priv.playerId === 'p2')).toBe(true);
  });

  it('expectedRevision cũ → STALE; resend cùng commandId sau mất kết nối không làm 2 lần', async () => {
    const { hub, gameId, tokens } = await setup();
    const p1 = conn();
    await hub.handle(p1, { t: 'hello-player', gameId, token: tokens.p1! });
    const targets = p1.last('player-state').actions.find((a) => a.type === 'placeSetupBuilding')!.targets!;
    const body = { type: 'placeSetupBuilding' as const, vertex: targets[0] as never };
    await hub.handle(p1, { t: 'cmd', commandId: 'same', expectedRevision: 0, body });
    // Mất kết nối, điện thoại kết nối lại và gửi lại đúng lệnh cũ
    hub.disconnect(p1);
    const again = conn();
    await hub.handle(again, { t: 'hello-player', gameId, token: tokens.p1! });
    await hub.handle(again, { t: 'cmd', commandId: 'same', expectedRevision: 0, body });
    expect(again.last('ack').ok).toBe(true);
    expect(again.last('player-state').view.revision).toBe(1);
    await hub.handle(again, { t: 'cmd', commandId: 'other', expectedRevision: 0, body: { type: 'placeSetupRoad', edge: 'e:x' as never } });
    expect(again.last('ack').reason).toMatch(/Bàn đã thay đổi/);
  });

  it('khởi động lại máy chủ: nạp lại ván và ghế từ store', async () => {
    const { store, seats, gameId, tokens } = await setup();
    const hub2 = new GameHub(store, seats);
    const tv = conn();
    await hub2.handle(tv, { t: 'list' });
    expect(tv.last('games').games.map((g) => g.gameId)).toContain(gameId);
    const p1 = conn();
    await hub2.handle(p1, { t: 'hello-player', gameId, token: tokens.p1! });
    expect(p1.last('player-state').playerId).toBe('p1');
  });
});
