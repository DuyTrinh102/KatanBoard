/**
 * ViewModel là cửa duy nhất đưa dữ liệu ra UI (DIG-001 mục 6).
 * - getPublicView: chỉ dữ liệu công khai; không có tay bài, rng, thứ tự bộ thẻ, lựa chọn riêng.
 * - getPrivateView: chỉ gọi khi private session của người đó đang mở.
 * Open Table (DIG-002) là nhánh duy nhất gộp dữ liệu riêng vào public view.
 */
import type { Harbor, HexTile } from '../board/layout';
import type { EdgeId, HexId, VertexId } from '../board/topology';
import { computeScore, handTotal, roadLengths, type ScoreBreakdown } from '../engine/queries';
import type { Building, DiceResult, GameState, LogEntry, Phase, PlayerId, SeatId, SetupProgress, TradeProposal } from '../engine/state';
import { getRuleset, isRulesetVerified, type CardType } from '../rules';

export interface PublicPlayerView {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly seat: SeatId;
  readonly handCount: number;
  /** Chỉ có khi Open Table. */
  readonly openHand?: Readonly<Record<CardType, number>>;
  readonly stock: { readonly roads: number; readonly settlements: number; readonly cities: number };
  readonly score: ScoreBreakdown;
  readonly roadLength: number;
}

export interface PublicPendingView {
  readonly id: string;
  readonly kind: 'discard' | 'moveRobber';
  readonly waitingFor: readonly PlayerId[];
  /** Số lá phải bỏ — công khai (suy ra từ số lá trong tay). */
  readonly required?: Readonly<Record<PlayerId, number>>;
}

export interface PublicLogEntry {
  readonly seq: number;
  readonly turn: number;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface PublicGameView {
  readonly gameId: string;
  readonly revision: number;
  readonly rulesetId: string;
  readonly rulesetLabel: string;
  readonly rulesetVerified: boolean;
  readonly openTable: boolean;
  readonly phase: Phase;
  readonly activePlayerId: PlayerId;
  readonly turnNumber: number;
  readonly lastRoll: DiceResult | null;
  readonly setup: SetupProgress | null;
  readonly board: { readonly hexes: Readonly<Record<HexId, HexTile>>; readonly robberHex: HexId; readonly harbors: readonly Harbor[] };
  readonly roads: Readonly<Record<EdgeId, PlayerId>>;
  readonly buildings: Readonly<Record<VertexId, Building>>;
  readonly bank: Readonly<Record<CardType, number>>;
  readonly barbarian: { readonly position: number; readonly attacksResolved: number };
  readonly longestRoad: PlayerId | null;
  readonly players: readonly PublicPlayerView[];
  readonly pending: PublicPendingView | null;
  readonly proposals: readonly TradeProposal[];
  readonly log: readonly PublicLogEntry[];
  readonly winner: PlayerId | null;
  readonly victoryTarget: number;
}

export interface PrivateGameView {
  readonly playerId: PlayerId;
  readonly hand: Readonly<Record<CardType, number>>;
  readonly discardRequired: number | null;
  readonly secretLog: readonly { readonly seq: number; readonly kind: string; readonly data: Readonly<Record<string, unknown>> }[];
}

function publicLog(entry: LogEntry, openTable: boolean): PublicLogEntry {
  const data = openTable && entry.secret ? { ...entry.data, ...entry.secret.data } : entry.data;
  return { seq: entry.seq, turn: entry.turn, kind: entry.kind, data };
}

export function getPublicView(state: GameState): PublicGameView {
  const cfg = state.meta.config;
  const rs = getRuleset(cfg.rulesetId, cfg.rulesetMode);
  const scores = computeScore(state);
  const lengths = roadLengths(state);
  const players: PublicPlayerView[] = cfg.turnOrder.map((id) => {
    const pc = cfg.players.find((p) => p.id === id)!;
    const ps = state.players[id]!;
    return {
      id,
      name: pc.name,
      color: pc.color,
      icon: pc.icon,
      seat: pc.seat,
      handCount: handTotal(state, id),
      ...(cfg.openTable ? { openHand: { ...ps.hand } } : {}),
      stock: { ...ps.stock },
      score: scores[id]!,
      roadLength: lengths[id]!,
    };
  });
  const head = state.pending[0];
  const pending: PublicPendingView | null = head
    ? {
        id: head.id,
        kind: head.kind,
        waitingFor: [...head.decisionOwnerIds],
        ...(head.kind === 'discard' ? { required: { ...head.required } } : {}),
      }
    : null;
  return {
    gameId: state.meta.gameId,
    revision: state.revision,
    rulesetId: rs.id,
    rulesetLabel: rs.label,
    rulesetVerified: isRulesetVerified(rs),
    openTable: cfg.openTable,
    phase: state.turn.phase,
    activePlayerId: state.turn.activePlayerId,
    turnNumber: state.turn.number,
    lastRoll: state.turn.lastRoll,
    setup: state.turn.setup,
    board: { hexes: state.board.hexes, robberHex: state.board.robberHex, harbors: state.board.harbors },
    roads: state.roads,
    buildings: state.buildings,
    bank: { ...state.bank },
    barbarian: { ...state.barbarian },
    longestRoad: state.titles.longestRoad,
    players,
    pending,
    proposals: Object.values(state.proposals).filter((p) => p.status === 'open'),
    log: state.log.map((e) => publicLog(e, cfg.openTable)),
    winner: state.winner,
    victoryTarget: rs.victoryTarget.value,
  };
}

export function getPrivateView(state: GameState, playerId: PlayerId): PrivateGameView {
  const ps = state.players[playerId];
  if (!ps) throw new Error(`Không có người chơi ${playerId}`);
  const head = state.pending[0];
  const discardRequired = head?.kind === 'discard' && head.decisionOwnerIds.includes(playerId) ? head.required[playerId]! : null;
  return {
    playerId,
    hand: { ...ps.hand },
    discardRequired,
    secretLog: state.log
      .filter((e) => e.secret?.visibleTo.includes(playerId))
      .map((e) => ({ seq: e.seq, kind: e.kind, data: { ...e.data, ...e.secret!.data } })),
  };
}
