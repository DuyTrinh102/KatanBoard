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
import { ErrorBoundary } from './ErrorBoundary';
import { deviceInfo, getErrors, onErrorsChange } from './diagnostics';
import { useSyncExternalStore } from 'react';
import { RemoteConnection } from '../remote/client';
import type { GameSummary, ServerMsg } from '../remote/protocol';
import { PhoneScreen } from '../remote/PhoneScreen';
import { TvScreen } from '../remote/TvScreen';

const store = new IndexedDbGameStore();

const DEFAULT_PLAYERS: Omit<PlayerConfig, 'seat'>[] = [
  { id: 'p1', name: 'Đỏ', color: '#c0392b', icon: 'shield' },
  { id: 'p2', name: 'Xanh', color: '#2471a3', icon: 'leaf' },
  { id: 'p3', name: 'Cam', color: '#d68910', icon: 'star' },
  { id: 'p4', name: 'Tím', color: '#7d3c98', icon: 'wave' },
];
const SEAT_LABEL: Record<SeatId, string> = { B: 'Cạnh dưới', T: 'Cạnh trên', L: 'Cạnh trái', R: 'Cạnh phải' };

type Screen = { kind: 'launcher' } | { kind: 'new' } | { kind: 'game'; session: GameSession; lock: TabLock };

/** Chế độ chơi: một bàn cảm ứng (offline) hoặc TV + điện thoại (cần máy chủ cục bộ). */
export type PlayMode = 'table' | 'tv';
const MODE_KEY = 'katanboard.mode';

function loadMode(): PlayMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'tv' ? 'tv' : 'table';
  } catch {
    return 'table';
  }
}

type Route = { kind: 'home' } | { kind: 'tv'; gameId: string } | { kind: 'play'; gameId: string; token: string };

function parseRoute(): Route {
  const m = /^\/(tv|play)\/([\w-]+)\/?$/.exec(location.pathname);
  if (m?.[1] === 'tv') return { kind: 'tv', gameId: m[2]! };
  if (m?.[1] === 'play') return { kind: 'play', gameId: m[2]!, token: new URLSearchParams(location.search).get('t') ?? '' };
  return { kind: 'home' };
}

function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Gửi một yêu cầu tới máy chủ và chờ một loại phản hồi (dùng ở launcher). */
function askServer<T extends ServerMsg['t']>(msg: Parameters<RemoteConnection['send']>[0], expect: T, timeoutMs = 4000): Promise<Extract<ServerMsg, { t: T }>> {
  return new Promise((resolve, reject) => {
    const conn = new RemoteConnection();
    const timer = setTimeout(() => {
      conn.close();
      reject(new Error('Không kết nối được máy chủ cục bộ. Hãy chạy "npm run server" (hoặc "npm run dev:server" khi phát triển).'));
    }, timeoutMs);
    conn.onMessage((m) => {
      if (m.t === expect || m.t === 'error') {
        clearTimeout(timer);
        conn.close();
        if (m.t === 'error') reject(new Error(m.message));
        else resolve(m as Extract<ServerMsg, { t: T }>);
      }
    });
    conn.send(msg);
  });
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  if (route.kind === 'tv')
    return (
      <>
        <ErrorBoundary onReset={() => navigate('/')}>
          <TvScreen gameId={route.gameId} onExit={() => navigate('/')} />
        </ErrorBoundary>
        <ErrorStrip />
      </>
    );
  if (route.kind === 'play')
    return (
      <>
        <ErrorBoundary onReset={() => location.reload()}>
          <PhoneScreen gameId={route.gameId} token={route.token} />
        </ErrorBoundary>
        <ErrorStrip />
      </>
    );
  return <Home />;
}

