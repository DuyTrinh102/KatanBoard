import { CK2025_UNVERIFIED } from './ck2025';
import type { RuleValue, Ruleset } from './types';

export * from './types';

export type RulesetMode = 'standard' | 'dev-unverified';

export interface ProvenanceIssue {
  readonly key: string;
  readonly ruleId: string;
  readonly status: string;
}

function isRuleValue(x: unknown): x is RuleValue<unknown> {
  return typeof x === 'object' && x !== null && 'ruleId' in x && 'status' in x && 'value' in x;
}

/** Liệt kê mọi giá trị chưa VERIFIED (hoặc thiếu provenance) trong ruleset. */
export function listUnverified(ruleset: Ruleset): ProvenanceIssue[] {
  const issues: ProvenanceIssue[] = [];
  for (const [key, val] of Object.entries(ruleset)) {
    if (key === 'id' || key === 'label') continue;
    if (!isRuleValue(val)) {
      issues.push({ key, ruleId: '?', status: 'MISSING_PROVENANCE' });
    } else if (val.status !== 'VERIFIED') {
      issues.push({ key, ruleId: val.ruleId, status: val.status });
    }
  }
  return issues;
}

/** Preset chuẩn không được chứa giá trị chưa kiểm chứng (rules-spec §10 bước 3). */
export function assertStandardPreset(ruleset: Ruleset): void {
  const issues = listUnverified(ruleset);
  if (issues.length > 0) {
    throw new Error(
      `Ruleset ${ruleset.id} có ${issues.length} giá trị chưa VERIFIED (ví dụ ${issues[0]!.ruleId}); không thể dùng làm preset chuẩn.`,
    );
  }
}

const RULESETS: Record<string, Ruleset> = { [CK2025_UNVERIFIED.id]: CK2025_UNVERIFIED };

export const DEV_RULESET_ID = CK2025_UNVERIFIED.id;

export function getRuleset(id: string, mode: RulesetMode): Ruleset {
  const rs = RULESETS[id];
  if (!rs) throw new Error(`Không có ruleset ${id}`);
  if (mode === 'standard') assertStandardPreset(rs);
  return rs;
}

export function isRulesetVerified(ruleset: Ruleset): boolean {
  return listUnverified(ruleset).length === 0;
}
