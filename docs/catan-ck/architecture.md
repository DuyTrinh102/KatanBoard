# Architecture — CATAN + Cities & Knights

## 1. Stack (repo trống → mặc định của prompt)

| Thành phần | Lựa chọn | Phiên bản `latest` trên npm (kiểm 2026-10-08) | Ghi chú |
|---|---|---|---|
| Ngôn ngữ | TypeScript (strict) | 7.0.2 | TS 7 là bản native mới; tại M1 kiểm tra tương thích với Vite/Vitest/ESLint, nếu chưa ổn thì pin nhánh 5.x/6.x gần nhất. Quyết định ghi vào `package.json` + ADR |
| UI | React + React DOM | 19.3.0 | Board SVG thuần, không thư viện canvas |
| Build/dev | Vite + @vitejs/plugin-react | 8.3.4 / 6.1.2 | |
| Unit/engine test | Vitest | 5.0.3 | Engine test chạy trên Node, không cần DOM |
| E2E | @playwright/test | 1.64.0 | Môi trường dev có Chromium sẵn ở `/opt/pw-browsers`; nếu version lệch dùng `executablePath` |
| Offline | vite-plugin-pwa (Workbox precache) | 2.0.0 | Phương án chính; dự phòng static server cục bộ |
| Persistence | IndexedDB qua `idb` | 8.0.4 | Wrapper mỏng, transaction tường minh |
| Validate save/import | zod | 4.6.5 | Schema save + command |

Version được pin chính xác (không `^`) ở M1 sau khi kiểm API. Không dùng font/icon/audio CDN.

## 2. Cấu trúc thư mục

```text
src/
  app/                    # launcher, game registry (interface tối thiểu), routing
  table/                  # seats, orientation, pointer sessions, private session manager
  games/catan-ck/
    engine/               # state types, commands, validate, apply, legal actions, pipeline
    board/                # topology: hex/vertex/edge graph, layouts, harbors, longest road
    rules/                # ruleset data versioned + provenance (ruleId, source, status)
    cards/                # catalog (data) + handlers (logic)
    projections/          # public / private / decision view-models
    ui/                   # board SVG, trays, action dock, trade, battle, private panel
  persistence/            # IndexedDB store, save schema, migrations, single-tab lock, export/import
  shared/                 # i18n (vi + thuật ngữ en), UI primitives, audio, random
tests/catan-ck/           # unit (engine), property, fixtures, e2e
docs/catan-ck/
```

`engine/`, `board/`, `rules/`, `cards/`, `projections/` **không import React/DOM** (lint rule `no-restricted-imports`). Engine là hàm thuần.

## 3. Board graph

- Tọa độ hex axial `(q, r)`; ID ổn định dạng chuỗi: hex `h:q,r`; vertex `v:` + 3 hex (kể cả hex biển/ảo) sắp xếp chuẩn hóa; edge `e:` + 2 vertex sắp xếp. Sinh một lần từ layout, **không** suy từ pixel/float.
- Bảng kề (đối xứng, test bằng property test): `hex→vertices[6]`, `hex→edges[6]`, `vertex→hexes[≤3]`, `vertex→edges[≤3]`, `vertex→vertices[≤3]`, `edge→vertices[2]`, `edge→edges`.
- Harbor gắn vào cặp vertex ven biển.
- Pixel chỉ dùng ở `ui/` (layout → toạ độ SVG).
- Longest Road: DFS trên edge của người chơi, không đi qua vertex có công trình/knight đối thủ (chờ BRD-004), xử lý vòng (đánh dấu edge đã dùng, không phải vertex), nhánh; trả về độ dài lớn nhất. Chủ danh hiệu tính lại sau mỗi mutation ảnh hưởng road/vertex theo SCO-002/003.

## 4. State model (rút gọn)

