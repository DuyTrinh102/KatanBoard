import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeSaveRecord, parseSaveJson, validateSave } from '../../src/persistence/saveFile';
import { IndexedDbGameStore, MemoryGameStore } from '../../src/persistence/store';
import { GameSession } from '../../src/games/catan-ck/session';
import { randomPlaythrough } from './driver';
import { newGame } from './helpers';

describe('T-PER save/load', () => {
  it('IndexedDB: lưu, đọc lại đúng state; giữ bản trước (lastGood); từ chối ghi đè bằng revision cũ', async () => {
    const store = new IndexedDbGameStore();
    const { initial, commands, state } = randomPlaythrough(3, 3, 300);
    const half = randomPlaythrough(3, 3, 150);
    await store.save(makeSaveRecord(initial, half.commands, half.state));
    await store.save(makeSaveRecord(initial, commands, state));
    const loaded = await store.load(state.meta.gameId);
    expect(loaded!.current.state).toEqual(state);
    expect(loaded!.previous!.revision).toBe(half.state.revision);
    await expect(store.save(makeSaveRecord(initial, half.commands, half.state))).rejects.toThrow(/revision cũ/);
    const list = await store.list();
    expect(list.map((x) => x.gameId)).toContain(state.meta.gameId);
  });

  it('export/import: file hợp lệ qua kiểm chứng replay; file bị sửa bị từ chối', () => {
    const { initial, commands, state } = randomPlaythrough(4, 4, 400);
    const json = JSON.stringify(makeSaveRecord(initial, commands, state));
    expect(parseSaveJson(json).ok).toBe(true);

    const tampered = JSON.parse(json);
    tampered.state.players.p1.hand.ore += 5;
    tampered.state.bank.ore -= 5;
    const r = validateSave(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Replay/);

    expect(parseSaveJson('{not json').ok).toBe(false);
    expect(validateSave({ format: 'khác' }).ok).toBe(false);
    const wrongVersion = JSON.parse(json);
    wrongVersion.schemaVersion = 999;
    const v = validateSave(wrongVersion);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/migration/);
  });
});

describe('GameSession: hàng đợi tuần tự, persist, lỗi lưu', () => {
  it('reload giữa ván cho đúng state và không tung lại xúc xắc', async () => {
    const store = new MemoryGameStore();
    const { initial, commands } = randomPlaythrough(5, 3, 60);
    const session = await GameSession.create(initial, store);
    for (const c of commands) {
      const { commandId, expectedRevision: _r, actorId, ...body } = c;
      const r = await session.dispatch(actorId, body as never, commandId);
      expect(r.ok).toBe(true);
    }
    const saved = await store.load(initial.meta.gameId);
    const resumed = GameSession.fromSave(saved!.current, store);
    expect(resumed.snapshot().state).toEqual(session.snapshot().state);
    expect(resumed.snapshot().state.turn.lastRoll).toEqual(session.snapshot().state.turn.lastRoll);
  });

  it('double tap cùng commandId song song chỉ thực hiện một lần', async () => {
    const store = new MemoryGameStore();
    const { initial, commands } = randomPlaythrough(5, 3, 1);
    const session = await GameSession.create(initial, store);
    const c = commands[0]!;
    const { commandId, expectedRevision: _r, actorId, ...body } = c;
    const [a, b] = await Promise.all([session.dispatch(actorId, body as never, commandId), session.dispatch(actorId, body as never, commandId)]);
    expect(a).toEqual({ ok: true, duplicate: false });
    expect(b).toEqual({ ok: true, duplicate: true });
    expect(session.snapshot().state.revision).toBe(1);
  });

  it('lưu thất bại → khóa mutation tiếp theo, giữ state để xuất cứu hộ', async () => {
    const store = new MemoryGameStore();
    const initial = newGame(9, 3);
    const session = await GameSession.create(initial, store);
    const { commands } = randomPlaythrough(9, 3, 3);
    store.failNext = true;
    const [c1, c2] = commands;
    const strip = (c: typeof c1) => {
      const { commandId, expectedRevision: _r, actorId, ...body } = c!;
      return { commandId, actorId, body };
    };
    const x = strip(c1);
    await session.dispatch(x.actorId, x.body as never, x.commandId);
    expect(session.snapshot().storageError).toMatch(/Lưu thất bại/);
    const y = strip(c2);
    const r = await session.dispatch(y.actorId, y.body as never, y.commandId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STORAGE_BLOCKED');
    expect(validateSave(session.exportRecord()).ok).toBe(true);
  });

  it('tab chỉ đọc không gửi được command', async () => {
    const store = new MemoryGameStore();
    const initial = newGame(9, 3);
    await store.save(makeSaveRecord(initial, [], initial));
    const ro = GameSession.fromSave((await store.load(initial.meta.gameId))!.current, store, true);
    const r = await ro.dispatch('p1', { type: 'endTurn' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('READ_ONLY');
  });
});
