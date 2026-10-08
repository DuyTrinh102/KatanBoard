# Progress Cards Matrix — Cities & Knights

> **Trạng thái nguồn:** UNRESOLVED toàn bộ. PDF Almanac 2025 (`SRC-CK25`) và 2020 (`SRC-CK20`) không đọc được trong phiên M0 (host bị chặn, xem `rules-spec.md` §1).
> Danh sách thẻ và số bản sao dưới đây là **ứng viên** dựng từ hiểu biết về các edition trước (`M`) và một nguồn thứ cấp (`S`: wiki cộng đồng, chỉ cho bộ Science). Tổng mỗi bộ = 18 khớp với nguồn thứ cấp `S` (3 × 18 = 54).
> **Không được coi là catalog đầy đủ của edition 2025** cho đến khi từng dòng có `source = SRC-CK25 p.N` và trạng thái VERIFIED. Tên thẻ 2025 có thể khác (xem Q-01); vì vậy `cardId` là khóa ổn định, độc lập với tên hiển thị.

## 1. Quy ước

- `cardId`: `sci.*`, `trd.*`, `pol.*` (tiếng Anh, snake_case, không đổi khi đổi tên hiển thị/ngôn ngữ).
- `timing`:
  - `PRE_ROLL_OWN` — chỉ trước khi tung xúc xắc trong lượt của mình.
  - `ACTION_OWN` — action phase lượt của mình (sau khi roll resolution xong).
  - `ON_DRAW_REVEAL` — lật ngay khi rút (thẻ VP), không vào tay.
- `visibility`: thông tin ai thấy khi thẻ được chơi/giải quyết. `PUBLIC` = mọi người; `OWNER` = người chơi thẻ; `TARGET` = người bị nhắm; `OWNER+TARGET` = hai người.
- `returnPolicy`: `BOTTOM_OF_DECK` (ứng viên M: thẻ đã chơi úp xuống đáy bộ cùng màu), `KEEP_FACE_UP` (thẻ VP).
- `implementationStatus`: `NOT_STARTED` | `CATALOG_ONLY` | `HANDLER_DONE` | `TESTED` | `VERIFIED_AGAINST_SOURCE`. Chỉ tính "hoàn thành" khi `TESTED` **và** nguồn VERIFIED.
- `tests`: ID trong `test-plan.md` (mỗi thẻ có tối thiểu: happy path `-H`, invalid timing/target `-I`, edge case `-E`, save/resume giữa hiệu ứng `-R`).

Áp dụng chung cho mọi thẻ `ACTION_OWN` (ứng viên M, chờ xác minh PRG-005): được chơi trong lượt rút; không giới hạn số lá/lượt; không chơi khi đang có pending resolution khác chưa xong; không chơi ngoài lượt.

## 2. Science (xanh lá — màu cần xác minh Q-13) — 18 lá ứng viên