```ts
interface GameState {
  meta: { gameId; schemaVersion; rulesetId: 'catan-base-2025+ck-2025'; rulesetVersion; createdAt; config: GameConfig };
  revision: number;                 // tăng đơn điệu mỗi command chấp nhận
  rng: RngState;                    // PRNG state (sfc32/xoshiro128**, tự cài, có test vector)
  players: Record<PlayerId, PlayerState>;   // inventory, stock, improvements, flags
  seats: Record<SeatId, PlayerId | null>;   // B | T | L | R
  turnOrder: PlayerId[];
  board: { layoutId; hexes; numberTokens; robberHex; harbors };
  pieces: { roads: Record<EdgeId, PlayerId>; buildings: Record<VertexId, Building>; knights: Record<VertexId, Knight>; walls: Set<VertexId>; merchant?: { hex; owner } };
  bank: { resources; commodities };
  decks: { science: CardInstanceId[]; trade: ...; politics: ... };   // thứ tự = bí mật
  cards: Record<CardInstanceId, { cardId; zone: Zone }>;           // mỗi instance ở đúng một zone
  barbarian: { position; attacksResolved };
  titles: { longestRoad?: PlayerId; defenders: Record<PlayerId, number>; metropolis: Record<Track, { owner; vertex } | null> };
  turn: { activePlayerId; number; phase: Phase; markers: TurnMarkers };
  pending: PendingResolution[];     // stack; phần tử đầu là đang xử lý
  proposals: Record<ProposalId, TradeProposal>;
  log: LogEntry[];                  // public + private payload tách riêng
  winner?: PlayerId;
}

interface Knight { owner; level: 1|2|3; active: boolean;
  activatedOnTurn?: number; promotedOnTurn?: number; actedOnTurn?: number }   // thuộc tính ≠ quyền hành động
interface TurnMarkers { effects: ActiveEffect[]; /* merchantFleet, crane… */ }
```

## 5. State machine

```text
SETUP ──(đặt xong)──▶ PRE_ROLL ──Roll/Alchemist──▶ ROLL_RESOLUTION ──(pipeline xong)──▶ ACTION ──EndTurn──▶ END_TURN ──▶ PRE_ROLL (người kế)
                                                                                     │
                                                    bất kỳ lúc nào điểm thay đổi ─────┴─▶ checkWin (theo SCO-007) ──▶ GAME_OVER
```

`ROLL_RESOLUTION` là pipeline các bước, mỗi bước có thể đẩy `PendingResolution` (thứ tự **ứng viên**, chờ TRN-003):

```text
1 rollDice (hoặc rollOverride từ Alchemist) → ghi kết quả vào log + rng state
2 eventDie: ship → advanceBarbarian → nếu tới bờ: battle pipeline
            gate(color) → progressDraw (theo IMP-006, thứ tự người PRG-002)
3 nếu tổng = 7: discards (decision đồng thời DIG-006) → nếu robber active: moveRobber → steal
   ngược lại: production (bank shortage PRD-003) → aqueduct choices (PRD-009)
4 → ACTION
```

Battle pipeline: tính strength/defense (snapshot) → kết quả → loss: xác định tập người bị ảnh hưởng → decision chọn city (mỗi người) → hạ cấp + gỡ tường → win: defender / tie decision chọn bộ → deactivate knights → reset tàu → kích hoạt robber nếu lần đầu.

### Quyền thao tác

- `activePlayerId`: chủ lượt. `decisionOwnerIds`: lấy từ `pending[0]`. Khác nhau khi người khác phải chọn.
- Khi `pending` không rỗng: chỉ chấp nhận command `ResolveDecision` thuộc `pending[0].id` từ người trong `decisionOwnerIds`, cộng các command không mutation (xem, pause). Build/trade bị từ chối với lý do `PENDING_RESOLUTION`.
- Trade: người ngoài lượt được `RespondToProposal` khi phase = ACTION và không có pending.

## 6. PendingResolution

```ts
interface PendingResolution {
  id: string;                         // duy nhất, từ counter trong state (không dùng random UI)
  source: { kind: 'roll'|'battle'|'card'|'knight'|'robber'|'setup'|'metropolis'; ref?: string };
  step: string;                       // ví dụ 'discard', 'chooseCityToDowngrade', 'spy.pickCard'
  decisionOwnerIds: PlayerId[];       // ai còn phải trả lời
  options: DecisionOptions;           // lựa chọn hợp lệ (tính bởi engine) — phần riêng tư nằm trong private projection
  collected: Record<PlayerId, unknown>; // lựa chọn đồng thời đã thu (private)
  commitPolicy: 'each' | 'all';       // commit từng người hay khi đủ tất cả
  continuation: { pipeline: string; stepIndex: number; data: unknown };  // dữ liệu tiếp tục, JSON
}
```

- Toàn bộ là JSON → save/restore giữa hiệu ứng; reload không chạy lại roll/draw/steal vì kết quả đã ghi trong state trước khi tạo pending.
- Card handler và pipeline đều là "generator thuần": `step(state, pending, choice) → { state, next: PendingResolution | null, events }`.
- Không có modal tự giữ state: UI chỉ render `getPendingDecisionView`.

## 7. Command & transaction

