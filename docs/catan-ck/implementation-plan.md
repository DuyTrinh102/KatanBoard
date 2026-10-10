# Implementation Plan — backlog, dependencies, milestones

Estimate theo **phạm vi** (S ≈ ≤1 ngày dev, M ≈ 2–4 ngày, L ≈ 1–2 tuần, XL > 2 tuần) kèm độ bất định (±). Không cam kết ngày giao: repo trống, nguồn luật chưa đọc được, phần cứng chưa biết.

Ưu tiên: P0 = chặn ván end-to-end; P1 = cần cho nghiệm thu milestone; P2 = cải thiện.

## 0. Blocker hiện tại

| ID | Outcome | Dependencies | Acceptance | Cách kiểm chứng | Ưu tiên | Rủi ro |
|---|---|---|---|---|---|---|
| RB-001 | Đọc được PDF base 2025, C&K 2025 (+2020 đối chiếu) và FAQ | Mở host `www.catan.com` trong network policy **hoặc** người dùng đặt PDF vào `docs/catan-ck/sources/` | Bảng nguồn §1 rules-spec có SHA-256 + ngày; mọi rule có trang | Review diff rules-spec | P0 | Cao: mọi dữ liệu luật đang UNRESOLVED |
| RB-002 | Đối chiếu toàn bộ rules-spec + progress-cards-matrix, đóng Q-01…Q-14 | RB-001 | 0 dòng UNRESOLVED không lý do; chênh lệch 2020↔2025 ghi rõ | Script đếm trạng thái trong docs | P0 | Trung bình: có thể 2025 khác đáng kể → đổi catalog |

M1 có thể bắt đầu song song (topology, engine khung, persistence không phụ thuộc số liệu luật), nhưng dữ liệu luật đi qua `rules/` với cờ `status` và preset chuẩn bị khóa cho tới khi VERIFIED (dev preset `ck2025-unverified` gắn nhãn rõ).

## M1 — Board, engine nền, persistence

| ID | Outcome | Module | Deps | Acceptance criteria | Kiểm chứng | Ưu tiên | Est. | Rủi ro |
|---|---|---|---|---|---|---|---|---|
| M1-01 | Scaffold Vite+React+TS strict, Vitest, Playwright, ESLint (cấm DOM import trong engine), CI script `npm run check` | app | — | `npm run check` (lint+typecheck+test) xanh; README chạy/build | Chạy lệnh | P0 | S ±0.5 | TS 7 tương thích tooling |
| M1-02 | `rules/` với provenance: mỗi hằng số có `ruleId/source/status`; test chặn preset chuẩn chứa UNRESOLVED | rules | M1-01 | Test provenance pass; dev preset gắn nhãn | Vitest | P0 | S | — |
| M1-03 | PRNG seedable + test vector; `RandomSource` inject | shared | M1-01 | Cùng seed → cùng chuỗi; state serializable | Vitest | P0 | S | — |
| M1-04 | Topology graph hex/vertex/edge, ID ổn định, harbor | board | M1-01 | Không trùng ID; quan hệ đối xứng; số vertex/edge đúng cho board chuẩn (54/72 — tính từ hình học, không phải luật) | Property test | P0 | M ±1 | — |
| M1-05 | Layout beginner + ngẫu nhiên (ràng buộc theo SET-004) | board/rules | M1-04, RB-002 | Layout hợp lệ với số lượng đã VERIFIED | Vitest | P1 | M | Phụ thuộc nguồn |
| M1-06 | GameState, command queue, validate/apply nguyên tử, `commandId` idempotent, `expectedRevision`, invariants | engine | M1-02,03 | Command lặp không đổi state; STALE bị từ chối; invariants chạy sau mỗi apply trong test | Vitest + fuzz | P0 | M ±1 | — |
| M1-07 | Setup flow 3/4 người (thứ tự rắn, settlement+city theo SET-011/012) | engine | M1-04,06 | Setup hợp lệ, khoảng cách đúng, tài nguyên khởi đầu đúng | Vitest | P0 | M | SET-011 chưa verified |
| M1-08 | Turn state PRE_ROLL→ROLL_RESOLUTION→ACTION→END_TURN với pending stack | engine | M1-06 | Không xen command trái phase; reload giữa pending trả về đúng decision | Vitest | P0 | M ±1 | Thiết kế pipeline |
| M1-09 | Production base + bank shortage + robber/7/discard (decision đồng thời) | engine | M1-08 | T-PRD-* pass | Vitest | P0 | M | PRD-003/007 |
| M1-10 | Build road/settlement/city + stock | engine | M1-07 | T-CON-001..003,006 | Vitest | P0 | S | — |
| M1-11 | Trade engine: proposal/revision/accept/confirm nguyên tử; bank/cảng | engine | M1-08 | T-TRD-* (base) pass; double tap an toàn | Vitest | P0 | M ±1 | — |
| M1-12 | Longest Road (vòng, nhánh, chặn, hòa, chuyển chủ) + score ledger | engine/board | M1-10 | T-SCO-002/003 | Vitest | P0 | M | Edge cases |
| M1-13 | Persistence IndexedDB, single-tab lock, lastGood, storage error, export/import | persistence | M1-06 | Reload giữa roll/discard/trade không đổi kết quả; quota lỗi khóa mutation | Vitest (fake-indexeddb) + Playwright | P0 | M ±1 | Hành vi IDB trên kiosk |
| M1-14 | Log/replay: replay(initial, log) == state | engine | M1-06 | Test replay trên ván ngẫu nhiên do script chơi | Vitest | P0 | S | — |
| M1-15 | Launcher + registry tối thiểu + UI thô (board SVG, khay đơn giản) chơi được luồng M1 | app/ui | M1-07..13 | E2E: tạo ván 3/4 người, setup, vài lượt, reload | Playwright | P1 | M ±1 | — |

