import { describe, expect, it } from 'vitest';
import { CK2025_UNVERIFIED } from '../../src/games/catan-ck/rules/ck2025';
import { DEV_RULESET_ID, assertStandardPreset, getRuleset, listUnverified } from '../../src/games/catan-ck/rules';
import { createGame } from '../../src/games/catan-ck/engine';
import { makeConfig } from './helpers';

describe('rules-data provenance (rules-spec §10)', () => {
  it('mọi giá trị đều có ruleId, source, status, evidence', () => {
    for (const [k, v] of Object.entries(CK2025_UNVERIFIED)) {
      if (k === 'id' || k === 'label') continue;
      expect(v, k).toHaveProperty('ruleId');
      expect(v, k).toHaveProperty('source');
      expect(['VERIFIED', 'UNRESOLVED']).toContain((v as { status: string }).status);
      expect(['P', 'S', 'M']).toContain((v as { evidence: string }).evidence);
    }
  });

  it('VERIFIED chỉ được đi kèm evidence P', () => {
    for (const v of Object.values(CK2025_UNVERIFIED)) {
      if (typeof v === 'object' && v && 'status' in v && v.status === 'VERIFIED') expect(v.evidence).toBe('P');
    }
  });

  it('preset chuẩn bị chặn khi còn giá trị UNRESOLVED', () => {
    expect(listUnverified(CK2025_UNVERIFIED).length).toBeGreaterThan(0);
    expect(() => assertStandardPreset(CK2025_UNVERIFIED)).toThrow(/chưa VERIFIED/);
    expect(() => getRuleset(DEV_RULESET_ID, 'standard')).toThrow();
    expect(() => createGame({ ...makeConfig(3), rulesetMode: 'standard' }, 1, 'g')).toThrow();
  });

  it('dev preset dùng được khi gắn nhãn rõ', () => {
    expect(getRuleset(DEV_RULESET_ID, 'dev-unverified').label).toMatch(/CHƯA KIỂM CHỨNG/);
  });
});
