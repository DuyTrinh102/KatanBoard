import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PURE_DIRS = ['engine', 'board', 'rules', 'cards', 'projections'].map((d) => join('src/games/catan-ck', d));

function files(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  } catch {
    return [];
  }
}

describe('ranh giới kiến trúc (architecture §2)', () => {
  it('engine/board/rules/cards/projections không import React, DOM hay persistence; không dùng Math.random/Date', () => {
    for (const f of PURE_DIRS.flatMap(files)) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from ['"]react/);
      expect(src, f).not.toMatch(/from ['"].*\/(ui|persistence|table|app)\//);
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date\(|window\.|document\./);
    }
  });
});