| cardId | category | copies | timing | preconditions | targets | choices | effects | visibility | returnPolicy | source | implementationStatus | tests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `sci.alchemist` | science | 2 (S,M) | PRE_ROLL_OWN | Đang ở PRE_ROLL của chính mình | — | Giá trị die đỏ (1–6) và die vàng (1–6) | Thay việc tung 2 die số bằng giá trị chọn; event die vẫn tung ngẫu nhiên; phần còn lại của roll resolution chạy bình thường (kể cả 7) | PUBLIC (giá trị chọn) | BOTTOM_OF_DECK | M; S (số bản sao) | NOT_STARTED | T-PRG-SCI-ALC-H/I/E/R |
| `sci.crane` | science | 2 (S,M) | ACTION_OWN | Có ≥1 city; có thể nâng 1 nhánh improvement | — | Nhánh muốn nâng | Lần nâng improvement tiếp theo trong lượt rẻ hơn 1 commodity (ứng viên: chỉ 1 lần) | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-CRN-* |
| `sci.engineer` | science | 1 (S,M) | ACTION_OWN | Có city chưa có tường; còn tường trong stock; chưa đạt giới hạn tường | City của mình | City nhận tường | Đặt 1 city wall miễn phí | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-ENG-* |
| `sci.inventor` | science | 2 (S,M) | ACTION_OWN | — | 2 token số trên board | Hai hex | Đổi chỗ 2 token số; ứng viên M: không được chọn token 2, 12, 6, 8 | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-INV-* |
| `sci.irrigation` | science | 2 (S,M) | ACTION_OWN | — | — | — | Nhận 2 grain cho mỗi hex ruộng kề ≥1 công trình của mình (theo bank) | PUBLIC (số lượng) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-IRR-* |
| `sci.medicine` | science | 2 (S,M) | ACTION_OWN | Có settlement; còn city trong stock; đủ 2 ore + 1 grain | Settlement của mình | Settlement | Nâng settlement thành city với chi phí giảm (ứng viên: 2 ore + 1 grain) | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-MED-* |
| `sci.mining` | science | 2 (S,M) | ACTION_OWN | — | — | — | Nhận 2 ore cho mỗi hex núi kề ≥1 công trình của mình (theo bank) | PUBLIC (số lượng) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-MIN-* |
| `sci.printer` | science | 1 (S,M) | ON_DRAW_REVEAL | — | — | — | +1 VP vĩnh viễn; lật ngay, không tính giới hạn tay; kích hoạt kiểm tra thắng theo SCO-007 | PUBLIC | KEEP_FACE_UP | M; S (tên "Printer") | NOT_STARTED | T-PRG-SCI-PRT-* |
| `sci.road_building` | science | 2 (S,M) | ACTION_OWN | Còn road trong stock; có vị trí hợp lệ | Edge hợp lệ | 1–2 edge | Xây tối đa 2 road miễn phí; cập nhật Longest Road sau mỗi road | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-RDB-* |
| `sci.smith` | science | 2 (S,M) | ACTION_OWN | Có knight thăng được (stock cấp cao còn; mighty cần Politics 3) | Knight của mình | 1–2 knight | Thăng cấp tối đa 2 knight miễn phí (vẫn tôn trọng 1 lần/knight/lượt?) | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-SCI-SMI-* |

Tổng ứng viên: 2+2+1+2+2+2+2+1+2+2 = **18**.

## 3. Trade (vàng — cần xác minh) — 18 lá ứng viên

| cardId | category | copies | timing | preconditions | targets | choices | effects | visibility | returnPolicy | source | implementationStatus | tests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `trd.commercial_harbor` | trade | 2 (M) | ACTION_OWN | Có ≥1 tài nguyên để đưa | Mỗi đối thủ (lần lượt) | Người chơi chọn tài nguyên đưa cho từng đối thủ; **đối thủ** chọn commodity trả lại | Trao đổi 1 tài nguyên ↔ 1 commodity với từng đối thủ có commodity | OWNER+TARGET (loại lá), PUBLIC (đã trao đổi) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-CHB-* |
| `trd.master_merchant` | trade | 2 (M) | ACTION_OWN | Có đối thủ có VP > mình | Một đối thủ hợp lệ | Xem tay đối thủ, chọn 2 lá (tài nguyên/commodity) | Lấy 2 lá chọn từ tay đối thủ | OWNER+TARGET (tay bị xem) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-MMC-* |
| `trd.merchant` | trade | 6 (M) | ACTION_OWN | Có hex đất kề công trình của mình (không phải sa mạc?) | Hex | Hex | Đặt/dời merchant; chủ merchant +1 VP và trade 2:1 tài nguyên của hex đó | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-MER-* |
| `trd.merchant_fleet` | trade | 2 (M) | ACTION_OWN | — | — | Một loại tài nguyên hoặc commodity | Hết lượt này, trade loại đã chọn với bank 2:1 không giới hạn số lần | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-MFL-* |
| `trd.resource_monopoly` | trade | 4 (M) | ACTION_OWN | — | Mọi đối thủ | Một loại tài nguyên | Mỗi đối thủ đưa tối đa 2 lá loại đó | PUBLIC (số lượng nhận) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-RMO-* |
| `trd.trade_monopoly` | trade | 2 (M) | ACTION_OWN | — | Mọi đối thủ | Một loại commodity | Mỗi đối thủ đưa tối đa 1 lá loại đó | PUBLIC (số lượng nhận) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-TRD-TMO-* |

