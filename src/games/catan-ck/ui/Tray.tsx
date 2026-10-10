import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_TYPES, type Bundle, type CardType } from '../rules';
import { CARD_EN, CARD_LABEL, describeBundle } from '../engine/text';
import type { CommandBody } from '../engine/commands';
import type { ActionView, PrivateGameView, PublicGameView, PublicPlayerView } from '../projections/views';
import { ICON_GLYPH, playerName } from './format';
import { CARD_BG, ResourceIcon } from './art';

export type InteractionKind = 'placeSetupBuilding' | 'placeSetupRoad' | 'buildRoad' | 'buildSettlement' | 'buildCity' | 'moveRobber';

export interface Interaction {
  readonly playerId: string;
  readonly kind: InteractionKind;
  readonly targets: readonly string[];
  readonly selected: string | null;
  readonly victim: string | null;
  readonly victims: readonly string[];
  /** Sinh một lần khi mở tương tác → nhấn Xác nhận hai lần cũng chỉ một command. */
  readonly commandId: string;
}

export interface TrayProps {
  readonly view: PublicGameView;
  readonly player: PublicPlayerView;
  readonly actions: readonly ActionView[];
  readonly bankRatios: Readonly<Record<CardType, number>>;
  /** Có giá trị khi private session của người này đang mở. */
  readonly privateView: PrivateGameView | null;
  /** Tên người đang mở private session khác (nếu có). */
  readonly privateBusyBy: string | null;
  readonly privateMode: 'hold' | 'panel' | null;
  readonly interaction: Interaction | null;
  readonly message: string | null;
  readonly busy: boolean;
  readonly onOpenPrivate: (mode: 'hold' | 'panel') => boolean;
  readonly onClosePrivate: () => void;
  readonly onStartInteraction: (kind: InteractionKind) => void;
  readonly onConfirmInteraction: () => void;
  readonly onCancelInteraction: () => void;
  readonly onPickVictim: (victim: string) => void;
  readonly onSend: (body: CommandBody) => void;
  readonly onReason: (reason: string) => void;
  readonly onPause: () => void;
}

const BUILD_LABEL: Record<InteractionKind, string> = {
  placeSetupBuilding: 'Đặt công trình khởi đầu',
  placeSetupRoad: 'Đặt đường khởi đầu',
  buildRoad: 'Đường',
  buildSettlement: 'Settlement',
  buildCity: 'City',
  moveRobber: 'Di chuyển robber',
};

function Btn({ action, label, onClick, onReason, testId, primary }: { action?: ActionView; label: string; onClick: () => void; onReason: (r: string) => void; testId?: string; primary?: boolean }) {
  const enabled = action ? action.enabled : true;
  return (
    <button
      type="button"
      className={`btn ${primary ? 'primary' : ''} ${enabled ? '' : 'locked'}`}
      aria-disabled={!enabled}
      data-testid={testId}
      onClick={() => (enabled ? onClick() : onReason(action?.reason ?? 'Không khả dụng'))}
    >
      {label}
    </button>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  );
}

export function HandRow({ hand }: { hand: Readonly<Record<CardType, number>> }) {
  return (
    <div className="hand-row" data-testid="private-hand">
      {CARD_TYPES.map((t) => (
        <span key={t} className={`rcard ${hand[t] === 0 ? 'empty' : ''}`} title={CARD_EN[t]} style={{ background: `linear-gradient(160deg, ${CARD_BG[t][0]}, ${CARD_BG[t][1]})` }}>
          <ResourceIcon type={t} size={34} />
          <span className="rcard-label">{CARD_LABEL[t]}</span>
          <b className="rcard-count">{hand[t]}</b>
        </span>
      ))}
    </div>
  );
}

/** Mặt sau lá bài — chỉ số lượng (công khai). */
export function CardBacks({ count }: { count: number }) {
  const shown = Math.min(count, 9);
  return (
    <span className="backs" aria-label={`${count} lá`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="card-back" style={{ transform: `rotate(${(i - (shown - 1) / 2) * 7}deg)`, left: i * 9 }} />
      ))}
      <b className="backs-count">{count}</b>
    </span>
  );
}

