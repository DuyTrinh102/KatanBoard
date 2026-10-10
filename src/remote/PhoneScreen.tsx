import { useEffect, useRef, useState } from 'react';
import { buildTopology, type HexId } from '../games/catan-ck/board/topology';
import type { CommandBody } from '../games/catan-ck/engine/commands';
import type { PublicGameView } from '../games/catan-ck/projections/views';
import { Board, type BoardTargets } from '../games/catan-ck/ui/Board';
import { GlobalDefs } from '../games/catan-ck/ui/art';
import { ICON_GLYPH, playerName } from '../games/catan-ck/ui/format';
import { describeBundle } from '../games/catan-ck/engine/text';
import { DiscardPanel, HandRow, TradeComposer, playerStatus, type InteractionKind } from '../games/catan-ck/ui/Tray';
import { newId } from '../shared/id';
import { RemoteConnection, type ConnStatus } from './client';
import type { ServerMsg } from './protocol';

type PlayerState = Extract<ServerMsg, { t: 'player-state' }>;

interface PhoneInteraction {
  readonly kind: InteractionKind;
  readonly targets: readonly string[];
  readonly selected: string | null;
  readonly victim: string | null;
  readonly victims: readonly string[];
  readonly commandId: string;
}

const LABEL: Record<InteractionKind, string> = {
  placeSetupBuilding: 'Đặt công trình khởi đầu',
  placeSetupRoad: 'Đặt đường khởi đầu',
  buildRoad: 'Xây đường',
  buildSettlement: 'Xây settlement',
  buildCity: 'Nâng cấp city',
  moveRobber: 'Chuyển robber',
};

/** Ai có thể bị lấy bài ở ô này — tính từ dữ liệu công khai (công trình kề + số lá > 0). */
function victimsFromView(view: PublicGameView, hex: HexId, me: string): string[] {
  const topo = buildTopology(2);
  const owners = new Set<string>();
  for (const v of topo.hexVertices[hex] ?? []) {
    const b = view.buildings[v];
    if (b && b.owner !== me && (view.players.find((p) => p.id === b.owner)?.handCount ?? 0) > 0) owners.add(b.owner);
  }
  return [...owners].sort();
}