### Trạng thái M1 (2026-10-10)

| ID | Trạng thái | Ghi chú |
|---|---|---|
| M1-01 | Xong | TypeScript 7.0.2 chạy được với Vite 8.3.4/Vitest 5.0.3 (pin chính xác). Thay ESLint bằng test kiến trúc `tests/catan-ck/architecture.test.ts` (cấm React/DOM/Math.random/Date trong engine) |
| M1-02 | Xong | `src/games/catan-ck/rules/` — mọi giá trị có `ruleId/source/status/evidence`; preset chuẩn bị chặn |
| M1-03 | Xong | `src/shared/random.ts` (sfc32 + test vector) |
| M1-04 | Xong | 19 hex / 54 vertex / 72 edge, quan hệ đối xứng có test |
| M1-05 | Một phần | Board ngẫu nhiên xong; layout beginner cố định và vị trí cảng chính thức **bị chặn bởi RB-001** |
| M1-06 | Xong | Command nguyên tử, idempotent, STALE, invariants |
| M1-07 | Xong (luật ứng viên) | SET-011/012 UNRESOLVED |
| M1-08 | Xong | Pending stack (discard, moveRobber); bước event die đặt chỗ cho M2 |
| M1-09 | Xong (luật ứng viên) | Commodity của city kéo từ M2-02 lên vì đơn giản và tránh hành vi base sai |
| M1-10 | Xong | |
| M1-11 | Xong | Chỉ người trong lượt soạn/sửa đề nghị; người nhận đồng ý/từ chối (đề nghị ngược nói miệng rồi người trong lượt sửa) |
| M1-12 | Xong | Knight cắt đường thêm ở M2 |
| M1-13 | Xong | fake-indexeddb trong unit test; kiểm thử thật trên kiosk ở M4 |
| M1-14 | Xong | Fuzz 6 ván ngẫu nhiên × 1500 bước, replay khớp |
| M1-15 | Xong (UI thô) | E2E: ván 3/4 người, setup, tung, reload; giữ-để-xem-bài |

