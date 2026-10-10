import type { RngState } from '../../../shared/random';
import type { Harbor, HexTile } from '../board/layout';
import type { EdgeId, HexId, VertexId } from '../board/topology';
import type { Bundle, CardType, EventFace } from '../rules';

export const SCHEMA_VERSION = 1;

export type PlayerId = string;
export type SeatId = 'B' | 'T' | 'L' | 'R';
export const SEAT_IDS: readonly SeatId[] = ['B', 'T', 'L', 'R'];
/** Hướng xoay khay theo ghế (độ). */
export const SEAT_ROTATION: Record<SeatId, number> = { B: 0, T: 180, L: 90, R: 270 };

export type Phase = 'SETUP' | 'PRE_ROLL' | 'ROLL_RESOLUTION' | 'ACTION' | 'GAME_OVER';

export interface PlayerConfig {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly seat: SeatId;
}

export interface GameConfig {
  readonly rulesetId: string;
  readonly rulesetMode: 'standard' | 'dev-unverified';
  readonly players: readonly PlayerConfig[];
  /** Thứ tự lượt (độc lập với ghế). */
  readonly turnOrder: readonly PlayerId[];
  readonly openTable: boolean;
}

export interface PlayerState {
  readonly id: PlayerId;
  hand: Record<CardType, number>;
  stock: { roads: number; settlements: number; cities: number };
}

export interface Building {
  readonly owner: PlayerId;
  kind: 'settlement' | 'city';
}

export interface DiceResult {
  readonly red: number;
  readonly yellow: number;
  readonly event: EventFace;
}

export interface SetupProgress {
  /** Vòng 1: settlement + road theo thứ tự; vòng 2: công trình thứ hai + road theo thứ tự ngược. */
  round: 1 | 2;
  index: number;
  step: 'building' | 'road';
  lastVertex: VertexId | null;
}

export type PendingResolution =
  | {
      readonly id: string;
      readonly kind: 'discard';
      readonly source: 'roll7';
      /** Số lá mỗi người phải bỏ. */
      readonly required: Record<PlayerId, number>;
      decisionOwnerIds: PlayerId[];
      /** Lựa chọn đã thu (riêng tư) — commit khi đủ tất cả (DIG-006). */
      collected: Record<PlayerId, Bundle>;
    }
  | {
      readonly id: string;
      readonly kind: 'moveRobber';
      readonly source: 'roll7';
      decisionOwnerIds: PlayerId[];
    };

export interface TradeProposal {
  readonly id: string;
  revision: number;
  readonly from: PlayerId;
  to: PlayerId[];
  offer: Bundle;
  request: Bundle;
  /** playerId → revision đã chấp nhận. */
  acceptedBy: Record<PlayerId, number>;
  rejectedBy: PlayerId[];
  status: 'open' | 'done' | 'cancelled';
}

export interface LogEntry {
  readonly seq: number;
  readonly revision: number;
  readonly turn: number;
  readonly kind: string;
  /** Dữ liệu công khai. */
  readonly data: Record<string, unknown>;
  /** Dữ liệu riêng: chỉ những người trong visibleTo được thấy (projection lọc). */
  readonly secret?: { readonly visibleTo: readonly PlayerId[]; readonly data: Record<string, unknown> };
}

export interface GameState {
  readonly meta: {
    readonly gameId: string;
    readonly schemaVersion: number;
    readonly rulesetId: string;
    readonly config: GameConfig;
  };
  revision: number;
  rng: RngState;
  /** Bộ đếm sinh ID (pending, proposal) — không dùng random cho ID. */
  idCounter: number;
  players: Record<PlayerId, PlayerState>;
  board: {
    readonly layoutId: string;
    hexes: Record<HexId, HexTile>;
    robberHex: HexId;
    readonly harbors: readonly Harbor[];
  };
  roads: Record<EdgeId, PlayerId>;
  buildings: Record<VertexId, Building>;
  bank: Record<CardType, number>;
  barbarian: { position: number; attacksResolved: number };
  titles: { longestRoad: PlayerId | null };
  turn: {
    activePlayerId: PlayerId;
    number: number;
    phase: Phase;
    lastRoll: DiceResult | null;
    setup: SetupProgress | null;
  };
  pending: PendingResolution[];
  proposals: Record<string, TradeProposal>;
  log: LogEntry[];
  /** commandId đã chấp nhận gần nhất (chống lặp). */
  processedCommandIds: string[];
  winner: PlayerId | null;
}
