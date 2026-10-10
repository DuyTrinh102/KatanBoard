import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Board } from '../games/catan-ck/ui/Board';
import { CARD_BG, Die, EventDie, GlobalDefs, ResourceIcon } from '../games/catan-ck/ui/art';
import { EVENT_LABEL, formatLog, ICON_GLYPH, playerName } from '../games/catan-ck/ui/format';
import { CARD_LABEL } from '../games/catan-ck/engine/text';
import { CARD_TYPES } from '../games/catan-ck/rules';
import type { PublicGameView } from '../games/catan-ck/projections/views';
import { RemoteConnection, type ConnStatus } from './client';
import { joinUrl, type SeatStatus, type ServerMsg } from './protocol';

/** Địa chỉ để điện thoại mở: ưu tiên host TV đang dùng nếu đã là IP/tên LAN, ngược lại dùng IP LAN do máy chủ báo. */
function joinBase(lanHosts: readonly string[]): string {
  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const host = isLocal && lanHosts[0] ? lanHosts[0] : hostname;
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
}

function SeatQr({ seat, url }: { seat: SeatStatus; url: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="qr-card" style={{ borderColor: seat.color }} data-testid={`qr-${seat.playerId}`} data-url={url}>
      <div className="qr-name" style={{ background: seat.color }}>
        {ICON_GLYPH[seat.icon]} {seat.name}
      </div>
      {svg ? <img className="qr-img" alt={`Mã QR vào ghế ${seat.name}`} src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} /> : <div className="qr-img" />}
      <div className="qr-state">{seat.connected ? '✔ Đã kết nối' : 'Quét để vào ghế'}</div>
    </div>
  );
}

