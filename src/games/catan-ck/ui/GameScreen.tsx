import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { GameSession, SessionSnapshot } from '../session';
import type { CommandBody } from '../engine/commands';
import type { HexId } from '../board/topology';
import { getActionsView, getBankRatios, getPrivateView, getPublicView, getRobberVictims } from '../projections/views';
import { Board, type BoardTargets } from './Board';
import { Tray, type Interaction, type InteractionKind } from './Tray';
import { EVENT_LABEL, formatLog, ICON_GLYPH, playerName } from './format';
import { CARD_LABEL } from '../engine/text';
import { CARD_TYPES } from '../rules';

const STAGE_W = 1920;
const STAGE_H = 1080;
const PANEL_IDLE_MS = 30_000;

function useStageScale(): number {
  const calc = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const on = () => setScale(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return scale;
}

export interface GameScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
}

export function GameScreen({ session, onExit }: GameScreenProps) {
  const subscribe = useCallback((fn: () => void) => session.subscribe(fn), [session]);
  const snapRef = useRef<SessionSnapshot>(session.snapshot());
  const snap = useSyncExternalStore(subscribe, () => {
    const s = session.snapshot();
    const prev = snapRef.current;
    if (prev.state === s.state && prev.storageError === s.storageError && prev.saving === s.saving && prev.readOnly === s.readOnly) return prev;
    snapRef.current = s;
    return s;
  });
  const state = snap.state;
  const view = useMemo(() => getPublicView(state), [state]);
  const scale = useStageScale();

  const [privateSession, setPrivateSession] = useState<{ playerId: string; mode: 'hold' | 'panel' } | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastTouch = useRef(Date.now());

  const closePrivate = useCallback(() => setPrivateSession(null), []);

  // Che thông tin riêng ngay khi mất focus/ẩn trang (DIG-001 mục 3).
  useEffect(() => {
    const hide = () => setPrivateSession(null);
    const onVis = () => document.visibilityState !== 'visible' && hide();
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Panel riêng tự che khi không chạm một lúc.
  useEffect(() => {
    if (privateSession?.mode !== 'panel') return;
    const id = window.setInterval(() => {
      if (Date.now() - lastTouch.current > PANEL_IDLE_MS) setPrivateSession(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [privateSession]);

  const openPrivate = (playerId: string, mode: 'hold' | 'panel'): boolean => {
    if (paused) return false;
    if (privateSession && privateSession.playerId !== playerId) {
      setMessages((m) => ({ ...m, [playerId]: `Đợi ${playerName(view, privateSession.playerId)} xem xong — những người khác vui lòng quay đi` }));
      return false;
    }
    setPrivateSession({ playerId, mode });
    return true;
  };

  const send = useCallback(
    async (playerId: string, body: CommandBody, commandId?: string) => {
      setBusy(true);
      const r = await session.dispatch(playerId, body, commandId);
      setBusy(false);
      if (!r.ok) {
        const ownPrivate = privateSession?.playerId === playerId;
        const reason = ownPrivate && 'privateReason' in r && r.privateReason ? r.privateReason : r.publicReason;
        setMessages((m) => ({ ...m, [playerId]: reason }));
      } else {
        setMessages((m) => ({ ...m, [playerId]: '' }));
      }
      return r.ok;
    },
    [session, privateSession],
  );

  // Tự mở tương tác cho bước đặt quân khởi đầu và di chuyển robber của người đang có quyền.
  useEffect(() => {
    if (snap.readOnly || paused) return;
    const actor = view.activePlayerId;
    let kind: InteractionKind | null = null;
    if (view.phase === 'SETUP') kind = view.setup?.step === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad';
    else if (view.pending?.kind === 'moveRobber') kind = 'moveRobber';
    if (!kind) {
      setInteraction((cur) => (cur && (cur.kind.startsWith('placeSetup') || cur.kind === 'moveRobber') ? null : cur));
      return;
    }
    const actions = getActionsView(state, actor, false);
    const a = actions.find((x) => x.type === kind);
    setInteraction({ playerId: actor, kind, targets: a?.targets ?? [], selected: null, victim: null, victims: [], commandId: crypto.randomUUID() });
  }, [state, view.phase, view.setup?.step, view.pending?.kind, view.activePlayerId, snap.readOnly, paused]);

  // Tương tác xây bị hủy nếu state đổi làm nó mất hiệu lực (ví dụ hết lượt).
  useEffect(() => {
    setInteraction((cur) => {
      if (!cur || cur.kind.startsWith('placeSetup') || cur.kind === 'moveRobber') return cur;
      const a = getActionsView(state, cur.playerId, false).find((x) => x.type === cur.kind);
      if (!a?.enabled) return null;
      return { ...cur, targets: a.targets ?? [], selected: cur.selected && a.targets?.includes(cur.selected) ? cur.selected : null };
    });
  }, [state]);

  const startInteraction = (playerId: string, kind: InteractionKind) => {
    const a = getActionsView(state, playerId, false).find((x) => x.type === kind);
    if (!a?.enabled) return;
    setInteraction({ playerId, kind, targets: a.targets ?? [], selected: null, victim: null, victims: [], commandId: crypto.randomUUID() });
  };

  const confirmInteraction = async () => {
    const it = interaction;
    if (!it?.selected || busy) return;
    let body: CommandBody;
    switch (it.kind) {
      case 'placeSetupBuilding':
        body = { type: 'placeSetupBuilding', vertex: it.selected as never };
        break;
      case 'placeSetupRoad':
        body = { type: 'placeSetupRoad', edge: it.selected as never };
        break;
      case 'buildRoad':
        body = { type: 'buildRoad', edge: it.selected as never };
        break;
      case 'buildSettlement':
        body = { type: 'buildSettlement', vertex: it.selected as never };
        break;
      case 'buildCity':
        body = { type: 'buildCity', vertex: it.selected as never };
        break;
      case 'moveRobber':
        if (it.victims.length > 0 && !it.victim) return;
        body = { type: 'moveRobber', pendingId: view.pending!.id, hex: it.selected as HexId, victim: it.victim };
        break;
    }
    const ok = await send(it.playerId, body, it.commandId);
    if (ok && !it.kind.startsWith('placeSetup') && it.kind !== 'moveRobber') setInteraction(null);
  };

  const pick = (id: string) => {
    setInteraction((cur) => {
      if (!cur) return cur;
      if (cur.kind === 'moveRobber') {
        const victims = getRobberVictims(state, id as HexId, cur.playerId);
        return { ...cur, selected: id, victims, victim: victims.length === 1 ? victims[0]! : null };
      }
      return { ...cur, selected: id };
    });
  };

  const targets: BoardTargets | null = interaction
    ? {
        kind: interaction.kind === 'moveRobber' ? 'hex' : interaction.kind === 'buildRoad' || interaction.kind === 'placeSetupRoad' ? 'edge' : 'vertex',
        ids: interaction.targets,
        color: view.players.find((p) => p.id === interaction.playerId)?.color ?? '#fff',
        selected: interaction.selected,
        onPick: pick,
      }
    : null;

  const pause = () => {
    setPrivateSession(null);
    setPaused(true);
  };

  const exportRescue = () => {
    const blob = new Blob([JSON.stringify(session.exportRecord(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `katanboard-${view.gameId}-r${view.revision}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const roll = view.lastRoll;

  return (
    <div className="viewport" onPointerDownCapture={() => (lastTouch.current = Date.now())}>
      <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
        <div className="board-area">
          <Board view={view} targets={paused ? null : targets} />
        </div>

        <aside className="side left">
          {!view.rulesetVerified && (
            <div className="warn" data-testid="ruleset-warning">
              ⚠ Dữ liệu luật CHƯA KIỂM CHỨNG với rulebook 2025 — bản phát triển (M1)
            </div>
          )}
          {view.openTable && <div className="warn soft">Chơi mở (Open Table): bài riêng được công khai</div>}
          <div className="box">
            <div className="box-title">Xúc xắc</div>
            {roll ? (
              <div className="dice" data-testid="dice">
                <span className="die red">{roll.red}</span>
                <span className="die yellow">{roll.yellow}</span>
                <span className="sum">= {roll.red + roll.yellow}</span>
                <div className="event">{EVENT_LABEL[roll.event]}</div>
              </div>
            ) : (
              <div className="muted">Chưa tung</div>
            )}
          </div>
          <div className="box">
            <div className="box-title">Barbarians</div>
            <div className="muted">Tàu ở ô {view.barbarian.position} · cơ chế đầy đủ ở M2</div>
          </div>
          <div className="box">
            <div className="box-title">Ngân hàng</div>
            <div className="bank">
              {CARD_TYPES.map((t) => (
                <span key={t}>
                  {CARD_LABEL[t]} {view.bank[t]}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <aside className="side right">
          <div className="box">
            <div className="box-title">Điểm (thắng ở {view.victoryTarget}*)</div>
            <table className="scores">
              <tbody>
                {view.players.map((p) => (
                  <tr key={p.id} className={view.activePlayerId === p.id ? 'active' : ''}>
                    <td style={{ color: p.color }}>
                      {ICON_GLYPH[p.icon]} {p.name}
                    </td>
                    <td>{p.score.total}</td>
                    <td>đường {p.roadLength}{view.longestRoad === p.id ? ' 🏆' : ''}</td>
                    <td>{p.handCount} lá</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="box log" data-testid="public-log">
            <div className="box-title">Nhật ký</div>
            {view.log.slice(-9).map((e) => (
              <div key={e.seq} className="log-line">
                {formatLog(view, e)}
              </div>
            ))}
          </div>
          {snap.saving && <div className="muted">Đang lưu…</div>}
        </aside>

        {view.players.map((p) => {
          const own = privateSession?.playerId === p.id;
          return (
            <Tray
              key={p.id}
              view={view}
              player={p}
              actions={getActionsView(state, p.id, own)}
              bankRatios={getBankRatios(state, p.id)}
              privateView={own ? getPrivateView(state, p.id) : null}
              privateBusyBy={privateSession && !own ? playerName(view, privateSession.playerId) : null}
              privateMode={own ? privateSession!.mode : null}
              interaction={interaction}
              message={messages[p.id] || null}
              busy={busy}
              onOpenPrivate={(mode) => openPrivate(p.id, mode)}
              onClosePrivate={closePrivate}
              onStartInteraction={(k) => startInteraction(p.id, k)}
              onConfirmInteraction={confirmInteraction}
              onCancelInteraction={() => setInteraction(null)}
              onPickVictim={(v) => setInteraction((cur) => (cur ? { ...cur, victim: v } : cur))}
              onSend={(b) => void send(p.id, b)}
              onReason={(r) => setMessages((m) => ({ ...m, [p.id]: r }))}
              onPause={pause}
            />
          );
        })}

        {(snap.storageError || snap.readOnly) && (
          <div className="banner error" role="alert">
            {snap.storageError ?? 'Ván này đang được điều khiển ở tab/cửa sổ khác — chế độ chỉ xem.'}
          </div>
        )}

        {paused && (
          <div className="pause-overlay" data-testid="pause-overlay">
            <div className="pause-box">
              <h2>Tạm dừng</h2>
              <p>Thông tin riêng đã được che. Lựa chọn đang chờ vẫn được giữ.</p>
              <button type="button" className="btn primary" onClick={() => setPaused(false)}>Tiếp tục</button>
              <hr />
              <p className="muted">Khu vực nhân viên</p>
              <button type="button" className="btn" onClick={exportRescue}>Xuất file cứu hộ (chứa bài riêng)</button>
              <button type="button" className="btn" onClick={onExit}>Về màn hình chính (ván vẫn được lưu)</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
