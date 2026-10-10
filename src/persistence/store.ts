import { openDB, type IDBPDatabase } from 'idb';
import type { SaveRecord } from './saveFile';

/** Interface lưu trữ — controller dùng interface này để test được bằng bộ nhớ. */
export interface GameStore {
  /** Chỉ resolve khi ghi bền vững thành công (transaction complete). */
  save(record: SaveRecord): Promise<void>;
  load(gameId: string): Promise<{ current: SaveRecord; previous: SaveRecord | null } | null>;
  list(): Promise<{ gameId: string; revision: number; savedAt: string; phase: string }[]>;
  remove(gameId: string): Promise<void>;
}

interface Row {
  readonly gameId: string;
  readonly current: SaveRecord;
  /** Bản tốt gần nhất trước đó (lastGood) để cứu hộ. */
  readonly previous: SaveRecord | null;
}

const DB_NAME = 'katanboard';
const STORE = 'catan-ck-saves';

export class IndexedDbGameStore implements GameStore {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'gameId' });
        },
      });
    }
    return this.dbPromise;
  }

  async save(record: SaveRecord): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    const existing = (await tx.store.get(record.gameId)) as Row | undefined;
    if (existing && existing.current.revision > record.revision) {
      tx.done.catch(() => undefined); // abort làm tx.done reject — đã xử lý bằng throw bên dưới
      tx.abort();
      throw new Error(`Từ chối ghi revision cũ ${record.revision} đè lên ${existing.current.revision}`);
    }
    const row: Row = { gameId: record.gameId, current: record, previous: existing?.current ?? null };
    await tx.store.put(row);
    await tx.done;
  }

  async load(gameId: string): Promise<{ current: SaveRecord; previous: SaveRecord | null } | null> {
    const db = await this.db();
    const row = (await db.get(STORE, gameId)) as Row | undefined;
    return row ? { current: row.current, previous: row.previous } : null;
  }

  async list(): Promise<{ gameId: string; revision: number; savedAt: string; phase: string }[]> {
    const db = await this.db();
    const rows = (await db.getAll(STORE)) as Row[];
    return rows
      .map((r) => ({ gameId: r.gameId, revision: r.current.revision, savedAt: r.current.savedAt, phase: r.current.state.turn.phase }))
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }

  async remove(gameId: string): Promise<void> {
    const db = await this.db();
    await db.delete(STORE, gameId);
  }
}

export class MemoryGameStore implements GameStore {
  private rows = new Map<string, Row>();
  failNext = false;

  async save(record: SaveRecord): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new DOMException('Quota exceeded (giả lập)', 'QuotaExceededError');
    }
    const existing = this.rows.get(record.gameId);
    this.rows.set(record.gameId, { gameId: record.gameId, current: structuredClone(record), previous: existing?.current ?? null });
  }
  async load(gameId: string) {
    const row = this.rows.get(gameId);
    return row ? { current: structuredClone(row.current), previous: row.previous } : null;
  }
  async list() {
    return [...this.rows.values()].map((r) => ({ gameId: r.gameId, revision: r.current.revision, savedAt: r.current.savedAt, phase: r.current.state.turn.phase }));
  }
  async remove(gameId: string) {
    this.rows.delete(gameId);
  }
}