function Sidebar({ view, seats }: { view: PublicGameView; seats: readonly SeatStatus[] }) {
  const roll = view.lastRoll;
  return (
    <aside className="tv-side">
      {!view.rulesetVerified && <div className="warn">⚠ Dữ liệu luật chưa kiểm chứng (bản phát triển)</div>}
      <div className="box">
        <div className="box-title">Người chơi (thắng ở {view.victoryTarget}*)</div>
        <table className="scores tv-scores">
          <tbody>
            {view.players.map((p) => {
              const seat = seats.find((s) => s.playerId === p.id);
              return (
                <tr key={p.id} className={view.activePlayerId === p.id ? 'active' : ''} data-testid={`tv-player-${p.id}`}>
                  <td>
                    <span className={`dot ${seat?.connected ? 'on' : ''}`} title={seat?.connected ? 'Đã kết nối' : 'Chưa kết nối'} />
                    <b style={{ color: p.color }}>
                      {ICON_GLYPH[p.icon]} {p.name}
                    </b>
                  </td>
                  <td className="big">★ {p.score.total}</td>
                  <td>đường {p.roadLength}{view.longestRoad === p.id ? ' 🏆' : ''}</td>
                  <td>🂠 {p.handCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="box">
        <div className="box-title">Xúc xắc</div>
        {roll ? (
          <div className="dice" data-testid="tv-dice">
            <Die value={roll.red} color="red" />
            <Die value={roll.yellow} color="yellow" />
            <EventDie face={roll.event} />
            <span className="sum">= {roll.red + roll.yellow}</span>
            <div className="event">{EVENT_LABEL[roll.event]}</div>
          </div>
        ) : (
          <div className="muted">Chưa tung</div>
        )}
      </div>
      <div className="box">
        <div className="box-title">Ngân hàng</div>
        <div className="bank">
          {CARD_TYPES.map((t) => (
            <span key={t} className="bank-stack" style={{ background: `linear-gradient(160deg, ${CARD_BG[t][0]}, ${CARD_BG[t][1]})` }} title={CARD_LABEL[t]}>
              <ResourceIcon type={t} size={24} />
              <b>{view.bank[t]}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="box log tv-log" data-testid="tv-log">
        <div className="box-title">Nhật ký</div>
        {view.log.slice(-8).map((e) => (
          <div key={e.seq} className="log-line">
            {formatLog(view, e)}
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Màn hình TV: chỉ hiển thị thông tin công khai; không có thao tác chơi. */
export function TvScreen({ gameId, onExit }: { gameId: string; onExit: () => void }) {
  const [state, setState] = useState<Extract<ServerMsg, { t: 'tv-state' }> | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);

  useEffect(() => {
    // Tạo kết nối trong effect (StrictMode chạy effect 2 lần: kết nối cũ đóng, kết nối mới mở).
    const conn = new RemoteConnection();
    const off1 = conn.onMessage((m) => {
      if (m.t === 'tv-state') setState(m);
      if (m.t === 'error') setError(m.message);
    });
    const off2 = conn.onStatus(setStatus);
    conn.send({ t: 'hello-tv', gameId });
    return () => {
      off1();
      off2();
      conn.close();
    };
  }, [gameId]);

  // Tự ẩn QR khi mọi ghế đã kết nối; tự hiện lại nếu có người rớt mạng.
  const allConnected = state?.seats.every((s) => s.connected) ?? false;
  useEffect(() => setShowQr(!allConnected), [allConnected]);

  if (error && !state) {
    return (
      <div className="launcher">
        <div className="game-card">
          <h2>Không mở được ván</h2>
          <p>{error}</p>
          <button type="button" className="btn" onClick={onExit}>Về màn hình chính</button>
        </div>
      </div>
    );
  }
  if (!state) return <div className="launcher"><div className="game-card">Đang kết nối máy chủ… {status === 'connecting' ? '(kiểm tra đã chạy "npm run server")' : ''}</div></div>;

  const { view, seats } = state;
  const base = joinBase(state.lanHosts);
  const active = view.players.find((p) => p.id === view.activePlayerId);

  return (
    <div className="tv" data-testid="tv-screen">
      <GlobalDefs />
      <header className="tv-banner" style={{ borderColor: active?.color }}>
        {view.phase === 'GAME_OVER' ? (
          <span>🏆 {playerName(view, view.winner)} thắng!</span>
        ) : view.pending ? (
          <span>Đang chờ: {view.pending.waitingFor.map((p) => playerName(view, p)).join(', ')} — {view.pending.kind === 'discard' ? 'bỏ bài trên điện thoại' : 'chọn ô cho robber'}</span>
        ) : (
          <span>
            Lượt của <b style={{ color: active?.color }}>{active?.name}</b>
            {view.phase === 'SETUP' ? ` — đặt quân khởi đầu (vòng ${view.setup?.round})` : view.phase === 'PRE_ROLL' ? ' — tung xúc xắc' : ' — hành động'}
          </span>
        )}
        <span className="spacer" />
        {status !== 'open' && <span className="tv-conn">⚠ mất kết nối máy chủ, đang thử lại…</span>}
        <button type="button" className="btn" data-testid="toggle-qr" onClick={() => setShowQr(!showQr)}>
          {showQr ? 'Ẩn mã QR' : 'Mã QR vào ghế'}
        </button>
        <button type="button" className="btn" onClick={onExit}>Thoát</button>
      </header>
      <main className="tv-board">
        <Board view={view} targets={null} />
      </main>
      <Sidebar view={view} seats={seats} />
      {showQr && (
        <div className="qr-overlay" data-testid="qr-overlay">
          <div className="qr-title">Quét mã bằng điện thoại để vào ghế · bài riêng chỉ hiện trên điện thoại của bạn</div>
          <div className="qr-row">
            {seats.map((s) => (
              <SeatQr key={s.playerId} seat={s} url={joinUrl(base, gameId, s.token)} />
            ))}
          </div>
          <div className="muted small">Điện thoại và TV phải cùng mạng Wi-Fi · {base}</div>
        </div>
      )}
    </div>
  );
}
