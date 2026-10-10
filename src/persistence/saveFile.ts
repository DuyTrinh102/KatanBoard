import { z } from 'zod';
import { checkInvariants } from '../games/catan-ck/engine/invariants';
import { replay } from '../games/catan-ck/engine/replay';
import { SCHEMA_VERSION, type GameState } from '../games/catan-ck/engine/state';
import type { Command } from '../games/catan-ck/engine/commands';

export const SAVE_FORMAT = 'katanboard-catan-ck-save';

/** Bản ghi lưu: đủ để replay và kiểm chứng (architecture §10). */
export interface SaveRecord {
  readonly format: typeof SAVE_FORMAT;
  readonly schemaVersion: number;
  readonly gameId: string;
  readonly rulesetId: string;
  readonly revision: number;
  readonly savedAt: string;
  readonly initialState: GameState;
  readonly commands: readonly Command[];
  readonly state: GameState;
}

const stateShape = z
  .object({
    meta: z.object({
      gameId: z.string(),
      schemaVersion: z.number().int(),
      rulesetId: z.string(),
      config: z.object({
        rulesetId: z.string(),
        rulesetMode: z.enum(['standard', 'dev-unverified']),
        players: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), icon: z.string(), seat: z.enum(['B', 'T', 'L', 'R']) })),
        turnOrder: z.array(z.string()),
        openTable: z.boolean(),
      }),
    }),
    revision: z.number().int().nonnegative(),
    rng: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    players: z.record(z.string(), z.object({ id: z.string(), hand: z.record(z.string(), z.number().int()), stock: z.object({ roads: z.number(), settlements: z.number(), cities: z.number() }) })),
    turn: z.object({ activePlayerId: z.string(), number: z.number().int(), phase: z.enum(['SETUP', 'PRE_ROLL', 'ROLL_RESOLUTION', 'ACTION', 'GAME_OVER']) }).loose(),
    pending: z.array(z.object({ id: z.string(), kind: z.enum(['discard', 'moveRobber']) }).loose()),
    log: z.array(z.unknown()),
  })
  .loose();

const saveShape = z.object({
  format: z.literal(SAVE_FORMAT),
  schemaVersion: z.number().int(),
  gameId: z.string().min(1),
  rulesetId: z.string(),
  revision: z.number().int().nonnegative(),
  savedAt: z.string(),
  initialState: stateShape,
  commands: z.array(z.object({ commandId: z.string(), expectedRevision: z.number().int(), actorId: z.string(), type: z.string() }).loose()),
  state: stateShape,
});

export function makeSaveRecord(initialState: GameState, commands: readonly Command[], state: GameState, now: Date = new Date()): SaveRecord {
  return {
    format: SAVE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    gameId: state.meta.gameId,
    rulesetId: state.meta.rulesetId,
    revision: state.revision,
    savedAt: now.toISOString(),
    initialState,
    commands,
    state,
  };
}

export type ValidatedSave = { readonly ok: true; readonly save: SaveRecord } | { readonly ok: false; readonly error: string };

/**
 * Kiểm tra file nhập: schema → version → invariants → replay khớp state.
 * Không ghi gì; người gọi phải hỏi xác nhận trước khi ghi đè ván hiện tại.
 */
export function validateSave(raw: unknown): ValidatedSave {
  const parsed = saveShape.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `Sai định dạng file lưu: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}` };
  const save = parsed.data as unknown as SaveRecord;
  if (save.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: `Phiên bản lưu ${save.schemaVersion} chưa có migration sang ${SCHEMA_VERSION}. File được giữ nguyên.` };
  }
  if (save.state.meta.gameId !== save.gameId || save.state.revision !== save.revision) {
    return { ok: false, error: 'Thông tin đầu file không khớp state' };
  }
  try {
    const problems = checkInvariants(save.state);
    if (problems.length > 0) return { ok: false, error: `State vi phạm invariant: ${problems[0]}` };
    const replayed = replay(save.initialState, save.commands);
    if (JSON.stringify(replayed) !== JSON.stringify(save.state)) {
      return { ok: false, error: 'Replay từ log không ra đúng state đã lưu' };
    }
  } catch (e) {
    return { ok: false, error: `Không kiểm chứng được file: ${(e as Error).message}` };
  }
  return { ok: true, save };
}

export function parseSaveJson(json: string): ValidatedSave {
  try {
    return validateSave(JSON.parse(json));
  } catch {
    return { ok: false, error: 'File không phải JSON hợp lệ' };
  }
}