Bằng chứng: `npm run check` (80 unit test) và `npm run test:e2e` (3 E2E) đều đạt ngày 2026-10-10 trong môi trường cloud (Chromium headless, 1920×1080). Chưa thử trên phần cứng cảm ứng.

**Nghiệm thu M1:** engine chạy độc lập UI; test luật đã triển khai pass; reload không đổi roll/draw. Gắn nhãn "bản phát triển", chưa phải C&K.

## M2 — Cơ chế C&K + toàn bộ Progress Cards

| ID | Outcome | Module | Deps | Acceptance | Kiểm chứng | Ưu tiên | Est. | Rủi ro |
|---|---|---|---|---|---|---|---|---|
| M2-01 | Event die + 2 die số tách biệt; event giải quyết trước production | engine | M1-08, RB-002 | T-TRN-001..003 | Vitest | P0 | S | TRN-003 |
| M2-02 | Commodity production + bank commodity + trade commodity | engine | M2-01 | T-PRD-002, T-TRD-002 | Vitest | P0 | S | — |
| M2-03 | City wall + hand limit | engine | M1-10 | T-CON-004/005 | Vitest | P0 | S | — |
| M2-04 | Knights: build/activate/promote/move/displace/chase robber, turn markers | engine | M1-08 | T-KNT-* | Vitest | P0 | L ±3 | Displacement + decision chủ bị đẩy |
| M2-05 | Barbarian track + battle pipeline + decisions + reward + reset + robber activation | engine | M2-04 | T-BAR-* | Vitest | P0 | M ±1 | BAR-006/008 |
| M2-06 | Improvements 3 nhánh + đặc quyền cấp 3 + draw threshold | engine | M2-02 | T-IMP-* | Vitest | P0 | M | IMP-004 |
| M2-07 | Metropolis claim/transfer/protection | engine | M2-06 | T-MET-* | Vitest | P0 | M | MET-004 |
| M2-08 | Progress Card infra: catalog (dữ liệu VERIFIED), decks, draw, hand limit, VP reveal, return policy, handler interface | cards | M2-06, RB-002 | T-PRG-001..008 | Vitest | P0 | M ±1 | Q-01 |
| M2-09 | Handlers Science (10 loại ứng viên) | cards | M2-08 | 4 nhóm test/thẻ | Vitest | P0 | L | — |
| M2-10 | Handlers Trade (6 loại ứng viên) + Merchant | cards | M2-08 | 4 nhóm test/thẻ; T-MER-* | Vitest | P0 | M ±1 | — |
| M2-11 | Handlers Politics (9 loại ứng viên), gồm decision của người khác | cards | M2-08, M2-04 | 4 nhóm test/thẻ | Vitest | P0 | L ±3 | Đa người quyết định |
| M2-12 | Scoring kết hợp + win timing | engine | M2-05,07,10 | T-SCO-* | Vitest | P0 | S | SCO-007 |
| M2-13 | UI chức năng cho mọi luồng M2 | ui | M2-01..12 | E2E ván hoàn chỉnh bằng fixture có nguồn | Playwright | P0 | L | — |
| M2-14 | Coverage report: script đọc matrix + rules-spec → bảng status, CI fail nếu có thẻ placeholder trong preset chuẩn | docs/tools | M2-08 | Report sinh tự động | Script | P1 | S | — |

Có thể chia nhiều PR: (01–03) → (04–05) → (06–07) → (08) → (09/10/11 song song) → (12–14). Không tuyên bố hoàn tất khi còn placeholder.

## M3 — UX tabletop & hướng dẫn

