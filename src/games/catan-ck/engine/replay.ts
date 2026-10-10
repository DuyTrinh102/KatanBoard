import type { Command } from './commands';
import { applyCommand } from './engine';
import type { GameState } from './state';

/** replay(initialState, log) phải ra đúng state — không phụ thuộc animation hay wall clock. */
export function replay(initial: GameState, commands: readonly Command[]): GameState {
  let state = initial;
  for (const cmd of commands) {
    const r = applyCommand(state, cmd);
    if (!r.ok) throw new Error(`Replay thất bại tại ${cmd.commandId} (${cmd.type}): ${r.code}`);
    state = r.state;
  }
  return state;
}