function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: 'launcher' });
  const [mode, setModeState] = useState<PlayMode>(loadMode);
  const [tvGames, setTvGames] = useState<GameSummary[] | null>(null);
  const setMode = (m: PlayMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* bỏ qua: chế độ chỉ là tiện ích ghi nhớ */
    }
  };
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

  useEffect(() => {
    if (mode !== 'tv') return;
    setTvGames(null);
    askServer({ t: 'list' }, 'games')
      .then((m) => setTvGames([...m.games]))
      .catch((e: Error) => setError(e.message));
  }, [mode]);

  const startTv = async (players: PlayerConfig[]) => {
    try {
      const m = await askServer({ t: 'create', players: players.map(({ seat: _seat, ...p }) => p) }, 'created');
      navigate(`/tv/${m.gameId}`);
    } catch (e) {
      setError((e as Error).message);
      setScreen({ kind: 'launcher' });
    }
  };

  const start = async (players: PlayerConfig[], openTable: boolean) => {
    if (mode === 'tv') return startTv(players);
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

  if (screen.kind === 'game')
    return (
      <>
        <ErrorBoundary onReset={exit}>
          <GameScreen session={screen.session} onExit={exit} />
        </ErrorBoundary>
        <ErrorStrip />
      </>
    );
  if (screen.kind === 'new') return <NewGame mode={mode} onCancel={() => setScreen({ kind: 'launcher' })} onStart={(p, o) => void start(p, o)} />;

  return (
    <div className="launcher">
      <h1>Coffee Boardgame Digital</h1>
      <div className="game-card mode-switch" role="radiogroup" aria-label="Chế độ chơi">
        <h2>Chế độ chơi</h2>
        <div className="mode-options">
          <button type="button" role="radio" aria-checked={mode === 'table'} data-testid="mode-table" className={`mode-opt ${mode === 'table' ? 'on' : ''}`} onClick={() => setMode('table')}>
            <b>🀄 Bàn cảm ứng</b>
            <span>Một màn hình nằm ngang giữa bàn, mọi người chạm trực tiếp. Chạy offline, không cần máy chủ. Bài riêng chỉ là thỏa thuận tại bàn.</span>
          </button>
          <button type="button" role="radio" aria-checked={mode === 'tv'} data-testid="mode-tv" className={`mode-opt ${mode === 'tv' ? 'on' : ''}`} onClick={() => setMode('tv')}>
            <b>📺 TV + điện thoại</b>
            <span>TV hiển thị bản đồ chung. Mỗi người quét mã QR, xem bài riêng và thao tác trên điện thoại; cập nhật tức thì lên TV. Cần máy chủ cục bộ cùng mạng Wi-Fi.</span>
          </button>
        </div>
      </div>
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
      {mode === 'tv' && tvGames && tvGames.length > 0 && (
        <div className="game-card">
          <h2>Ván TV trên máy chủ</h2>
          {tvGames.map((g) => (
            <div key={g.gameId} className="row">
              <span>
                {g.players.join(', ')} · lượt lưu #{g.revision} · {new Date(g.savedAt).toLocaleString('vi-VN')} · {g.phase}
              </span>
              <button type="button" className="btn" data-testid={`tv-resume-${g.gameId}`} onClick={() => navigate(`/tv/${g.gameId}`)}>
                Mở trên TV
              </button>
            </div>
          ))}
        </div>
      )}
      {mode === 'table' && saves.length > 0 && (
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
      {mode === 'table' && <ImportBox onImported={(id) => void refresh().then(() => open(id))} />}
      <DeviceInfoBox />
      <ErrorStrip />
    </div>
  );
}

/** Dải lỗi nổi — chỉ hiện khi có lỗi JS, để chụp màn hình gửi hỗ trợ. */
function ErrorStrip() {
  const list = useSyncExternalStore(onErrorsChange, getErrors);
  const [hidden, setHidden] = useState(false);
  if (list.length === 0 || hidden) return null;
  return (
    <div className="error-strip" role="alert" data-testid="error-strip">
      <b>Lỗi kỹ thuật (chụp màn hình gửi hỗ trợ):</b>
      {list.map((e, i) => (
        <div key={i}>{e}</div>
      ))}
      <button type="button" className="btn" onClick={() => setHidden(true)}>Ẩn</button>
    </div>
  );
}

function DeviceInfoBox() {
  const [open, setOpen] = useState(false);
  return (
    <div className="game-card">
      <button type="button" className="btn" data-testid="device-info" onClick={() => setOpen(!open)}>
        {open ? 'Ẩn thông tin thiết bị' : 'Thông tin thiết bị (hỗ trợ kỹ thuật)'}
      </button>
      {open && (
        <table className="diag">
          <tbody>
            {deviceInfo().map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
            <tr>
              <td>Phiên bản app</td>
              <td>{__APP_VERSION__}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewGame({ mode, onStart, onCancel }: { mode: PlayMode; onStart: (players: PlayerConfig[], openTable: boolean) => void; onCancel: () => void }) {
  const [count, setCount] = useState<3 | 4>(4);
  const [names, setNames] = useState(DEFAULT_PLAYERS.map((p) => p.name));
  const [seats, setSeats] = useState<SeatId[]>(['B', 'T', 'R', 'L']);
  const [openTable, setOpenTable] = useState(false);
  const used = seats.slice(0, count);
  const dupSeat = mode === 'table' && new Set(used).size !== used.length;

  return (
    <div className="launcher">
      <h1>Tạo ván CATAN + Cities & Knights {mode === 'tv' ? '· TV + điện thoại' : '· Bàn cảm ứng'}</h1>
      <div className="game-card">
        <div className="row">
          Số người:
          {([3, 4] as const).map((n) => (
            <button key={n} type="button" className={`chip ${count === n ? 'on' : ''}`} data-testid={`count-${n}`} onClick={() => setCount(n)}>
              {n} người
            </button>
          ))}
        </div>
        <p className="muted">
          {mode === 'tv' ? 'Thứ tự lượt theo danh sách dưới đây. Sau khi tạo, TV hiện mã QR cho từng người.' : 'Ghế (vị trí ngồi) độc lập với thứ tự lượt. Thứ tự lượt theo danh sách dưới đây.'}
        </p>
        {DEFAULT_PLAYERS.slice(0, count).map((p, i) => (
          <div key={p.id} className="row">
            <span style={{ color: p.color }}>{ICON_GLYPH[p.icon]}</span>
            <input value={names[i]} onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))} aria-label={`Tên người chơi ${i + 1}`} />
            {mode === 'table' && SEAT_IDS.map((s) => (
              <button key={s} type="button" className={`chip ${seats[i] === s ? 'on' : ''}`} onClick={() => setSeats(seats.map((x, j) => (j === i ? s : x)))}>
                {SEAT_LABEL[s]}
              </button>
            ))}
          </div>
        ))}
        {dupSeat && <div className="banner error">Hai người không thể cùng một ghế.</div>}
        {mode === 'table' && (
        <label className="check">
          <input type="checkbox" checked={openTable} onChange={(e) => setOpenTable(e.target.checked)} />
          Chơi mở (Open Table) — công khai bài riêng để dễ học. Đây là điều chỉnh trải nghiệm, làm thay đổi chiến thuật; không đổi được giữa ván.
        </label>
        )}
        {mode === 'table' ? (
          <p className="warn">
            Lưu ý: bài "riêng" trên màn hình chung chỉ là thỏa thuận tại bàn — người ngồi cạnh vẫn có thể nhìn thấy. Khi một người xem bài, những người khác quay đi.
          </p>
        ) : (
          <p className="warn soft">Bài riêng chỉ gửi tới điện thoại của từng người; TV chỉ nhận thông tin công khai. Ai quét mã QR của ghế nào sẽ điều khiển ghế đó.</p>
        )}
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