```ts
interface Command { commandId: string; expectedRevision: number; actorId: PlayerId | 'staff'; type: string; payload: unknown }
validateCommand(state, cmd): { ok: true } | { ok: false; code; publicReason; privateReason? }
applyCommand(state, cmd, rng): { state; events; log }   // nguyên tử: lỗi giữa chừng → không đổi state
getLegalActions(state, actorId): LegalAction[]           // UI enable/disable dựa vào đây
```

- Một **command queue tuần tự** ở app layer: lấy command → validate → apply → persist (await thành công) → publish view. Không có mutation ngoài queue.
- `commandId` đã xử lý lưu trong state (ring buffer N gần nhất) → lặp lại trả về kết quả cũ, không đổi state.
- `expectedRevision` lệch → từ chối `STALE`.
- Kiểm tra thắng chạy **cuối transaction** (không ở trạng thái trung gian của hiệu ứng).
- Invariants (dev + test): inventory ≥ 0; bảo toàn số lá mỗi loại (tay + bank = tổng); mỗi card instance ở 1 zone; không chồng quân trái luật; revision tăng.

## 8. Projections

- `getPublicView(state)`: chỉ dữ liệu cột "Công khai" (`digital-adaptations.md`). Không chứa deck order, rng, tay bài.
- `getPrivateView(state, playerId, context)`: tay của người đó + dữ liệu hiệu ứng được tiết lộ cho họ (Spy…). Chỉ gọi khi private session mở.
- `getPendingDecisionView(state, playerId)`.
- Open Table: `getPublicView` gộp dữ liệu riêng khi `config.openTable` — nhánh code duy nhất, có test.
- Test privacy: render toàn bộ cây UI công khai với state có tay bài đặc trưng (ví dụ marker string) và assert marker không xuất hiện trong DOM/aria/log/toast.
- Cùng projection sẽ phục vụ companion điện thoại sau này (chưa xây network/auth).

## 9. Table layer

- `SeatManager`: seat ↔ player, orientation.
- `InteractionManager`: mỗi interaction `{ id, playerId (từ khay), pointerId?, kind, preview }`; dùng Pointer Events + `setPointerCapture`; `pointercancel`/blur → hủy preview, không tạo command.
- `PrivateSessionManager`: tối đa 1 session; mở/đóng theo DIG-001; phát sự kiện để projection gỡ dữ liệu riêng khỏi cây React.

## 10. Persistence

- IndexedDB store `games`: một bản ghi `{ gameId, schemaVersion, rulesetId, rulesetVersion, revision, state, initialState, commandLog }` ghi trong **một transaction** sau mỗi command; chỉ báo "đã lưu" khi `tx.oncomplete`. Lỗi quota → khóa queue, hiện banner staff "Không lưu được — xuất file cứu hộ".
- Giữ `lastGood` (bản trước) để khôi phục khi bản mới hỏng.
- Single writer: `navigator.locks.request('catan-ck:'+gameId, {ifAvailable:true})` + `BroadcastChannel` báo tab khác chuyển read-only.
- Reload: mở lại ở pending decision hiện tại, tất cả private session đóng, preview bỏ, proposal trade bị đánh dấu cần xác nhận lại.
- Export/import JSON (staff): validate zod + invariants + replay kiểm tra khớp state; hiện tóm tắt và yêu cầu xác nhận trước khi ghi đè.
- Migration: `migrations/[from]→[to].ts`; save không tương thích → thông báo + giữ file, không tự reset.
- Không cập nhật ruleset giữa ván: save giữ `rulesetVersion`, app từ chối mở save khác version mà không có migration.

## 11. Replay & random

`replay(initialState, commandLog) === state` (deep equal) là test bắt buộc. PRNG tự cài với test vector cố định; seed sinh từ `crypto.getRandomValues` khi tạo ván và lưu trong state (ẩn khỏi public view).

## 12. Game registry

```ts
interface GameModule { id: 'catan-ck'; title; minPlayers; maxPlayers; createSetupScreen; mount(saveOrConfig) }
```
Chỉ đủ cho launcher liệt kê và mở game. Không xây framework plugin chung.

## 13. Offline

PWA precache toàn bộ asset (JS/CSS/SVG/font/audio tự host). Hướng dẫn kiosk: Chromium `--kiosk`, tắt auto-update trong giờ mở cửa. Test: build → cài → tắt mạng → khởi động lại → mở ván đang lưu (Playwright với `context.setOffline(true)` + kiểm thật trên máy quán ở M4).
