import { useEffect, useState } from 'react';
import { createGame, SEAT_IDS, type PlayerConfig, type SeatId } from '../games/catan-ck/engine';
import { DEV_RULESET_ID } from '../games/catan-ck/rules';
import { GameSession } from '../games/catan-ck/session';
import { GameScreen } from '../games/catan-ck/ui/GameScreen';
import { ICON_GLYPH } from '../games/catan-ck/ui/format';
import { parseSaveJson } from '../persistence/saveFile';
import { IndexedDbGameStore } from '../persistence/store';
import { acquireGameLock, type TabLock } from '../persistence/tabLock';
import { freshSeed } from '../shared/random';
import { GAMES } from './registry';

const store = new IndexedDbGameStore();

const DEFAULT_PLAYERS: Omit<PlayerConfig, 'seat'>[] = [
  { id: 'p1', name: 'Đỏ', color: '#c0392b', icon: 'shield' },
  { id: 'p2', name: 'Xanh', color: '#2471a3', icon: 'leaf' },
  { id: 'p3', name: 'Cam', color: '#d68910', icon: 'star' },
  { id: 'p4', name: 'Tím', color: '#7d3c98', icon: 'wave' },
];
const SEAT_LABEL: Record<SeatId, string> = { B: 'Cạnh dưới', T: 'Cạnh trên', L: 'Cạnh trái', R: 'Cạnh phải' };

type Screen = { kind: 'launcher' } | { kind: 'new' } | { kind: 'game'; session: GameSession; lock: TabLock };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'launcher' });
  const [saves, setSaves] = useState<{ gameId: string; revision: number; savedAt: string; phase: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => store.list().then(setSaves).catch((e: Error) => setError(`Không đọc được bộ nhớ: ${e.message}`));
  useEffect(() => {
    void refresh();
  }, []);

  const open = async (gameId: string) => {
    const loaded = await store.load(gameId);
    if (!loaded) return setError('Không tìm thấy ván');
    const lock = await acquireGameLock(gameId);
    setScreen({ kind: 'game', session: GameSession.fromSave(loaded.current, store, !lock.acquired), lock });
  };

  const start = async (players: PlayerConfig[], openTable: boolean) => {
    const gameId = `g-${Date.now().toString(36)}`;
    const initial = createGame(
      { rulesetId: DEV_RULESET_ID, rulesetMode: 'dev-unverified', players, turnOrder: players.map((p) => p.id), openTable },
      freshSeed(),
      gameId,
    );
    const lock = await acquireGameLock(gameId);
    const session = await GameSession.create(initial, store);
    setScreen({ kind: 'game', session, lock });
  };

  const exit = () => {
    if (screen.kind === 'game') screen.lock.release();
    setScreen({ kind: 'launcher' });
    void refresh();
  };

  if (screen.kind === 'game') return <GameScreen session={screen.session} onExit={exit} />;
  if (screen.kind === 'new') return <NewGame onCancel={() => setScreen({ kind: 'launcher' })} onStart={(p, o) => void start(p, o)} />;

  return (
    <div className="launcher">
      <h1>Coffee Boardgame Digital</h1>
      {GAMES.map((g) => (
        <div key={g.id} className="game-card">
          <h2>{g.title}</h2>
          <p className="muted">{g.subtitle} · {g.minPlayers}–{g.maxPlayers} người</p>
          <button type="button" className="btn primary big" data-testid="new-game" onClick={() => setScreen({ kind: 'new' })}>
            Ván mới
          </button>
        </div>
      ))}
      {error && <div className="banner error">{error}</div>}
      {saves.length > 0 && (
        <div className="game-card">
          <h2>Ván đã lưu</h2>
          {saves.map((s) => (
            <div key={s.gameId} className="row">
              <span>
                {s.gameId} · lượt lưu #{s.revision} · {new Date(s.savedAt).toLocaleString('vi-VN')} · {s.phase}
              </span>
              <button type="button" className="btn" data-testid={`resume-${s.gameId}`} onClick={() => void open(s.gameId)}>
                Tiếp tục
              </button>
            </div>
          ))}
        </div>
      )}
      <ImportBox onImported={(id) => void refresh().then(() => open(id))} />
    </div>
  );
}

