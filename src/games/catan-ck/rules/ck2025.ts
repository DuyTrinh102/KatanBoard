import type { RuleStatus, RuleValue, Ruleset, Evidence } from './types';

/**
 * Dữ liệu luật cho baseline CATAN 2025 (CN3081) + Cities & Knights 2025 (CN3087).
 *
 * TẤT CẢ giá trị hiện là UNRESOLVED: rulebook 2025 chưa đọc được (xem docs/catan-ck/rules-spec.md §1).
 * Giá trị là "ứng viên" (evidence M = hiểu biết edition cũ, S = nguồn thứ cấp). Preset này chỉ dùng
 * ở chế độ phát triển có nhãn rõ; preset chuẩn bị chặn bởi `assertStandardPreset`.
 */
const u = <T>(ruleId: string, value: T, evidence: Evidence, source: string): RuleValue<T> => ({
  value,
  ruleId,
  status: 'UNRESOLVED' as RuleStatus,
  evidence,
  source,
});

const BASE = 'SRC-BASE25 (chưa đọc)';
const CK = 'SRC-CK25 (chưa đọc)';

export const CK2025_UNVERIFIED: Ruleset = {
  id: 'catan-base-2025+ck-2025/unverified-dev',
  label: 'CATAN + Cities & Knights 2025 — dữ liệu CHƯA KIỂM CHỨNG (dev)',
  players: u('SET-001', { min: 3, max: 4 }, 'S', CK),
  terrainCounts: u('SET-002', { forest: 4, pasture: 4, fields: 4, hills: 3, mountains: 3, desert: 1 }, 'M', BASE),
  numberTokens: u('SET-003', [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12], 'M', BASE),
  redNumbersNotAdjacent: u('SET-004', [6, 8], 'M', BASE),
  harbors: u('SET-005', ['generic', 'wool', 'generic', 'ore', 'generic', 'grain', 'brick', 'generic', 'lumber'], 'M', BASE),
  bankResources: u('SET-006', 19, 'M', BASE),
  bankCommodities: u('SET-007', 12, 'S', CK),
  stock: u('SET-008', { roads: 15, settlements: 5, cities: 4 }, 'M', BASE),
  setupSecondBuilding: u('SET-011', 'city', 'M', CK),
  startingYieldFromSecond: u('SET-012', true, 'M', CK),
  robberStart: u('SET-014', 'desert', 'M', BASE),
  eventFaces: u('TRN-002', ['ship', 'ship', 'ship', 'gate:science', 'gate:trade', 'gate:politics'], 'M', CK),
  terrainResource: u('PRD-001', { forest: 'lumber', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' }, 'M', BASE),
  cityYield: u(
    'PRD-002',
    {
      fields: { resource: 2 },
      hills: { resource: 2 },
      forest: { resource: 1, commodity: 'paper' },
      pasture: { resource: 1, commodity: 'cloth' },
      mountains: { resource: 1, commodity: 'coin' },
    },
    'M',
    CK,
  ),
  bankShortage: u('PRD-003', 'none-unless-single-recipient', 'M', BASE),
  handLimit: u('PRD-005', 7, 'M', BASE),
  robberInactiveUntilFirstAttack: u('PRD-007', true, 'M', CK),
  costs: u(
    'CON-001..003',
    {
      road: { brick: 1, lumber: 1 },
      settlement: { brick: 1, lumber: 1, wool: 1, grain: 1 },
      city: { grain: 2, ore: 3 },
    },
    'M',
    BASE,
  ),
  tradeRatios: u('TRD-003', { bank: 4, generic: 3, specific: 2 }, 'M', BASE),
  longestRoadMin: u('SCO-002', 5, 'M', BASE),
  longestRoadPoints: u('SCO-002', 2, 'M', BASE),
  buildingPoints: u('SCO-001', { settlement: 1, city: 2 }, 'M', BASE),
  victoryTarget: u('SCO-006', 13, 'S', CK),
  winOnlyOnOwnTurn: u('SCO-007', true, 'M', CK),
};
