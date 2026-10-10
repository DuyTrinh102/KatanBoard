/**
 * Truy vấn thuần trên state — dùng CHUNG cho validate (engine) và getLegalActions (UI)
 * để điều kiện hiển thị nút và điều kiện engine luôn cùng nguồn.
 */
import { longestRoadLength } from '../board/longestRoad';
import { buildTopology, type EdgeId, type HexId, type Topology, type VertexId } from '../board/topology';
import { CARD_TYPES, getRuleset, type Bundle, type CardType, type Resource, type Ruleset } from '../rules';
import type { GameState, PlayerId } from './state';

export const topologyOf = (_state: GameState): Topology => buildTopology(2);

export const rulesetOf = (state: GameState): Ruleset =>
  getRuleset(state.meta.config.rulesetId, state.meta.config.rulesetMode);

export function handTotal(state: GameState, playerId: PlayerId): number {
  const hand = state.players[playerId]!.hand;
  return CARD_TYPES.reduce((s, t) => s + hand[t], 0);
}

export function bundleEntries(b: Bundle): [CardType, number][] {
  return (Object.entries(b) as [CardType, number][]).filter(([, n]) => n > 0);
}

export function bundleSize(b: Bundle): number {
  return bundleEntries(b).reduce((s, [, n]) => s + n, 0);
}

export function isValidBundle(b: unknown): b is Bundle {
  if (typeof b !== 'object' || b === null) return false;
  return Object.entries(b).every(
    ([k, n]) => (CARD_TYPES as readonly string[]).includes(k) && Number.isInteger(n) && (n as number) >= 0,
  );
}

/** Thiếu gì so với bundle; rỗng nếu đủ. */
export function missingFor(state: GameState, playerId: PlayerId, cost: Bundle): Bundle {
  const hand = state.players[playerId]!.hand;
  const missing: Bundle = {};
  for (const [t, n] of bundleEntries(cost)) if (hand[t] < n) missing[t] = n - hand[t];
  return missing;
}

export function hasBundle(state: GameState, playerId: PlayerId, cost: Bundle): boolean {
  return bundleSize(missingFor(state, playerId, cost)) === 0;
}

export function vertexFree(state: GameState, v: VertexId): boolean {
  return state.buildings[v] === undefined;
}

/** Luật khoảng cách (BRD-002). */
export function distanceRuleOk(state: GameState, v: VertexId): boolean {
  const topo = topologyOf(state);
  return (topo.vertexNeighbors[v] ?? []).every((n) => state.buildings[n] === undefined);
}

export function isSetupBuildingSpot(state: GameState, v: VertexId): boolean {
  const topo = topologyOf(state);
  return topo.vertexHexes[v] !== undefined && vertexFree(state, v) && distanceRuleOk(state, v);
}

export function isSetupRoadSpot(state: GameState, e: EdgeId): boolean {
  const topo = topologyOf(state);
  const last = state.turn.setup?.lastVertex;
  const ends = topo.edgeVertices[e];
  return ends !== undefined && last != null && state.roads[e] === undefined && ends.includes(last);
}

/** Road nối với mạng của người chơi (BRD-003): qua công trình của mình, hoặc road của mình tại vertex không bị đối thủ chiếm. */
export function isRoadSpot(state: GameState, playerId: PlayerId, e: EdgeId): boolean {
  const topo = topologyOf(state);
  const ends = topo.edgeVertices[e];
  if (!ends || state.roads[e] !== undefined) return false;
  return ends.some((v) => {
    const b = state.buildings[v];
    if (b) return b.owner === playerId;
    return (topo.vertexEdges[v] ?? []).some((other) => other !== e && state.roads[other] === playerId);
  });
}

export function isSettlementSpot(state: GameState, playerId: PlayerId, v: VertexId): boolean {
  const topo = topologyOf(state);
  if (!topo.vertexHexes[v] || !vertexFree(state, v) || !distanceRuleOk(state, v)) return false;
  return (topo.vertexEdges[v] ?? []).some((e) => state.roads[e] === playerId);
}

