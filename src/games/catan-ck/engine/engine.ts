import { createRandomSource, seedRng, type RandomSource } from '../../../shared/random';
import { generateRandomBoard } from '../board/layout';
import { resolveLongestRoadHolder } from '../board/longestRoad';
import type { EdgeId, VertexId } from '../board/topology';
import { CARD_TYPES, COMMODITIES, RESOURCES, getRuleset, type Bundle, type CardType, type Ruleset } from '../rules';
import type { Command, Rejection, ValidationResult } from './commands';
import { checkInvariants } from './invariants';
import {
  bankRatio,
  bundleEntries,
  bundleSize,
  computeScore,
  handTotal,
  hasBundle,
  isCitySpot,
  isRoadSpot,
  isSettlementSpot,
  isSetupBuildingSpot,
  isSetupRoadSpot,
  isValidBundle,
  missingFor,
  roadLengths,
  robberActive,
  robberVictims,
  rulesetOf,
  topologyOf,
} from './queries';
import { SCHEMA_VERSION, type GameConfig, type GameState, type PlayerId } from './state';
import { describeBundle } from './text';

export interface TransitionOk {
  readonly ok: true;
  readonly state: GameState;
  /** true nếu commandId đã xử lý trước đó — state không đổi. */
  readonly duplicate: boolean;
}
export type TransitionResult = TransitionOk | ({ readonly ok: false } & Rejection);

export type RandomFactory = (state: GameState) => RandomSource;
const defaultRandom: RandomFactory = (s) => createRandomSource(s.rng);

const MAX_PROCESSED_IDS = 500;

const emptyHand = (): Record<CardType, number> =>
  Object.fromEntries(CARD_TYPES.map((t) => [t, 0])) as Record<CardType, number>;

// ───────────────────────────── create ─────────────────────────────

export function createGame(config: GameConfig, seed: number, gameId: string): GameState {
  const rs = getRuleset(config.rulesetId, config.rulesetMode);
  const { min, max } = rs.players.value;
  if (config.players.length < min || config.players.length > max) {
    throw new Error(`Số người chơi phải từ ${min} đến ${max}`);
  }
  const ids = config.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error('playerId trùng');
  const seats = config.players.map((p) => p.seat);
  if (new Set(seats).size !== seats.length) throw new Error('Hai người không thể ngồi cùng ghế');
  if (config.turnOrder.length !== ids.length || !config.turnOrder.every((id) => ids.includes(id))) {
    throw new Error('turnOrder phải là hoán vị của danh sách người chơi');
  }

  const rng = createRandomSource(seedRng(seed));
  const board = generateRandomBoard(rs, rng);
  const bank = emptyHand();
  for (const r of RESOURCES) bank[r] = rs.bankResources.value;
  for (const c of COMMODITIES) bank[c] = rs.bankCommodities.value;

  const players: GameState['players'] = {};
  for (const p of config.players) {
    players[p.id] = { id: p.id, hand: emptyHand(), stock: { ...rs.stock.value } };
  }

  return {
    meta: { gameId, schemaVersion: SCHEMA_VERSION, rulesetId: rs.id, config },
    revision: 0,
    rng: rng.getState(),
    idCounter: 0,
    players,
    board: { layoutId: board.layoutId, hexes: board.hexes, robberHex: board.robberHex, harbors: board.harbors },
    roads: {},
    buildings: {},
    bank,
    barbarian: { position: 0, attacksResolved: 0 },
    titles: { longestRoad: null },
    turn: {
      activePlayerId: config.turnOrder[0]!,
      number: 0,
      phase: 'SETUP',
      lastRoll: null,
      setup: { round: 1, index: 0, step: 'building', lastVertex: null },
    },
    pending: [],
    proposals: {},
    log: [],
    processedCommandIds: [],
    winner: null,
  };
}

// ───────────────────────────── helpers ─────────────────────────────

const reject = (code: Rejection['code'], publicReason: string, privateReason?: string): ValidationResult => ({
  ok: false,
  code,
  publicReason,
  ...(privateReason ? { privateReason } : {}),
});
const OK: ValidationResult = { ok: true };

function addLog(state: GameState, kind: string, data: Record<string, unknown>, secret?: GameState['log'][number]['secret']): void {
  state.log.push({
    seq: state.log.length,
    revision: state.revision + 1,
    turn: state.turn.number,
    kind,
    data,
    ...(secret ? { secret } : {}),
  });
}

