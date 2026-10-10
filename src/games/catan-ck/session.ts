import { applyCommand } from './engine/engine';
import type { Command, CommandBody, Rejection } from './engine/commands';
import type { GameState, PlayerId } from './engine/state';
import { makeSaveRecord, type SaveRecord } from '../../persistence/saveFile';
import type { GameStore } from '../../persistence/store';
import { newId as defaultNewId } from '../../shared/id';

export type DispatchResult =
  | { readonly ok: true; readonly duplicate: boolean }
  | ({ readonly ok: false } & Rejection)
  | { readonly ok: false; readonly code: 'STORAGE_BLOCKED' | 'READ_ONLY'; readonly publicReason: string };

export interface SessionSnapshot {
  readonly state: GameState;
  readonly storageError: string | null;
  readonly readOnly: boolean;
  readonly saving: boolean;
}

/**
 * Hàng đợi command tuần tự (architecture §7): validate → apply → ghi bền vững → phát snapshot.
 * Mọi mutation đi qua đây. Lỗi lưu → khóa mutation tiếp theo, giữ state để xuất file cứu hộ.
 */
export class GameSession {
  private state: GameState;
  private readonly commands: Command[];
  private queue: Promise<unknown> = Promise.resolve();
  private storageError: string | null = null;
  private saving = false;
  private listeners = new Set<(s: SessionSnapshot) => void>();

  constructor(
    private readonly initialState: GameState,
    commands: readonly Command[],
    state: GameState,
    private readonly store: GameStore,
    private readonly readOnly = false,
    private readonly newId: () => string = defaultNewId,
  ) {
    this.commands = [...commands];
    this.state = state;
  }

  static async create(initialState: GameState, store: GameStore): Promise<GameSession> {
    const s = new GameSession(initialState, [], initialState, store);
    await store.save(makeSaveRecord(initialState, [], initialState));
    return s;
  }

  static fromSave(save: SaveRecord, store: GameStore, readOnly = false): GameSession {
    return new GameSession(save.initialState, save.commands, save.state, store, readOnly);
  }

  snapshot(): SessionSnapshot {
    return { state: this.state, storageError: this.storageError, readOnly: this.readOnly, saving: this.saving };
  }

  subscribe(fn: (s: SessionSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  exportRecord(): SaveRecord {
    return makeSaveRecord(this.initialState, this.commands, this.state);
  }

  /**
   * Gửi command. `commandId` do UI sinh một lần cho mỗi thao tác xác nhận, để double tap
   * gửi cùng ID → không thực hiện hai lần.
   */
  dispatch(actorId: PlayerId, body: CommandBody, commandId: string = this.newId(), expectedRevision?: number): Promise<DispatchResult> {
    const run = async (): Promise<DispatchResult> => {
      if (this.readOnly) return { ok: false, code: 'READ_ONLY', publicReason: 'Ván đang được điều khiển ở tab khác' };
      if (this.storageError) return { ok: false, code: 'STORAGE_BLOCKED', publicReason: 'Không lưu được ván — gọi nhân viên để xuất file cứu hộ' };
      // Client từ xa (điện thoại) gửi revision nó đang thấy → engine từ chối STALE nếu bàn đã đổi.
      const cmd = { ...body, commandId, expectedRevision: expectedRevision ?? this.state.revision, actorId } as Command;
      const r = applyCommand(this.state, cmd);
      if (!r.ok) return r;
      if (r.duplicate) return { ok: true, duplicate: true };
      this.state = r.state;
      this.commands.push(cmd);
      this.saving = true;
      this.emit();
      try {
        await this.store.save(makeSaveRecord(this.initialState, this.commands, this.state));
      } catch (e) {
        this.storageError = `Lưu thất bại: ${(e as Error).message}`;
      } finally {
        this.saving = false;
        this.emit();
      }
      return { ok: true, duplicate: false };
    };
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
  }
}