Tổng ứng viên: 2+2+6+2+4+2 = **18**.

## 4. Politics (xanh dương — cần xác minh) — 18 lá ứng viên

| cardId | category | copies | timing | preconditions | targets | choices | effects | visibility | returnPolicy | source | implementationStatus | tests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pol.bishop` | politics | 2 (M) | ACTION_OWN | Robber đã "thức" (PRD-007)? — cần xác minh | Hex mới cho robber | Hex | Dời robber; lấy ngẫu nhiên 1 lá từ **mỗi** người có công trình kề hex đó | OWNER+TARGET (lá bị lấy), PUBLIC (số lá) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-BSH-* |
| `pol.constitution` | politics | 1 (M) | ON_DRAW_REVEAL | — | — | — | +1 VP vĩnh viễn, lật ngay | PUBLIC | KEEP_FACE_UP | M | NOT_STARTED | T-PRG-POL-CON-* |
| `pol.deserter` | politics | 2 (M) | ACTION_OWN | Có đối thủ có knight | Một đối thủ | **Đối thủ** chọn knight bỏ; người chơi chọn vị trí đặt knight cùng cấp (nếu có stock & vị trí hợp lệ) | Đối thủ mất 1 knight; người chơi đặt 1 knight cùng sức mạnh miễn phí (trạng thái active/inactive cần xác minh) | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-DES-* |
| `pol.diplomat` | politics | 2 (M) | ACTION_OWN | Có "open road" (một đầu không nối road/công trình của chủ) | Road mở của bất kỳ ai | Road; nếu là road của mình → vị trí mới | Gỡ road mở; nếu của mình có thể đặt lại chỗ khác miễn phí | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-DIP-* |
| `pol.intrigue` | politics | 2 (M) | ACTION_OWN | Có knight đối thủ trên vertex nối road của mình | Knight đối thủ | Knight; **chủ knight** chọn nơi dời (KNT-008) | Đẩy knight đối thủ như displace nhưng không dùng knight của mình | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-INT-* |
| `pol.saboteur` | politics | 2 (M) | ACTION_OWN | — | Mọi người có VP ≥ người chơi | **Từng mục tiêu** chọn lá bỏ (private) | Mỗi mục tiêu bỏ một nửa số lá tài nguyên+commodity (làm tròn xuống) | TARGET (lá bỏ — chỉ công khai số lượng) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-SAB-* |
| `pol.spy` | politics | 3 (M) | ACTION_OWN | Có đối thủ có Progress Card trong tay | Một đối thủ | Xem các Progress Card của đối thủ, chọn 1 (không phải thẻ VP) | Lấy 1 Progress Card; giới hạn tay áp dụng cho người nhận | OWNER+TARGET | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-SPY-* |
| `pol.warlord` | politics | 2 (M) | ACTION_OWN | Có knight inactive | — | — | Kích hoạt miễn phí mọi knight của mình (tác động KNT-005: các knight này có hành động được lượt này không?) | PUBLIC | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-WAR-* |
| `pol.wedding` | politics | 2 (M) | ACTION_OWN | — | Mọi người có VP > người chơi | **Từng mục tiêu** chọn 2 lá đưa (private) | Mỗi mục tiêu đưa 2 lá tài nguyên/commodity tùy chọn (ít hơn nếu không đủ) | OWNER+TARGET (loại lá), PUBLIC (số lượng) | BOTTOM_OF_DECK | M | NOT_STARTED | T-PRG-POL-WED-* |

Tổng ứng viên: 2+1+2+2+2+2+3+2+2 = **18**.

## 5. Phân loại luồng UX/engine bắt buộc (§4.2 prompt)

| Luồng riêng | Thẻ | Yêu cầu engine |
|---|---|---|
| Thẻ điểm | `sci.printer`, `pol.constitution` | Lật khi rút (kể cả ngoài lượt) → score ledger; kiểm tra thắng theo SCO-007; không vào tay |
| Trước khi tung | `sci.alchemist` | Chỉ hợp lệ trong PRE_ROLL; resolution tạo `rollOverride` rồi chạy roll pipeline |
| Xem bài đối phương | `trd.master_merchant`, `pol.spy` | Bắt buộc private session của người chơi thẻ; đối thủ bị xem được thông báo công khai *rằng* tay bị xem, không công khai nội dung |
| Thay đổi board | `sci.inventor`, `pol.diplomat`, `pol.bishop`, `pol.deserter`, `pol.intrigue`, `trd.merchant`, `sci.road_building`, `sci.engineer`, `sci.medicine` | Chọn target trên board hoặc minimap gần ghế; cùng ID graph; tính lại Longest Road/score trong cùng transaction |
| Người khác phải chọn | `trd.commercial_harbor`, `pol.deserter`, `pol.intrigue`, `pol.saboteur`, `pol.wedding` | `decisionOwnerIds` chuyển sang mục tiêu; lựa chọn private; người chơi thẻ không bỏ được giữa chừng |
| Hiệu ứng kéo dài trong lượt | `trd.merchant_fleet`, `sci.crane` | Turn marker `effects[]` hết hạn ở END_TURN, lưu trong save |

## 6. Yêu cầu chung cho handler (thiết kế, không phải luật)

1. **Catalog tách handler**: `cards/catalog.ck2025.ts` chỉ dữ liệu (`cardId`, `deck`, `copies`, `timing`, `ruleRefs`, `source`, `status`); `cards/handlers/<cardId>.ts` chỉ logic.
2. Handler interface: `canPlay(state, playerId) → {ok, reasons[]}` (dùng chung cho nút UI và engine) → `begin(state, ctx) → PendingResolution` → `step(state, resolution, choice) → PendingResolution | Done` → `finish` (trả thẻ theo `returnPolicy`).
3. Phân biệt "không có mục tiêu hợp lệ" (không cho chơi, có lý do cụ thể) với "kết quả bất lợi/không biết trước" (vẫn chơi được, không hoàn thẻ). Ví dụ: `trd.resource_monopoly` khi đối thủ có 0 lá vẫn hợp lệ.
4. Mỗi bước pending resolution serializable (JSON) và resume được sau reload.
5. Test catalog: tổng mỗi bộ = 18, tổng = 54 (khi đã VERIFIED), mỗi `cardId` có handler, mỗi handler có 4 nhóm test.
6. Mọi random (lấy lá ngẫu nhiên Bishop, rút thẻ) đi qua `RandomSource` có seed, kết quả ghi vào log riêng tư.

## 7. Danh sách kiểm tra khi có PDF 2025

- [ ] Đối chiếu tên + số bản sao 25 loại thẻ (10 + 6 + 9 ở trên — cũng có thể 2025 thêm/bớt loại)
- [ ] Màu từng bộ (Q-13)
- [ ] Timing đặc biệt (thẻ nào chơi ngoài lượt? Có thẻ phản ứng không?)
- [ ] Return policy & hand limit (PRG-003/004/007)
- [ ] Câu hỏi riêng thẻ: Smith vs giới hạn 1 thăng/lượt; Warlord vs KNT-005; Bishop trước trận đầu; Deserter trạng thái knight mới; Inventor danh sách token cấm; Merchant trên sa mạc/hex có robber; Crane áp dụng mấy lần.