/** Màn hình điện thoại của một người chơi (chế độ TV + điện thoại). */
export function PhoneScreen({ gameId, token }: { gameId: string; token: string }) {
  const connRef = useRef<RemoteConnection | null>(null);
  const [st, setSt] = useState<PlayerState | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'trade' | 'discard' | null>(null);
  const [it, setIt] = useState<PhoneInteraction | null>(null);
  const [hideHand, setHideHand] = useState(false);
  const lastTurnRef = useRef<string | null>(null);
  const itRevRef = useRef<number>(-1);

  useEffect(() => {
    const conn = new RemoteConnection();
    connRef.current = conn;
    const off1 = conn.onMessage((m) => {
      if (m.t === 'player-state') {
        setSt(m);
        setError(null);
      }
      if (m.t === 'error') setError(m.message);
    });
    const off2 = conn.onStatus(setStatus);
    conn.send({ t: 'hello-player', gameId, token });
    return () => {
      off1();
      off2();
      conn.close();
    };
  }, [gameId, token]);

  const me = st?.playerId ?? '';
  const view = st?.view;
  const act = (t: string) => st?.actions.find((a) => a.type === t);

  // Rung nhẹ khi tới lượt mình (nếu máy hỗ trợ).
  useEffect(() => {
    if (!view) return;
    const key = `${view.activePlayerId}:${view.turnNumber}:${view.phase === 'SETUP' ? view.revision : ''}`;
    if (view.activePlayerId === me && lastTurnRef.current !== key && view.phase !== 'GAME_OVER') navigator.vibrate?.(120);
    lastTurnRef.current = key;
  }, [view, me]);

  // Tự mở tương tác bắt buộc: đặt quân khởi đầu, chuyển robber.
  useEffect(() => {
    if (!st || !view) return;
    let kind: InteractionKind | null = null;
    if (view.phase === 'SETUP' && view.activePlayerId === me) kind = view.setup?.step === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad';
    else if (view.pending?.kind === 'moveRobber' && view.pending.waitingFor.includes(me)) kind = 'moveRobber';
    if (kind) {
      const a = st.actions.find((x) => x.type === kind);
      const k = kind;
      // Cùng revision (ví dụ chỉ có người khác vừa kết nối) → giữ lựa chọn đang dở.
      setIt((cur) => (cur && cur.kind === k && itRevRef.current === view.revision ? cur : { kind: k, targets: a?.targets ?? [], selected: null, victim: null, victims: [], commandId: newId() }));
      itRevRef.current = view.revision;
      return;
    }
    setIt((cur) => {
      if (!cur || cur.kind.startsWith('placeSetup') || cur.kind === 'moveRobber') return null;
      const a = st.actions.find((x) => x.type === cur.kind);
      if (!a?.enabled) return null;
      return { ...cur, targets: a.targets ?? [], selected: cur.selected && a.targets?.includes(cur.selected) ? cur.selected : null };
    });
    if (view.pending?.kind !== 'discard') setPanel((p) => (p === 'discard' ? null : p));
  }, [st, view, me]);

  if (error && !st) {
    return (
      <div className="phone">
        <div className="game-card">
          <h2>Không vào được ghế</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!st || !view) return <div className="phone"><div className="game-card">Đang kết nối tới bàn chơi…</div></div>;

  const player = view.players.find((p) => p.id === me)!;
  const isActive = view.activePlayerId === me;

  const send = async (body: CommandBody, commandId = newId()): Promise<boolean> => {
    setBusy(true);
    const r = await connRef.current!.command(body, view.revision, commandId);
    setBusy(false);
    setMessage(r.ok ? null : (r.reason ?? 'Không thực hiện được'));
    return r.ok;
  };

  const start = (kind: InteractionKind) => {
    const a = act(kind);
    if (!a?.enabled) return setMessage(a?.reason ?? 'Không khả dụng');
    setIt({ kind, targets: a.targets ?? [], selected: null, victim: null, victims: [], commandId: newId() });
  };

  const pick = (id: string) =>
    setIt((cur) => {
      if (!cur) return cur;
      if (cur.kind === 'moveRobber') {
        const victims = victimsFromView(view, id as HexId, me);
        return { ...cur, selected: id, victims, victim: victims.length === 1 ? victims[0]! : null };
      }
      return { ...cur, selected: id };
    });

  const confirm = async () => {
    if (!it?.selected || busy) return;
    const s = it.selected;
    const body: CommandBody =
      it.kind === 'placeSetupBuilding' ? { type: 'placeSetupBuilding', vertex: s as never }
      : it.kind === 'placeSetupRoad' ? { type: 'placeSetupRoad', edge: s as never }
      : it.kind === 'buildRoad' ? { type: 'buildRoad', edge: s as never }
      : it.kind === 'buildSettlement' ? { type: 'buildSettlement', vertex: s as never }
      : it.kind === 'buildCity' ? { type: 'buildCity', vertex: s as never }
      : { type: 'moveRobber', pendingId: view.pending!.id, hex: s as HexId, victim: it.victim };
    const ok = await send(body, it.commandId);
    if (ok && !it.kind.startsWith('placeSetup') && it.kind !== 'moveRobber') setIt(null);
  };

  const targets: BoardTargets | null = it
    ? {
        kind: it.kind === 'moveRobber' ? 'hex' : it.kind === 'buildRoad' || it.kind === 'placeSetupRoad' ? 'edge' : 'vertex',
        ids: it.targets,
        color: player.color,
        selected: it.selected,
        piece: it.kind === 'buildCity' || (it.kind === 'placeSetupBuilding' && view.setup?.round === 2) ? 'city' : 'settlement',
        onPick: pick,
      }
    : null;

  const Btn = ({ type, label, onClick, primary, testId }: { type: string; label: string; onClick: () => void; primary?: boolean; testId?: string }) => {
    const a = act(type);
    const enabled = a?.enabled ?? false;
    return (
      <button type="button" data-testid={testId} className={`btn ${primary ? 'primary' : ''} ${enabled ? '' : 'locked'}`} aria-disabled={!enabled} onClick={() => (enabled ? onClick() : setMessage(a?.reason ?? 'Không khả dụng'))}>
        {label}
      </button>
    );
  };

  const myProposals = view.proposals.filter((p) => p.from === me);
  const incoming = view.proposals.filter((p) => p.to.includes(me));
  const waitingOnMe = view.pending?.waitingFor.includes(me) ?? false;

  return (
    <div className="phone" data-testid="phone-screen" style={{ borderTopColor: player.color }}>
      <GlobalDefs />
      <header className="phone-head" style={{ background: player.color }}>
        <span className="phone-name">
          {ICON_GLYPH[player.icon]} {player.name}
        </span>
        <span className="phone-vp">★ {player.score.total}</span>
        {status !== 'open' && <span className="phone-conn">đang kết nối lại…</span>}
      </header>
      <div className={`phone-status ${isActive || waitingOnMe ? 'mine' : ''}`} data-testid="phone-status">
        {playerStatus(view, me)}
      </div>

      <section className="phone-hand">
        <div className="row">
          <b>Bài của bạn</b>
          <span className="muted">chỉ hiện trên máy này</span>
          <span className="spacer" />
          <button type="button" className="chip" onClick={() => setHideHand(!hideHand)}>{hideHand ? 'Hiện' : 'Che'}</button>
        </div>
        {hideHand ? <div className="muted">Đã che {player.handCount} lá</div> : <HandRow hand={st.priv.hand} />}
      </section>

      <section className="phone-board">
        <Board view={view} targets={targets} />
      </section>

      <section className="phone-actions">
        {panel === 'discard' && view.pending?.kind === 'discard' ? (
          <DiscardPanel pv={st.priv} pendingId={view.pending.id} onSend={(b) => void send(b)} onClose={() => setPanel(null)} />
        ) : panel === 'trade' ? (
          <TradeComposer view={view} me={me} pv={st.priv} ratios={st.bankRatios} onSend={(b) => void send(b)} onClose={() => setPanel(null)} />
        ) : it ? (
          <div className="row">
            <span className="hint">
              {LABEL[it.kind]}: {it.selected ? 'đã chọn — xác nhận?' : 'chạm vị trí sáng trên bản đồ'}
            </span>
            {it.kind === 'moveRobber' && it.selected && it.victims.length > 0 && (
              <span className="chips">
                Lấy bài của:
                {it.victims.map((v) => (
                  <button type="button" key={v} className={`chip ${it.victim === v ? 'on' : ''}`} onClick={() => setIt({ ...it, victim: v })}>
                    {playerName(view, v)}
                  </button>
                ))}
              </span>
            )}
            <button
              type="button"
              className="btn primary"
              data-testid="phone-confirm"
              aria-disabled={!it.selected || busy || (it.kind === 'moveRobber' && it.victims.length > 0 && !it.victim)}
              onClick={() => void confirm()}
            >
              Xác nhận
            </button>
            {!it.kind.startsWith('placeSetup') && it.kind !== 'moveRobber' && (
              <button type="button" className="btn" onClick={() => setIt(null)}>Hủy</button>
            )}
          </div>
        ) : (
          <div className="phone-buttons">
            {waitingOnMe && view.pending?.kind === 'discard' && (
              <button type="button" className="btn primary" data-testid="phone-discard" onClick={() => setPanel('discard')}>
                Bỏ {view.pending.required?.[me]} lá
              </button>
            )}
            {isActive && view.phase === 'PRE_ROLL' && <Btn type="rollDice" label="🎲 Tung xúc xắc" primary testId="phone-roll" onClick={() => void send({ type: 'rollDice' })} />}
            {isActive && view.phase === 'ACTION' && (
              <>
                <Btn type="buildRoad" label="Đường" testId="phone-build-road" onClick={() => start('buildRoad')} />
                <Btn type="buildSettlement" label="Settlement" testId="phone-build-settlement" onClick={() => start('buildSettlement')} />
                <Btn type="buildCity" label="City" testId="phone-build-city" onClick={() => start('buildCity')} />
                <Btn type="proposeTrade" label="Trade · Ngân hàng" testId="phone-trade" onClick={() => setPanel('trade')} />
                <Btn type="endTurn" label="Kết thúc lượt" primary testId="phone-end-turn" onClick={() => void send({ type: 'endTurn' })} />
              </>
            )}
          </div>
        )}

        {myProposals.map((p) => (
          <div key={p.id} className="proposal">
            Đề nghị của bạn: đưa {describeBundle(p.offer)} ↔ nhận {describeBundle(p.request)}
            {Object.entries(p.acceptedBy)
              .filter(([, rev]) => rev === p.revision)
              .map(([pid]) => (
                <button type="button" key={pid} className="btn primary" onClick={() => void send({ type: 'confirmTrade', proposalId: p.id, revision: p.revision, partner: pid })}>
                  Xác nhận với {playerName(view, pid)}
                </button>
              ))}
            <button type="button" className="btn" onClick={() => void send({ type: 'cancelTrade', proposalId: p.id })}>Hủy</button>
          </div>
        ))}
        {incoming.map((p) => (
          <div key={p.id} className="proposal incoming">
            {playerName(view, p.from)} đưa {describeBundle(p.offer)} ↔ muốn {describeBundle(p.request)}
            {p.acceptedBy[me] === p.revision ? (
              <span className="muted"> · bạn đã đồng ý</span>
            ) : (
              <>
                <button type="button" className="btn primary" onClick={() => void send({ type: 'respondTrade', proposalId: p.id, revision: p.revision, response: 'accept' })}>Đồng ý</button>
                <button type="button" className="btn" onClick={() => void send({ type: 'respondTrade', proposalId: p.id, revision: p.revision, response: 'reject' })}>Từ chối</button>
              </>
            )}
          </div>
        ))}
        {message && <div className="message phone-msg" role="status">{message}</div>}
      </section>
    </div>
  );
}
