import type { EdgeId, HexId, VertexId } from '../board/topology';
import type { Bundle, CardType } from '../rules';
import type { PlayerId } from './state';

export type CommandBody =
  | { type: 'placeSetupBuilding'; vertex: VertexId }
  | { type: 'placeSetupRoad'; edge: EdgeId }
  | { type: 'rollDice' }
  | { type: 'submitDiscard'; pendingId: string; cards: Bundle }
  | { type: 'moveRobber'; pendingId: string; hex: HexId; victim: PlayerId | null }
  | { type: 'buildRoad'; edge: EdgeId }
  | { type: 'buildSettlement'; vertex: VertexId }
  | { type: 'buildCity'; vertex: VertexId }
  | { type: 'bankTrade'; give: CardType; get: CardType }
  | { type: 'proposeTrade'; to: PlayerId[]; offer: Bundle; request: Bundle }
  | { type: 'updateTrade'; proposalId: string; to: PlayerId[]; offer: Bundle; request: Bundle }
  | { type: 'respondTrade'; proposalId: string; revision: number; response: 'accept' | 'reject' }
  | { type: 'confirmTrade'; proposalId: string; revision: number; partner: PlayerId }
  | { type: 'cancelTrade'; proposalId: string }
  | { type: 'endTurn' };

export type CommandType = CommandBody['type'];

export type Command = CommandBody & {
  /** ID duy nhất do UI sinh; command lặp lại không đổi state. */
  readonly commandId: string;
  /** Revision mà UI đang thấy; lệch → STALE. */
  readonly expectedRevision: number;
  readonly actorId: PlayerId;
};

export type RejectionCode =
  | 'GAME_OVER'
  | 'UNKNOWN_PLAYER'
  | 'STALE'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'PENDING_RESOLUTION'
  | 'NOT_DECISION_OWNER'
  | 'INVALID_TARGET'
  | 'INSUFFICIENT_RESOURCES'
  | 'NO_STOCK'
  | 'BANK_EMPTY'
  | 'INVALID_TRADE'
  | 'STALE_PROPOSAL'
  | 'INVALID_INPUT';

export interface Rejection {
  readonly code: RejectionCode;
  /** Lý do an toàn để hiển thị công khai (không lộ bài). */
  readonly publicReason: string;
  /** Lý do chi tiết, chỉ hiện trong private session của người thao tác. */
  readonly privateReason?: string;
}

export type ValidationResult = { readonly ok: true } | ({ readonly ok: false } & Rejection);