function nextId(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}${state.idCounter}`;
}

function pay(state: GameState, playerId: PlayerId, cost: Bundle): void {
  const hand = state.players[playerId]!.hand;
  for (const [t, n] of bundleEntries(cost)) {
    hand[t] -= n;
    state.bank[t] += n;
  }
}

function transfer(state: GameState, from: PlayerId, to: PlayerId, b: Bundle): void {
  for (const [t, n] of bundleEntries(b)) {
    state.players[from]!.hand[t] -= n;
    state.players[to]!.hand[t] += n;
  }
}

function updateLongestRoad(state: GameState, rs: Ruleset): void {
  const before = state.titles.longestRoad;
  const after = resolveLongestRoadHolder(roadLengths(state), before, rs.longestRoadMin.value);
  if (after !== before) {
    state.titles.longestRoad = after;
    addLog(state, 'longestRoad', { from: before, to: after });
  }
}

const orderIndex = (state: GameState, round: 1 | 2, index: number): PlayerId => {
  const order = state.meta.config.turnOrder;
  return round === 1 ? order[index]! : order[order.length - 1 - index]!;
};

function needsAction(state: GameState): void {
  if (state.pending.length === 0 && state.turn.phase === 'ROLL_RESOLUTION') state.turn.phase = 'ACTION';
}

// ───────────────────────────── validation ─────────────────────────────

function hasDuplicate(state: GameState, cmd: Command): boolean {
  return state.processedCommandIds.includes(cmd.commandId);
}

function requireActive(state: GameState, cmd: Command): ValidationResult {
  return cmd.actorId === state.turn.activePlayerId ? OK : reject('NOT_YOUR_TURN', 'Không phải lượt của bạn');
}

function requireMainPhase(state: GameState, cmd: Command): ValidationResult {
  const a = requireActive(state, cmd);
  if (!a.ok) return a;
  if (state.pending.length > 0) return reject('PENDING_RESOLUTION', 'Đang chờ giải quyết lựa chọn bắt buộc');
  if (state.turn.phase === 'PRE_ROLL') return reject('WRONG_PHASE', 'Chưa tung xúc xắc');
  if (state.turn.phase !== 'ACTION') return reject('WRONG_PHASE', 'Không đúng thời điểm');
  return OK;
}

function requireCost(state: GameState, playerId: PlayerId, cost: Bundle): ValidationResult {
  const missing = missingFor(state, playerId, cost);
  if (bundleSize(missing) === 0) return OK;
  return reject('INSUFFICIENT_RESOURCES', 'Không đủ tài nguyên', `Thiếu ${describeBundle(missing)}`);
}

export function validateCommand(state: GameState, cmd: Command): ValidationResult {
  if (state.turn.phase === 'GAME_OVER') return reject('GAME_OVER', 'Ván đã kết thúc');
  if (!state.players[cmd.actorId]) return reject('UNKNOWN_PLAYER', 'Người chơi không hợp lệ');
  if (cmd.expectedRevision !== state.revision) return reject('STALE', 'Bàn đã thay đổi — vui lòng thử lại');

  const rs = rulesetOf(state);
  const head = state.pending[0];

  switch (cmd.type) {
    case 'placeSetupBuilding': {
      const a = requireActive(state, cmd);
      if (!a.ok) return a;
      if (state.turn.phase !== 'SETUP' || state.turn.setup?.step !== 'building') return reject('WRONG_PHASE', 'Không đúng bước đặt quân');
      if (!isSetupBuildingSpot(state, cmd.vertex)) return reject('INVALID_TARGET', 'Vị trí không hợp lệ (bị chiếm hoặc quá gần công trình khác)');
      return OK;
    }
    case 'placeSetupRoad': {
      const a = requireActive(state, cmd);
      if (!a.ok) return a;
      if (state.turn.phase !== 'SETUP' || state.turn.setup?.step !== 'road') return reject('WRONG_PHASE', 'Không đúng bước đặt đường');
      if (!isSetupRoadSpot(state, cmd.edge)) return reject('INVALID_TARGET', 'Đường phải nối với công trình vừa đặt');
      return OK;
    }
    case 'rollDice': {
      const a = requireActive(state, cmd);
      if (!a.ok) return a;
      if (state.turn.phase !== 'PRE_ROLL') return reject('WRONG_PHASE', 'Đã tung xúc xắc lượt này');
      return OK;
    }
    case 'submitDiscard': {
      if (!head || head.kind !== 'discard' || head.id !== cmd.pendingId) return reject('WRONG_PHASE', 'Không có yêu cầu bỏ bài');
      if (!head.decisionOwnerIds.includes(cmd.actorId)) return reject('NOT_DECISION_OWNER', 'Bạn không cần bỏ bài');
      if (!isValidBundle(cmd.cards)) return reject('INVALID_INPUT', 'Lựa chọn không hợp lệ');
      const need = head.required[cmd.actorId]!;
      if (bundleSize(cmd.cards) !== need) return reject('INVALID_INPUT', `Phải bỏ đúng ${need} lá`);
      if (!hasBundle(state, cmd.actorId, cmd.cards)) return reject('INVALID_INPUT', 'Lựa chọn không hợp lệ', 'Bạn không có đủ các lá đã chọn');
      return OK;
    }
    case 'moveRobber': {
      if (!head || head.kind !== 'moveRobber' || head.id !== cmd.pendingId) return reject('WRONG_PHASE', 'Không có yêu cầu di chuyển robber');
      if (!head.decisionOwnerIds.includes(cmd.actorId)) return reject('NOT_DECISION_OWNER', 'Không phải người di chuyển robber');
      const topo = topologyOf(state);
      if (!topo.hexVertices[cmd.hex]) return reject('INVALID_TARGET', 'Ô không hợp lệ');
      if (cmd.hex === state.board.robberHex) return reject('INVALID_TARGET', 'Phải chuyển robber sang ô khác');
      const victims = robberVictims(state, cmd.hex, cmd.actorId);
      if (victims.length === 0 && cmd.victim !== null) return reject('INVALID_TARGET', 'Không có ai để lấy bài ở ô này');
      if (victims.length > 0 && (cmd.victim === null || !victims.includes(cmd.victim))) {
        return reject('INVALID_TARGET', 'Hãy chọn một người có công trình kề ô này');
      }
      return OK;
    }
    case 'buildRoad': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      if (state.players[cmd.actorId]!.stock.roads <= 0) return reject('NO_STOCK', 'Hết đường trong kho');
      if (!isRoadSpot(state, cmd.actorId, cmd.edge)) return reject('INVALID_TARGET', 'Đường phải nối với mạng đường/công trình của bạn');
      return requireCost(state, cmd.actorId, rs.costs.value.road);
    }
    case 'buildSettlement': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      if (state.players[cmd.actorId]!.stock.settlements <= 0) return reject('NO_STOCK', 'Hết settlement trong kho');
      if (!isSettlementSpot(state, cmd.actorId, cmd.vertex)) return reject('INVALID_TARGET', 'Vị trí cần nối đường của bạn và cách công trình khác ít nhất 2 cạnh');
      return requireCost(state, cmd.actorId, rs.costs.value.settlement);
    }
    case 'buildCity': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      if (state.players[cmd.actorId]!.stock.cities <= 0) return reject('NO_STOCK', 'Hết city trong kho');
      if (!isCitySpot(state, cmd.actorId, cmd.vertex)) return reject('INVALID_TARGET', 'Chỉ nâng cấp settlement của bạn');
      return requireCost(state, cmd.actorId, rs.costs.value.city);
    }
    case 'bankTrade': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      if (!CARD_TYPES.includes(cmd.give) || !CARD_TYPES.includes(cmd.get) || cmd.give === cmd.get) {
        return reject('INVALID_TRADE', 'Phải đổi hai loại khác nhau');
      }
      const ratio = bankRatio(state, cmd.actorId, cmd.give);
      if (state.bank[cmd.get] < 1) return reject('BANK_EMPTY', 'Ngân hàng hết loại này');
      return requireCost(state, cmd.actorId, { [cmd.give]: ratio });
    }
    case 'proposeTrade':
    case 'updateTrade': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      if (cmd.type === 'updateTrade') {
        const p = state.proposals[cmd.proposalId];
        if (!p || p.status !== 'open' || p.from !== cmd.actorId) return reject('INVALID_TRADE', 'Đề nghị không còn hiệu lực');
      }
      if (!isValidBundle(cmd.offer) || !isValidBundle(cmd.request)) return reject('INVALID_INPUT', 'Đề nghị không hợp lệ');
      if (bundleSize(cmd.offer) === 0 || bundleSize(cmd.request) === 0) {
        return reject('INVALID_TRADE', 'Hai bên đều phải đưa ít nhất một lá (không tặng bài)');
      }
      if (bundleEntries(cmd.offer).some(([t]) => (cmd.request[t] ?? 0) > 0)) {
        return reject('INVALID_TRADE', 'Không đổi cùng một loại lá');
      }
      const others = Object.keys(state.players).filter((p) => p !== cmd.actorId);
      if (cmd.to.length === 0 || !cmd.to.every((p) => others.includes(p)) || new Set(cmd.to).size !== cmd.to.length) {
        return reject('INVALID_TRADE', 'Chọn người nhận đề nghị');
      }
      return requireCost(state, cmd.actorId, cmd.offer);
    }
    case 'respondTrade': {
      const p = state.proposals[cmd.proposalId];
      if (!p || p.status !== 'open') return reject('INVALID_TRADE', 'Đề nghị không còn hiệu lực');
      if (!p.to.includes(cmd.actorId)) return reject('NOT_DECISION_OWNER', 'Đề nghị không gửi cho bạn');
      if (p.revision !== cmd.revision) return reject('STALE_PROPOSAL', 'Đề nghị đã được sửa — xem lại');
      if (state.pending.length > 0) return reject('PENDING_RESOLUTION', 'Đang chờ giải quyết lựa chọn bắt buộc');
      if (cmd.response === 'accept') return requireCost(state, cmd.actorId, p.request);
      return OK;
    }
    case 'confirmTrade': {
      const m = requireMainPhase(state, cmd);
      if (!m.ok) return m;
      const p = state.proposals[cmd.proposalId];
      if (!p || p.status !== 'open' || p.from !== cmd.actorId) return reject('INVALID_TRADE', 'Đề nghị không còn hiệu lực');
      if (p.revision !== cmd.revision) return reject('STALE_PROPOSAL', 'Đề nghị đã được sửa — xem lại');
      if (p.acceptedBy[cmd.partner] !== p.revision) return reject('INVALID_TRADE', 'Người này chưa chấp nhận phiên bản hiện tại');
      if (!hasBundle(state, cmd.actorId, p.offer)) return reject('INSUFFICIENT_RESOURCES', 'Không đủ tài nguyên', `Thiếu ${describeBundle(missingFor(state, cmd.actorId, p.offer))}`);
      if (!hasBundle(state, cmd.partner, p.request)) return reject('INVALID_TRADE', 'Đối tác không còn đủ lá cho giao dịch này');
      return OK;
    }
    case 'cancelTrade': {
      const p = state.proposals[cmd.proposalId];
      if (!p || p.status !== 'open' || p.from !== cmd.actorId) return reject('INVALID_TRADE', 'Đề nghị không còn hiệu lực');
      return OK;
    }
    case 'endTurn': {
      return requireMainPhase(state, cmd);
    }
    default: {
      const _exhaustive: never = cmd;
      return reject('INVALID_INPUT', `Lệnh không hỗ trợ: ${String((_exhaustive as Command).type)}`);
    }
  }
}

// ───────────────────────────── apply ─────────────────────────────

function applyMutation(state: GameState, cmd: Command, rng: RandomSource, rs: Ruleset): void {
  const topo = topologyOf(state);
  const actor = state.players[cmd.actorId]!;

  switch (cmd.type) {
    case 'placeSetupBuilding': {
      const setup = state.turn.setup!;
      const kind = setup.round === 1 ? 'settlement' : rs.setupSecondBuilding.value;
      state.buildings[cmd.vertex] = { owner: cmd.actorId, kind };
      if (kind === 'city') actor.stock.cities -= 1;
      else actor.stock.settlements -= 1;
      const gained: Bundle = {};
      if (setup.round === 2 && rs.startingYieldFromSecond.value) {
        for (const h of topo.vertexHexes[cmd.vertex] ?? []) {
          const tile = state.board.hexes[h];
          if (!tile || tile.terrain === 'desert') continue;
          const res = rs.terrainResource.value[tile.terrain];
          if (state.bank[res] > 0) {
            state.bank[res] -= 1;
            actor.hand[res] += 1;
            gained[res] = (gained[res] ?? 0) + 1;
          }
        }
      }
      addLog(state, 'setupBuilding', { player: cmd.actorId, vertex: cmd.vertex, kind, gained });
      setup.step = 'road';
      setup.lastVertex = cmd.vertex;
      updateLongestRoad(state, rs);
      return;
    }
    case 'placeSetupRoad': {
      state.roads[cmd.edge] = cmd.actorId;
      actor.stock.roads -= 1;
      addLog(state, 'setupRoad', { player: cmd.actorId, edge: cmd.edge });
      const setup = state.turn.setup!;
      const n = state.meta.config.turnOrder.length;
      setup.index += 1;
      setup.step = 'building';
      setup.lastVertex = null;
      if (setup.index >= n) {
        if (setup.round === 1) {
          setup.round = 2;
          setup.index = 0;
        } else {
          state.turn.setup = null;
          state.turn.phase = 'PRE_ROLL';
          state.turn.number = 1;
          state.turn.activePlayerId = state.meta.config.turnOrder[0]!;
          addLog(state, 'setupDone', {});
          updateLongestRoad(state, rs);
          return;
        }
      }
      state.turn.activePlayerId = orderIndex(state, setup.round, setup.index);
      updateLongestRoad(state, rs);
      return;
    }
    case 'rollDice': {
      const faces = rs.eventFaces.value;
      const roll = { red: rng.nextInt(6) + 1, yellow: rng.nextInt(6) + 1, event: faces[rng.nextInt(faces.length)]! };
      state.turn.lastRoll = roll;
      state.turn.phase = 'ROLL_RESOLUTION';
      addLog(state, 'roll', { player: cmd.actorId, ...roll });
      // Event die: thứ tự giải quyết (TRN-003) và hiệu ứng (tàu barbarian, rút Progress Card) thuộc M2.
      // M1 chỉ ghi nhận kết quả, không bỏ qua bước nào: các bước này sẽ chèn vào trước production.
      const sum = roll.red + roll.yellow;
      if (sum === 7) {
        const required: Record<PlayerId, number> = {};
        for (const pid of state.meta.config.turnOrder) {
          const total = handTotal(state, pid);
          if (total > rs.handLimit.value) required[pid] = Math.floor(total / 2);
        }
        const owners = Object.keys(required);
        if (owners.length > 0) {
          state.pending.push({ id: nextId(state, 'd'), kind: 'discard', source: 'roll7', required, decisionOwnerIds: owners, collected: {} });
        }
        if (robberActive(state)) {
          state.pending.push({ id: nextId(state, 'r'), kind: 'moveRobber', source: 'roll7', decisionOwnerIds: [cmd.actorId] });
        } else {
          addLog(state, 'robberAsleep', {});
        }
      } else {
        produce(state, sum, rs);
      }
      needsAction(state);
      return;
    }
    case 'submitDiscard': {
      const head = state.pending[0]!;
      if (head.kind !== 'discard') return;
      head.collected[cmd.actorId] = cmd.cards;
      head.decisionOwnerIds = head.decisionOwnerIds.filter((p) => p !== cmd.actorId);
      addLog(state, 'discardChosen', { player: cmd.actorId });
      if (head.decisionOwnerIds.length === 0) {
        // Commit một lần khi đủ tất cả (DIG-006).
        for (const [pid, cards] of Object.entries(head.collected)) {
          pay(state, pid, cards);
          addLog(state, 'discarded', { player: pid, count: bundleSize(cards) }, { visibleTo: [pid], data: { cards } });
        }
        state.pending.shift();
      }
      needsAction(state);
      return;
    }
    case 'moveRobber': {
      state.board.robberHex = cmd.hex;
      if (cmd.victim) {
        const victimHand = state.players[cmd.victim]!.hand;
        const deck: CardType[] = [];
        for (const t of CARD_TYPES) for (let i = 0; i < victimHand[t]; i++) deck.push(t);
        const card = deck[rng.nextInt(deck.length)]!;
        transfer(state, cmd.victim, cmd.actorId, { [card]: 1 });
        addLog(state, 'robber', { player: cmd.actorId, hex: cmd.hex, victim: cmd.victim }, { visibleTo: [cmd.actorId, cmd.victim], data: { card } });
      } else {
        addLog(state, 'robber', { player: cmd.actorId, hex: cmd.hex, victim: null });
      }
      state.pending.shift();
      needsAction(state);
      return;
    }
    case 'buildRoad': {
      pay(state, cmd.actorId, rs.costs.value.road);
      state.roads[cmd.edge] = cmd.actorId;
      actor.stock.roads -= 1;
      addLog(state, 'build', { player: cmd.actorId, kind: 'road', target: cmd.edge });
      updateLongestRoad(state, rs);
      return;
    }
    case 'buildSettlement': {
      pay(state, cmd.actorId, rs.costs.value.settlement);
      state.buildings[cmd.vertex] = { owner: cmd.actorId, kind: 'settlement' };
      actor.stock.settlements -= 1;
      addLog(state, 'build', { player: cmd.actorId, kind: 'settlement', target: cmd.vertex });
      updateLongestRoad(state, rs); // settlement mới có thể cắt đường đối thủ
      return;
    }
    case 'buildCity': {
      pay(state, cmd.actorId, rs.costs.value.city);
      state.buildings[cmd.vertex]!.kind = 'city';
      actor.stock.cities -= 1;
      actor.stock.settlements += 1;
      addLog(state, 'build', { player: cmd.actorId, kind: 'city', target: cmd.vertex });
      return;
    }
    case 'bankTrade': {
      const ratio = bankRatio(state, cmd.actorId, cmd.give);
      pay(state, cmd.actorId, { [cmd.give]: ratio });
      state.bank[cmd.get] -= 1;
      actor.hand[cmd.get] += 1;
      addLog(state, 'bankTrade', { player: cmd.actorId, give: cmd.give, count: ratio, get: cmd.get });
      return;
    }
    case 'proposeTrade': {
      const id = nextId(state, 't');
      state.proposals[id] = {
        id,
        revision: 1,
        from: cmd.actorId,
        to: [...cmd.to],
        offer: { ...cmd.offer },
        request: { ...cmd.request },
        acceptedBy: {},
        rejectedBy: [],
        status: 'open',
      };
      addLog(state, 'tradeProposed', { proposalId: id, from: cmd.actorId, to: cmd.to, offer: cmd.offer, request: cmd.request });
      return;
    }
    case 'updateTrade': {
      const p = state.proposals[cmd.proposalId]!;
      p.revision += 1;
      p.to = [...cmd.to];
      p.offer = { ...cmd.offer };
      p.request = { ...cmd.request };
      p.acceptedBy = {}; // sửa đề nghị làm mất xác nhận cũ
      p.rejectedBy = [];
      addLog(state, 'tradeUpdated', { proposalId: p.id, revision: p.revision, to: p.to, offer: p.offer, request: p.request });
      return;
    }
    case 'respondTrade': {
      const p = state.proposals[cmd.proposalId]!;
      if (cmd.response === 'accept') {
        p.acceptedBy[cmd.actorId] = p.revision;
        p.rejectedBy = p.rejectedBy.filter((x) => x !== cmd.actorId);
      } else {
        delete p.acceptedBy[cmd.actorId];
        if (!p.rejectedBy.includes(cmd.actorId)) p.rejectedBy.push(cmd.actorId);
      }
      addLog(state, 'tradeResponse', { proposalId: p.id, revision: p.revision, player: cmd.actorId, response: cmd.response });
      return;
    }
    case 'confirmTrade': {
      const p = state.proposals[cmd.proposalId]!;
      transfer(state, p.from, cmd.partner, p.offer);
      transfer(state, cmd.partner, p.from, p.request);
      p.status = 'done';
      addLog(state, 'tradeDone', { proposalId: p.id, from: p.from, partner: cmd.partner, offer: p.offer, request: p.request });
      return;
    }
    case 'cancelTrade': {
      state.proposals[cmd.proposalId]!.status = 'cancelled';
      addLog(state, 'tradeCancelled', { proposalId: cmd.proposalId });
      return;
    }
    case 'endTurn': {
      for (const p of Object.values(state.proposals)) if (p.status === 'open') p.status = 'cancelled';
      const order = state.meta.config.turnOrder;
      const idx = order.indexOf(state.turn.activePlayerId);
      state.turn.activePlayerId = order[(idx + 1) % order.length]!;
      state.turn.number += 1;
      state.turn.phase = 'PRE_ROLL';
      addLog(state, 'endTurn', { player: cmd.actorId, next: state.turn.activePlayerId });
      return;
    }
  }
}

/** Production (PRD-001..004): settlement/city, commodity, robber chặn, ngân hàng thiếu. */
function produce(state: GameState, sum: number, rs: Ruleset): void {
  const topo = topologyOf(state);
  const demand: Partial<Record<CardType, Record<PlayerId, number>>> = {};
  const add = (t: CardType, p: PlayerId, n: number): void => {
    const row = (demand[t] ??= {});
    row[p] = (row[p] ?? 0) + n;
  };
  for (const h of topo.hexes) {
    const tile = state.board.hexes[h]!;
    if (tile.token !== sum || tile.terrain === 'desert' || h === state.board.robberHex) continue;
    for (const v of topo.hexVertices[h]!) {
      const b = state.buildings[v];
      if (!b) continue;
      if (b.kind === 'settlement') add(rs.terrainResource.value[tile.terrain], b.owner, 1);
      else {
        const y = rs.cityYield.value[tile.terrain];
        add(rs.terrainResource.value[tile.terrain], b.owner, y.resource);
        if (y.commodity) add(y.commodity, b.owner, 1);
      }
    }
  }
  const received: Record<PlayerId, Bundle> = {};
  const shortages: CardType[] = [];
  for (const [t, row] of Object.entries(demand) as [CardType, Record<PlayerId, number>][]) {
    const total = Object.values(row).reduce((s, n) => s + n, 0);
    const recipients = Object.keys(row);
    let grant: Record<PlayerId, number> = row;
    if (total > state.bank[t]) {
      shortages.push(t);
      // PRD-003 (UNRESOLVED): thiếu → không ai nhận, trừ khi chỉ một người nhận thì lấy phần còn lại.
      grant = recipients.length === 1 ? { [recipients[0]!]: state.bank[t] } : {};
    }
    for (const [p, n] of Object.entries(grant)) {
      if (n <= 0) continue;
      state.bank[t] -= n;
      state.players[p]!.hand[t] += n;
      (received[p] ??= {})[t] = n;
    }
  }
  // Sản lượng suy ra được từ board công khai → log công khai.
  addLog(state, 'production', { sum, received, shortages });
}

function checkWin(state: GameState, rs: Ruleset): void {
  if (state.turn.phase === 'SETUP' || state.winner) return;
  const scores = computeScore(state);
  const target = rs.victoryTarget.value;
  const candidates = rs.winOnlyOnOwnTurn.value ? [state.turn.activePlayerId] : Object.keys(scores);
  const winner = candidates.find((p) => scores[p]!.total >= target);
  if (winner) {
    state.winner = winner;
    state.turn.phase = 'GAME_OVER';
    addLog(state, 'gameOver', { winner, score: scores[winner]!.total });
  }
}

export interface ApplyOptions {
  readonly random?: RandomFactory;
  /** Mặc định true: kiểm tra invariants sau mỗi transition (lỗi engine → throw, state cũ giữ nguyên). */
  readonly checkInvariants?: boolean;
}

/**
 * Áp dụng một command nguyên tử: validate → clone → mutate → kiểm thắng → invariants → revision+1.
 * Không bao giờ sửa `state` đầu vào.
 */
export function applyCommand(state: GameState, cmd: Command, opts: ApplyOptions = {}): TransitionResult {
  if (hasDuplicate(state, cmd)) return { ok: true, state, duplicate: true };
  const v = validateCommand(state, cmd);
  if (!v.ok) return v;

  const rs = getRuleset(state.meta.config.rulesetId, state.meta.config.rulesetMode);
  // Log là append-only, entry không bao giờ bị sửa → chỉ sao chép mảng, không deep-clone (tránh O(n²)).
  const draft: GameState = { ...structuredClone({ ...state, log: [] }), log: [...state.log] };
  const rng = (opts.random ?? defaultRandom)(draft);
  applyMutation(draft, cmd, rng, rs);
  checkWin(draft, rs);
  draft.rng = rng.getState();
  draft.revision = state.revision + 1;
  draft.processedCommandIds.push(cmd.commandId);
  if (draft.processedCommandIds.length > MAX_PROCESSED_IDS) draft.processedCommandIds.shift();
  if (opts.checkInvariants ?? true) {
    const problems = checkInvariants(draft);
    if (problems.length > 0) throw new Error(`Vi phạm invariant sau ${cmd.type}: ${problems.join('; ')}`);
  }
  return { ok: true, state: draft, duplicate: false };
}

export type { EdgeId, VertexId };
