import type { HexId } from '../board/topology';
import type { Command, CommandBody, CommandType } from './commands';
import { validateCommand } from './engine';
import {
  legalCitySpots,
  legalRoadSpots,
  legalSettlementSpots,
  legalSetupBuildingSpots,
  legalSetupRoadSpots,
  topologyOf,
} from './queries';
import type { GameState, PlayerId } from './state';

export interface LegalAction {
  readonly type: CommandType;
  readonly enabled: boolean;
  /** Lý do khóa an toàn công khai. */
  readonly reason?: string;
  /** Lý do chi tiết (chỉ hiển thị trong private session). */
  readonly privateReason?: string;
  /** ID vertex/edge/hex hợp lệ để chọn (nếu hành động cần target). */
  readonly targets?: readonly string[];
}

/**
 * Hành động hợp lệ cho một người — UI dùng để bật/tắt nút và tô target.
 * Dùng chính validateCommand với command thăm dò, nên điều kiện UI và engine luôn cùng nguồn.
 */
export function getLegalActions(state: GameState, actorId: PlayerId): LegalAction[] {
  const probe = (body: CommandBody): Command => ({ ...body, commandId: '__probe__', expectedRevision: state.revision, actorId }) as Command;
  const check = (type: CommandType, body: CommandBody | null, targets?: readonly string[], noTargetReason?: string): LegalAction => {
    if (body === null) {
      // Không có target hợp lệ: vẫn ưu tiên báo lý do chung (lượt/phase/tài nguyên) nếu có.
      return { type, enabled: false, reason: noTargetReason ?? 'Không có vị trí hợp lệ', targets: [] };
    }
    const v = validateCommand(state, probe(body));
    if (v.ok) return { type, enabled: true, ...(targets ? { targets } : {}) };
    return { type, enabled: false, reason: v.publicReason, ...(v.privateReason ? { privateReason: v.privateReason } : {}), ...(targets ? { targets: [] } : {}) };
  };

  const out: LegalAction[] = [];
  const phase = state.turn.phase;
  const head = state.pending[0];

  if (phase === 'SETUP') {
    const b = legalSetupBuildingSpots(state);
    const r = legalSetupRoadSpots(state);
    out.push(check('placeSetupBuilding', b[0] ? { type: 'placeSetupBuilding', vertex: b[0] } : null, b));
    out.push(check('placeSetupRoad', r[0] ? { type: 'placeSetupRoad', edge: r[0] } : null, r));
    return out;
  }

  if (head?.kind === 'discard') {
    const enabled = head.decisionOwnerIds.includes(actorId);
    out.push({ type: 'submitDiscard', enabled, ...(enabled ? {} : { reason: 'Không cần bỏ bài' }) });
  }
  if (head?.kind === 'moveRobber') {
    const enabled = head.decisionOwnerIds.includes(actorId);
    const hexes = enabled ? topologyOf(state).hexes.filter((h: HexId) => h !== state.board.robberHex) : [];
    out.push({ type: 'moveRobber', enabled, targets: hexes, ...(enabled ? {} : { reason: 'Không phải người di chuyển robber' }) });
  }

  out.push(check('rollDice', { type: 'rollDice' }));

  // Chỉ tính target khi người này có thể đang trong action phase (tránh tính thừa).
  const mainPhaseGate = validateCommand(state, probe({ type: 'endTurn' }));
  const spots = (fn: () => string[]): string[] => (mainPhaseGate.ok ? fn() : []);
  const roads = spots(() => legalRoadSpots(state, actorId));
  const settlements = spots(() => legalSettlementSpots(state, actorId));
  const cities = spots(() => legalCitySpots(state, actorId));
  const gateOr = (body: CommandBody | null): CommandBody | null => (mainPhaseGate.ok ? body : { type: 'endTurn' });

  out.push(check('buildRoad', gateOr(roads[0] ? { type: 'buildRoad', edge: roads[0] as never } : null), roads, 'Không có vị trí đặt đường'));
  out.push(check('buildSettlement', gateOr(settlements[0] ? { type: 'buildSettlement', vertex: settlements[0] as never } : null), settlements, 'Không có vị trí settlement hợp lệ'));
  out.push(check('buildCity', gateOr(cities[0] ? { type: 'buildCity', vertex: cities[0] as never } : null), cities, 'Không có settlement để nâng cấp'));
  // bank/propose: khả dụng khi đúng phase; chi tiết loại lá kiểm tra lúc gửi.
  out.push({ type: 'bankTrade', enabled: mainPhaseGate.ok, ...(mainPhaseGate.ok ? {} : { reason: mainPhaseGate.publicReason }) });
  out.push({ type: 'proposeTrade', enabled: mainPhaseGate.ok, ...(mainPhaseGate.ok ? {} : { reason: mainPhaseGate.publicReason }) });
  out.push(check('endTurn', { type: 'endTurn' }));
  return out;
}

export function findAction(actions: readonly LegalAction[], type: CommandType): LegalAction | undefined {
  return actions.find((a) => a.type === type);
}