| ID | Outcome | Deps | Acceptance | Kiểm chứng | Ưu tiên | Est. | Rủi ro |
|---|---|---|---|---|---|---|---|
| M3-01 | Layout 3/4 ghế, khay xoay 0/90/180/270, chọn ghế độc lập thứ tự lượt | M2-13 | Screenshot test 4 hướng; E2E thao tác từ mọi khay | Playwright | P0 | M | Kích thước bàn |
| M3-02 | InteractionManager pointer capture, tap-select-confirm, minimap | M3-01 | pointercancel không tạo action; đa điểm từ 2 khay | Playwright (touch emulation) | P0 | M ±1 | Emulation ≠ phần cứng |
| M3-03 | Private session manager + private decision panels | M3-01 | T-PRIV-* pass (marker không lộ DOM/aria/log/toast) | Playwright + unit | P0 | M | — |
| M3-04 | Open Table preset | M3-03 | Chỉ bật lúc tạo; ghi trong save; nhãn kết quả | Vitest + E2E | P1 | S | — |
| M3-05 | Trade UI nhiều người | M3-02 | Người ngoài lượt phản hồi; revision UI | E2E | P0 | M | — |
| M3-06 | Barbarian strip + battle UX | M3-01 | Hiển thị dự kiến, đóng góp từng người | E2E | P0 | S | — |
| M3-07 | Lý do khóa nút cụ thể (public/private) | M3-03 | Mỗi LegalAction bị từ chối có reason code + text vi | Unit | P1 | S | — |
| M3-08 | Log công khai, trợ giúp ngữ cảnh, thuật ngữ en | M3-01 | — | Review | P1 | M | — |
| M3-09 | Animation (có rút gọn/bỏ qua), âm thanh mute/volume | M3-01 | Animation không chặn > 800 ms | E2E đo | P2 | M | — |
| M3-10 | Tutorial thực hành (fixture có nguồn) | M3-01..08 | Người mới hoàn thành lượt đầu không cần nhân viên (đo ở pilot) | Pilot | P1 | M ±1 | — |

## M4 — Pilot & bàn giao

| ID | Outcome | Deps | Acceptance | Kiểm chứng | Ưu tiên | Est. | Rủi ro |
|---|---|---|---|---|---|---|---|
| M4-01 | PWA offline boot + kiosk guide | M3 | Khởi động khi mất mạng sau cài | Playwright offline + máy thật | P0 | S | Chính sách trình duyệt |
| M4-02 | Recovery: mất điện/reload/quota/import | M1-13 | Kịch bản recovery trong test-plan pass | E2E + thủ công | P0 | S | — |
| M4-03 | Performance trên máy đích (< 100 ms phản hồi chạm) | M3 | Số liệu đo được ghi vào báo cáo | Đo thực | P1 | S ±1 | Phần cứng chưa biết |
| M4-04 | Pilot ≥ 1 ván thật trên bàn cảm ứng | M4-01..03, phần cứng | Báo cáo theo mẫu test-plan §6 | Pilot | P0 | M | Chưa có thiết bị → ghi "chưa thực hiện" |
| M4-05 | Tài liệu: README, hướng dẫn nhân viên, coverage, known limitations | tất cả | — | Review | P0 | S | — |

## Rủi ro tổng

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Không đọc được rulebook 2025 | Cao | RB-001; dev preset có nhãn; provenance test chặn preset chuẩn |
| Edition 2025 đổi tên/số thẻ | Trung bình | cardId ổn định; catalog tách handler |
| Bí mật trên màn hình chung | Cao (bản chất) | Mô tả trung thực; private session; Open Table |
| Pipeline/pending phức tạp gây bug khó tái hiện | Cao | Engine thuần, replay test, invariants, fuzz |
| Phần cứng bàn chưa biết | Trung bình | Token kích thước theo mm; pilot sớm ở M3 nếu có máy |
| TS 7/toolchain mới | Thấp | Pin version, ADR |

## Quyết định cần người dùng (không chặn M1 phần độc lập)

1. **Mở quyền truy cập nguồn luật** (RB-001): thêm `www.catan.com` vào Allowed domains của môi trường, hoặc cung cấp PDF.
2. Xác nhận baseline 2025 (mặc định đề xuất) thay vì 2020.
