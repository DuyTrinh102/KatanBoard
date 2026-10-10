import { mkdir, readFile, readdir, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { SaveRecord } from '../src/persistence/saveFile';
import type { GameStore } from '../src/persistence/store';
import type { SeatStore } from '../src/remote/hub';

const safe = (id: string) => {
  if (!/^[\w-]{1,80}$/.test(id)) throw new Error(`gameId không hợp lệ: ${id}`);
  return id;
};

/** Ghi nguyên tử: ghi file tạm rồi rename (không để file hỏng khi mất điện giữa chừng). */
async function atomicWrite(path: string, data: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data, 'utf8');
  await rename(tmp, path);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Lưu ván trên đĩa của máy chủ quán: <id>.json (hiện tại) + <id>.prev.json (bản tốt trước). */
export class FileGameStore implements GameStore {
  constructor(private readonly dir: string) {}

  private async ready() {
    await mkdir(this.dir, { recursive: true });
  }

  async save(record: SaveRecord): Promise<void> {
    await this.ready();
    const id = safe(record.gameId);
    const cur = join(this.dir, `${id}.json`);
    const existing = await readJson<SaveRecord>(cur);
    if (existing && existing.revision > record.revision) {
      throw new Error(`Từ chối ghi revision cũ ${record.revision} đè lên ${existing.revision}`);
    }
    if (existing) await atomicWrite(join(this.dir, `${id}.prev.json`), JSON.stringify(existing));
    await atomicWrite(cur, JSON.stringify(record));
  }

  async load(gameId: string) {
    const id = safe(gameId);
    const current = await readJson<SaveRecord>(join(this.dir, `${id}.json`));
    if (!current) return null;
    return { current, previous: await readJson<SaveRecord>(join(this.dir, `${id}.prev.json`)) };
  }

  async list() {
    await this.ready();
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json') && !f.endsWith('.prev.json') && !f.endsWith('.seats.json'));
    const out: { gameId: string; revision: number; savedAt: string; phase: string }[] = [];
    for (const f of files) {
      const r = await readJson<SaveRecord>(join(this.dir, f));
      if (r) out.push({ gameId: r.gameId, revision: r.revision, savedAt: r.savedAt, phase: r.state.turn.phase });
    }
    return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }

  async remove(gameId: string) {
    const id = safe(gameId);
    for (const suffix of ['.json', '.prev.json', '.seats.json']) await rm(join(this.dir, `${id}${suffix}`), { force: true });
  }
}

export class FileSeatStore implements SeatStore {
  constructor(private readonly dir: string) {}
  async save(gameId: string, seats: Record<string, string>) {
    await mkdir(this.dir, { recursive: true });
    await atomicWrite(join(this.dir, `${safe(gameId)}.seats.json`), JSON.stringify(seats));
  }
  async load(gameId: string) {
    return readJson<Record<string, string>>(join(this.dir, `${safe(gameId)}.seats.json`));
  }
}