/** Panel bỏ bài — chỉ render khi private session ở chế độ panel đang mở. */
export function DiscardPanel({ pv, pendingId, onSend, onClose }: { pv: PrivateGameView; pendingId: string; onSend: (b: CommandBody) => void; onClose: () => void }) {
  const [pick, setPick] = useState<Bundle>({});
  const need = pv.discardRequired ?? 0;
  const chosen = Object.values(pick).reduce((s, n) => s + (n ?? 0), 0);
  return (
    <div className="panel">
      <div className="panel-title">Chọn {need} lá để bỏ (đã chọn {chosen})</div>
      <div className="grid-cards">
        {CARD_TYPES.filter((t) => pv.hand[t] > 0).map((t) => (
          <label key={t} className={`card card-${t}`}>
            <ResourceIcon type={t} size={22} /> {CARD_LABEL[t]} ({pv.hand[t]}) <Stepper value={pick[t] ?? 0} max={pv.hand[t]} onChange={(n) => setPick({ ...pick, [t]: n })} />
          </label>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn primary" aria-disabled={chosen !== need} onClick={() => chosen === need && (onSend({ type: 'submitDiscard', pendingId, cards: pick }), onClose())}>
          Xác nhận bỏ bài
        </button>
        <button type="button" className="btn" onClick={onClose}>Che lại</button>
      </div>
    </div>
  );
}

/** Soạn đề nghị trade / đổi ngân hàng — riêng tư vì cần xem tay. */
export function TradeComposer({ view, me, pv, ratios, onSend, onClose }: { view: PublicGameView; me: string; pv: PrivateGameView; ratios: Readonly<Record<CardType, number>>; onSend: (b: CommandBody) => void; onClose: () => void }) {
  const [offer, setOffer] = useState<Bundle>({});
  const [request, setRequest] = useState<Bundle>({});
  const others = view.players.filter((p) => p.id !== me);
  const [to, setTo] = useState<string[]>(others.map((p) => p.id));
  const [give, setGive] = useState<CardType | null>(null);
  const [get, setGet] = useState<CardType | null>(null);
  return (
    <div className="panel">
      <div className="panel-title">Trade — đề nghị gửi đi sẽ công khai cho cả bàn</div>
      <div className="trade-grid">
        <div>
          <b>Đưa</b>
          {CARD_TYPES.map((t) => (
            <div key={t} className="trade-line">
              <span><ResourceIcon type={t} size={20} /> {CARD_LABEL[t]} ({pv.hand[t]})</span> <Stepper value={offer[t] ?? 0} max={pv.hand[t]} onChange={(n) => setOffer({ ...offer, [t]: n })} />
            </div>
          ))}
        </div>
        <div>
          <b>Nhận</b>
          {CARD_TYPES.map((t) => (
            <div key={t} className="trade-line">
              <span><ResourceIcon type={t} size={20} /> {CARD_LABEL[t]}</span> <Stepper value={request[t] ?? 0} max={19} onChange={(n) => setRequest({ ...request, [t]: n })} />
            </div>
          ))}
        </div>
        <div>
          <b>Gửi cho</b>
          {others.map((p) => (
            <label key={p.id} className="check">
              <input type="checkbox" checked={to.includes(p.id)} onChange={(e) => setTo(e.target.checked ? [...to, p.id] : to.filter((x) => x !== p.id))} />
              {ICON_GLYPH[p.icon]} {p.name}
            </label>
          ))}
          <button type="button" className="btn primary" data-testid="send-proposal" onClick={() => (onSend({ type: 'proposeTrade', to, offer, request }), onClose())}>
            Gửi đề nghị
          </button>
        </div>
        <div>
          <b>Đổi ngân hàng / cảng</b>
          <div className="chips">
            {CARD_TYPES.map((t) => (
              <button type="button" key={t} className={`chip ${give === t ? 'on' : ''}`} onClick={() => setGive(t)}>
                {CARD_LABEL[t]} {ratios[t]}:1
              </button>
            ))}
          </div>
          <div>lấy</div>
          <div className="chips">
            {CARD_TYPES.map((t) => (
              <button type="button" key={t} className={`chip ${get === t ? 'on' : ''}`} onClick={() => setGet(t)}>
                {CARD_LABEL[t]}
              </button>
            ))}
          </div>
          <button type="button" className="btn" aria-disabled={!give || !get} onClick={() => give && get && onSend({ type: 'bankTrade', give, get })}>
            Đổi {give ? `${ratios[give]} ${CARD_LABEL[give]}` : '…'} → 1 {get ? CARD_LABEL[get] : '…'}
          </button>
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>Đóng & che</button>
      </div>
    </div>
  );
}

/** Câu trạng thái cho một người chơi (dùng chung cho khay bàn cảm ứng và điện thoại). */
export function playerStatus(view: PublicGameView, me: string): string {
  const isActive = view.activePlayerId === me;
  const pending = view.pending;
  const waitingOnMe = pending?.waitingFor.includes(me) ?? false;
  if (view.phase === 'GAME_OVER') return view.winner === me ? 'Bạn thắng!' : `${playerName(view, view.winner)} thắng`;
  if (view.phase === 'SETUP') {
    const round = view.setup?.round === 2 ? 'Vòng 2 (ngược chiều)' : 'Vòng 1';
    return isActive
      ? `${round}: ${view.setup?.step === 'building' ? (view.setup.round === 1 ? 'đặt settlement khởi đầu' : 'đặt city khởi đầu (miễn phí)') : 'đặt đường nối công trình vừa đặt'}`
      : `${round}: đang chờ ${playerName(view, view.activePlayerId)} đặt quân`;
  }
  if (pending) return waitingOnMe ? (pending.kind === 'discard' ? `Bạn phải bỏ ${pending.required?.[me]} lá` : 'Chọn ô để chuyển robber') : `Đang chờ: ${pending.waitingFor.map((p) => playerName(view, p)).join(', ')}`;
  return isActive ? (view.phase === 'PRE_ROLL' ? 'Lượt của bạn — tung xúc xắc' : 'Lượt của bạn — hành động') : `Lượt của ${playerName(view, view.activePlayerId)}`;
}

export function Tray(props: TrayProps) {
  const { view, player, actions, privateView: pv, interaction } = props;
  const me = player.id;
  const isActive = view.activePlayerId === me;
  const act = (t: string) => actions.find((a) => a.type === t);
  const pending = view.pending;
  const waitingOnMe = pending?.waitingFor.includes(me) ?? false;
  const [panel, setPanel] = useState<'trade' | 'discard' | null>(null);
  const holdRef = useRef<number | null>(null);

  // Panel tự đóng nếu private session bị đóng từ bên ngoài (blur, pause…).
  useEffect(() => {
    if (props.privateMode !== 'panel') setPanel(null);
  }, [props.privateMode]);

  const openPanel = (kind: 'trade' | 'discard') => {
    if (props.onOpenPrivate('panel')) setPanel(kind);
  };
  const closePanel = () => {
    setPanel(null);
    props.onClosePrivate();
  };

  const myProposals = view.proposals.filter((p) => p.from === me);
  const incoming = view.proposals.filter((p) => p.to.includes(me));

  const status: ReactNode = playerStatus(view, me);

  const myInteraction = interaction && interaction.playerId === me ? interaction : null;

  return (
    <div className={`tray seat-${player.seat} ${isActive ? 'active' : ''}`} style={{ borderColor: player.color }} data-testid={`tray-${me}`}>
      <div className="tray-head">
        <span className="pname" style={{ background: player.color }}>
          {ICON_GLYPH[player.icon]} {player.name}
        </span>
        <span className="vp" data-testid={`vp-${me}`}>★ {player.score.total}</span>
        <CardBacks count={player.handCount} />
        <span className="status" data-testid={`status-${me}`}>{status}</span>
        <button
          type="button"
          className="btn hold"
          data-testid={`hold-${me}`}
          onPointerDown={(e) => {
            if (props.onOpenPrivate('hold')) {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              holdRef.current = e.pointerId;
            }
          }}
          onPointerUp={() => props.privateMode === 'hold' && props.onClosePrivate()}
          onPointerCancel={() => props.privateMode === 'hold' && props.onClosePrivate()}
          onLostPointerCapture={() => props.privateMode === 'hold' && props.onClosePrivate()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {props.privateBusyBy ? `${props.privateBusyBy} đang xem bài` : `Giữ để xem bài (${player.handCount} lá)`}
        </button>
        <button type="button" className="btn pause" onClick={props.onPause} aria-label="Tạm dừng">⏸</button>
      </div>

      {pv && props.privateMode === 'hold' && <HandRow hand={pv.hand} />}

      {panel === 'discard' && pv && pending?.kind === 'discard' ? (
        <DiscardPanel pv={pv} pendingId={pending.id} onSend={props.onSend} onClose={closePanel} />
      ) : panel === 'trade' && pv ? (
        <TradeComposer view={view} me={me} pv={pv} ratios={props.bankRatios} onSend={props.onSend} onClose={closePanel} />
      ) : (
        <div className="tray-body">
          {myInteraction ? (
            <div className="row">
              <span className="hint">
                {BUILD_LABEL[myInteraction.kind]}: {myInteraction.selected ? 'đã chọn — xác nhận?' : 'chạm vị trí sáng trên bàn'}
              </span>
              {myInteraction.kind === 'moveRobber' && myInteraction.selected && myInteraction.victims.length > 0 && (
                <span className="chips">
                  Lấy bài của:
                  {myInteraction.victims.map((v) => (
                    <button type="button" key={v} className={`chip ${myInteraction.victim === v ? 'on' : ''}`} data-testid={`victim-${v}`} onClick={() => props.onPickVictim(v)}>
                      {playerName(view, v)}
                    </button>
                  ))}
                </span>
              )}
              <button
                type="button"
                className="btn primary"
                data-testid="confirm"
                aria-disabled={!myInteraction.selected || props.busy || (myInteraction.kind === 'moveRobber' && myInteraction.victims.length > 0 && !myInteraction.victim)}
                onClick={props.onConfirmInteraction}
              >
                Xác nhận
              </button>
              {!myInteraction.kind.startsWith('placeSetup') && myInteraction.kind !== 'moveRobber' && (
                <button type="button" className="btn" onClick={props.onCancelInteraction}>Hủy</button>
              )}
            </div>
          ) : (
            <div className="row">
              {waitingOnMe && pending?.kind === 'discard' && (
                <button type="button" className="btn primary" data-testid="open-discard" onClick={() => openPanel('discard')}>
                  Mở riêng để bỏ bài
                </button>
              )}
              {isActive && view.phase === 'PRE_ROLL' && <Btn action={act('rollDice')} label="🎲 Tung xúc xắc" primary testId="roll" onClick={() => props.onSend({ type: 'rollDice' })} onReason={props.onReason} />}
              {isActive && (view.phase === 'ACTION' || view.phase === 'ROLL_RESOLUTION') && (
                <>
                  <Btn action={act('buildRoad')} label="Đường" testId="build-road" onClick={() => props.onStartInteraction('buildRoad')} onReason={props.onReason} />
                  <Btn action={act('buildSettlement')} label="Settlement" testId="build-settlement" onClick={() => props.onStartInteraction('buildSettlement')} onReason={props.onReason} />
                  <Btn action={act('buildCity')} label="City" testId="build-city" onClick={() => props.onStartInteraction('buildCity')} onReason={props.onReason} />
                  <Btn action={act('proposeTrade')} label="Trade / Ngân hàng" testId="trade" onClick={() => openPanel('trade')} onReason={props.onReason} />
                  <span className="spacer" />
                  <Btn action={act('endTurn')} label="Kết thúc lượt" primary testId="end-turn" onClick={() => props.onSend({ type: 'endTurn' })} onReason={props.onReason} />
                </>
              )}
            </div>
          )}

          {myProposals.map((p) => (
            <div key={p.id} className="proposal">
              Đề nghị của bạn (bản {p.revision}): đưa {describeBundle(p.offer)} ↔ nhận {describeBundle(p.request)}
              {Object.entries(p.acceptedBy)
                .filter(([, rev]) => rev === p.revision)
                .map(([pid]) => (
                  <button type="button" key={pid} className="btn primary" data-testid={`confirm-trade-${pid}`} onClick={() => props.onSend({ type: 'confirmTrade', proposalId: p.id, revision: p.revision, partner: pid })}>
                    Xác nhận với {playerName(view, pid)}
                  </button>
                ))}
              {p.rejectedBy.length > 0 && <span className="muted"> · từ chối: {p.rejectedBy.map((x) => playerName(view, x)).join(', ')}</span>}
              <button type="button" className="btn" onClick={() => props.onSend({ type: 'cancelTrade', proposalId: p.id })}>Hủy</button>
            </div>
          ))}
          {incoming.map((p) => {
            const accepted = p.acceptedBy[me] === p.revision;
            return (
              <div key={p.id} className="proposal incoming" data-testid={`incoming-${p.id}`}>
                {playerName(view, p.from)} đưa {describeBundle(p.offer)} ↔ muốn {describeBundle(p.request)} (bản {p.revision})
                {accepted ? (
                  <span className="muted"> · bạn đã đồng ý</span>
                ) : (
                  <>
                    <button type="button" className="btn primary" data-testid={`accept-${p.id}`} onClick={() => props.onSend({ type: 'respondTrade', proposalId: p.id, revision: p.revision, response: 'accept' })}>Đồng ý</button>
                    <button type="button" className="btn" onClick={() => props.onSend({ type: 'respondTrade', proposalId: p.id, revision: p.revision, response: 'reject' })}>Từ chối</button>
                  </>
                )}
              </div>
            );
          })}
          {props.message && <div className="message" role="status">{props.message}</div>}
        </div>
      )}
    </div>
  );
}