export function isCitySpot(state: GameState, playerId: PlayerId, v: VertexId): boolean {
  const b = state.buildings[v];
  return b !== undefined && b.owner === playerId && b.kind === 'settlement';
}

export function legalSetupBuildingSpots(state: GameState): VertexId[] {
  return topologyOf(state).vertices.filter((v) => isSetupBuildingSpot(state, v));
}
export function legalSetupRoadSpots(state: GameState): EdgeId[] {
  return topologyOf(state).edges.filter((e) => isSetupRoadSpot(state, e));
}
export function legalRoadSpots(state: GameState, p: PlayerId): EdgeId[] {
  return topologyOf(state).edges.filter((e) => isRoadSpot(state, p, e));
}
export function legalSettlementSpots(state: GameState, p: PlayerId): VertexId[] {
  return topologyOf(state).vertices.filter((v) => isSettlementSpot(state, p, v));
}
export function legalCitySpots(state: GameState, p: PlayerId): VertexId[] {
  return topologyOf(state).vertices.filter((v) => isCitySpot(state, p, v));
}

/** Tỷ lệ đổi với ngân hàng hiệu lực cho loại `give` (TRD-003). */
export function bankRatio(state: GameState, playerId: PlayerId, give: CardType): number {
  const ratios = rulesetOf(state).tradeRatios.value;
  let best = ratios.bank;
  for (const h of state.board.harbors) {
    const owns = h.vertices.some((v) => state.buildings[v]?.owner === playerId);
    if (!owns) continue;
    if (h.kind === 'generic') best = Math.min(best, ratios.generic);
    else if (h.kind === (give as Resource)) best = Math.min(best, ratios.specific);
  }
  return best;
}

export function robberActive(state: GameState): boolean {
  const rs = rulesetOf(state);
  return !rs.robberInactiveUntilFirstAttack.value || state.barbarian.attacksResolved > 0;
}

/** Người có thể bị cướp khi robber vào hex (có công trình kề và có bài). */
export function robberVictims(state: GameState, hex: HexId, thief: PlayerId): PlayerId[] {
  const topo = topologyOf(state);
  const owners = new Set<PlayerId>();
  for (const v of topo.hexVertices[hex] ?? []) {
    const b = state.buildings[v];
    if (b && b.owner !== thief && handTotal(state, b.owner) > 0) owners.add(b.owner);
  }
  return [...owners].sort();
}

export interface ScoreBreakdown {
  readonly settlements: number;
  readonly cities: number;
  readonly longestRoad: number;
  readonly total: number;
}

export function computeScore(state: GameState): Record<PlayerId, ScoreBreakdown> {
  const rs = rulesetOf(state);
  const out: Record<PlayerId, ScoreBreakdown> = {};
  for (const pid of Object.keys(state.players)) {
    let settlements = 0;
    let cities = 0;
    for (const b of Object.values(state.buildings)) {
      if (b.owner !== pid) continue;
      if (b.kind === 'settlement') settlements += rs.buildingPoints.value.settlement;
      else cities += rs.buildingPoints.value.city;
    }
    const longestRoad = state.titles.longestRoad === pid ? rs.longestRoadPoints.value : 0;
    out[pid] = { settlements, cities, longestRoad, total: settlements + cities + longestRoad };
  }
  return out;
}

export function roadLengths(state: GameState): Record<PlayerId, number> {
  const topo = topologyOf(state);
  const occupants: Record<VertexId, string> = {};
  for (const [v, b] of Object.entries(state.buildings) as [VertexId, { owner: string }][]) occupants[v] = b.owner;
  const out: Record<PlayerId, number> = {};
  for (const pid of Object.keys(state.players)) out[pid] = longestRoadLength(topo, state.roads, occupants, pid);
  return out;
}
