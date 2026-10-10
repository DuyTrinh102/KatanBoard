import { CARD_TYPES, COMMODITIES, RESOURCES, getRuleset } from '../rules';
import { topologyOf } from './queries';
import type { GameState } from './state';

/** Invariants (test-plan §3). Trả về danh sách vi phạm; rỗng = hợp lệ. */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const rs = getRuleset(state.meta.config.rulesetId, state.meta.config.rulesetMode);
  const topo = topologyOf(state);
  const playerIds = Object.keys(state.players);

  // 1. Không âm.
  for (const t of CARD_TYPES) {
    if (state.bank[t] < 0) problems.push(`bank.${t} < 0`);
    for (const p of playerIds) if (state.players[p]!.hand[t] < 0) problems.push(`${p}.hand.${t} < 0`);
  }
  // 2. Bảo toàn từng loại lá.
  const expected = (t: string): number =>
    (RESOURCES as readonly string[]).includes(t) ? rs.bankResources.value : (COMMODITIES as readonly string[]).includes(t) ? rs.bankCommodities.value : 0;
  for (const t of CARD_TYPES) {
    const total = state.bank[t] + playerIds.reduce((s, p) => s + state.players[p]!.hand[t], 0);
    if (total !== expected(t)) problems.push(`bảo toàn ${t}: ${total} ≠ ${expected(t)}`);
  }
  // 4. Quân hợp lệ, owner tồn tại, stock khớp.
  for (const p of playerIds) {
    const st = state.players[p]!.stock;
    const roads = Object.values(state.roads).filter((o) => o === p).length;
    const settlements = Object.values(state.buildings).filter((b) => b.owner === p && b.kind === 'settlement').length;
    const cities = Object.values(state.buildings).filter((b) => b.owner === p && b.kind === 'city').length;
    if (st.roads + roads !== rs.stock.value.roads) problems.push(`${p} stock road lệch`);
    if (st.settlements + settlements !== rs.stock.value.settlements) problems.push(`${p} stock settlement lệch`);
    if (st.cities + cities !== rs.stock.value.cities) problems.push(`${p} stock city lệch`);
    if (st.roads < 0 || st.settlements < 0 || st.cities < 0) problems.push(`${p} stock âm`);
  }
  for (const [e, o] of Object.entries(state.roads)) {
    if (!topo.edgeVertices[e as keyof typeof topo.edgeVertices]) problems.push(`road trên edge lạ ${e}`);
    if (!state.players[o]) problems.push(`road owner lạ ${o}`);
  }
  for (const [v, b] of Object.entries(state.buildings)) {
    const vid = v as keyof typeof topo.vertexNeighbors;
    if (!topo.vertexHexes[vid]) problems.push(`công trình trên vertex lạ ${v}`);
    if (!state.players[b.owner]) problems.push(`owner lạ ${b.owner}`);
    for (const n of topo.vertexNeighbors[vid] ?? []) if (state.buildings[n]) problems.push(`vi phạm khoảng cách ${v}/${n}`);
  }
  if (!topo.hexVertices[state.board.robberHex]) problems.push('robber ngoài board');
  // 8. Không có pending mồ côi.
  for (const p of state.pending) {
    if (p.decisionOwnerIds.length === 0) problems.push(`pending ${p.id} không có người quyết định`);
    if (p.decisionOwnerIds.some((id) => !state.players[id])) problems.push(`pending ${p.id} owner lạ`);
  }
  if (state.pending.length > 0 && state.turn.phase !== 'ROLL_RESOLUTION') problems.push('pending ngoài ROLL_RESOLUTION');
  return problems;
}