function NewGame({ onStart, onCancel }: { onStart: (players: PlayerConfig[], openTable: boolean) => void; onCancel: () => void }) {
  const [count, setCount] = useState<3 | 4>(4);
  const [names, setNames] = useState(DEFAULT_PLAYERS.map((p) => p.name));
  const [seats, setSeats] = useState<SeatId[]>(['B', 'T', 'R', 'L']);
  const [openTable, setOpenTable] = useState(false);
  const used = seats.slice(0, count);
  const dupSeat = new Set(used).size !== used.length;

  return (
    <div className="launcher">
      <h1>Tạo ván CATAN + Cities & Knights</h1>
      <div className="game-card">
        <div className="row">
          Số người:
          {([3, 4] as const).map((n) => (
            <button key={n} type="button" className={`chip ${count === n ? 'on' : ''}`} data-testid={`count-${n}`} onClick={() => setCount(n)}>
              {n} người
            </button>
          ))}
        </div>
        <p className="muted">Ghế (vị trí ngồi) độc lập với thứ tự lượt. Thứ tự lượt theo danh sách dưới đây.</p>
        {DEFAULT_PLAYERS.slice(0, count).map((p, i) => (
          <div key={p.id} className="row">
            <span style={{ color: p.color }}>{ICON_GLYPH[p.icon]}</span>
            <input value={names[i]} onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))} aria-label={`Tên người chơi ${i + 1}`} />
            {SEAT_IDS.map((s) => (
              <button key={s} type="button" className={`chip ${seats[i] === s ? 'on' : ''}`} onClick={() => setSeats(seats.map((x, j) => (j === i ? s : x)))}>
                {SEAT_LABEL[s]}
              </button>
            ))}
          </div>
        ))}
        {dupSeat && <div className="banner error">Hai người không thể cùng một ghế.</div>}
        <label className="check">
          <input type="checkbox" checked={openTable} onChange={(e) => setOpenTable(e.target.checked)} />
          Chơi mở (Open Table) — công khai bài riêng để dễ học. Đây là điều chỉnh trải nghiệm, làm thay đổi chiến thuật; không đổi được giữa ván.
        </label>
        <p className="warn">
          Lưu ý: bài "riêng" trên màn hình chung chỉ là thỏa thuận tại bàn — người ngồi cạnh vẫn có thể nhìn thấy. Khi một người xem bài, những người khác quay đi.
        </p>
        <p className="warn">Dữ liệu luật hiện CHƯA được kiểm chứng với rulebook 2025; đây là bản phát triển.</p>
        <div className="row">
          <button type="button" className="btn" onClick={onCancel}>Quay lại</button>
          <button
            type="button"
            className="btn primary big"
            data-testid="start-game"
            aria-disabled={dupSeat}
            onClick={() =>
              !dupSeat &&
              onStart(
                DEFAULT_PLAYERS.slice(0, count).map((p, i) => ({ ...p, name: names[i]!.trim() || p.name, seat: seats[i]! })),
                openTable,
              )
            }
          >
            Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportBox({ onImported }: { onImported: (gameId: string) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof parseSaveJson> | null>(null);
  return (
    <div className="game-card">
      <h2>Nhập file cứu hộ (nhân viên)</h2>
      <input
        type="file"
        accept="application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = parseSaveJson(await f.text());
          setPending(r);
          setMsg(r.ok ? `File hợp lệ: ${r.save.gameId}, revision ${r.save.revision}. Xác nhận để ghi.` : r.error);
        }}
      />
      {msg && <p>{msg}</p>}
      {pending?.ok && (
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            const existing = await store.load(pending.save.gameId);
            if (existing && existing.current.revision > pending.save.revision) {
              setMsg('Ván đang lưu mới hơn file nhập — không ghi đè.');
              return;
            }
            await store.save(pending.save);
            setPending(null);
            onImported(pending.save.gameId);
          }}
        >
          Xác nhận nhập ván
        </button>
      )}
    </div>
  );
}
