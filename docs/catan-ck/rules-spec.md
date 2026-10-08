# Rules Spec — CATAN + Cities & Knights (Coffee Boardgame Digital)

> Trạng thái tài liệu: **Milestone 0 — bản nháp đặc tả. CHƯA có rule nào VERIFIED.**
> Ngày kiểm tra nguồn: 2026-10-08.

## 0. Tóm tắt trung thực

- Baseline đề xuất: **CATAN base 2025 (CN3081) + Cities & Knights 2025 (CN3087)**. Bản C&K 2025 được một mirror ghi là phiên bản `v6.250401` (© 2025 CATAN GmbH) — thông tin này đến từ kết quả tìm kiếm, **chưa tự đọc file**.
- Trong phiên M0 này, môi trường không tải được tài liệu chính thức:
  - `curl` tới `www.catan.com` và `catancollector.com` → proxy trả **403 (egress policy chặn host)**.
  - Công cụ WebFetch → `getaddrinfo ENOTFOUND` cho cả hai host.
  - Chỉ có kết quả **tìm kiếm web** (đoạn trích/tóm tắt, không có số trang, có thể bị trộn edition).
- Vì vậy **mọi rule dưới đây là `UNRESOLVED`**. Cột "Giá trị ứng viên" chỉ để lập kế hoạch, kiến trúc và ước lượng; **không được nhập vào `rules-data` của preset chuẩn** cho đến khi đối chiếu PDF 2025 và đổi trạng thái thành `VERIFIED` kèm số trang.
- Bản C&K 2020 chỉ là tài liệu đối chiếu. Không trộn edition: nếu 2025 khác 2020, dùng 2025 và ghi chênh lệch vào §9.

### Ký hiệu bằng chứng (evidence)

| Mã | Ý nghĩa | Được phép dùng để |
|---|---|---|
| `P` | Đã đọc trực tiếp PDF/FAQ chính thức, có trang/mục | Đánh dấu VERIFIED |
| `S` | Đoạn trích/tóm tắt từ tìm kiếm web (thứ cấp, không có trang) | Gợi ý cần kiểm tra |
| `M` | Hiểu biết về edition cũ (≤2020) của người viết — **mang máng, có thể sai với 2025** | Ước lượng phạm vi, đặt tên config key |
| `—` | Chưa có dữ liệu | — |

Hiện tại không có rule nào có evidence `P`.

### Loại rule

- `OFF` — luật chính thức theo rulebook.
- `FAQ` — giải thích từ FAQ chính thức.
- `DIG` — điều chỉnh số hóa (do sản phẩm quyết định, không phải luật; xem `digital-adaptations.md`).

## 1. Nguồn và pin edition

| Source ID | Tài liệu | URL | Edition | Trạng thái đọc 2026-10-08 |
|---|---|---|---|---|
| `SRC-BASE25` | CATAN – The Game Rulebook (CN3081) | https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf | 2025 (6th ed.) | ❌ host bị chặn (403) |
| `SRC-CK25` | CATAN – Cities & Knights Rulebook (CN3087) | https://www.catan.com/sites/default/files/2025-03/CN3087%20CATAN%E2%80%93Cities%26Knights_%20Rulebook.pdf | 2025, v6.250401 (S) | ❌ host bị chặn (403) |
| `SRC-CK25-MIRROR` | Mirror của CN3087 | https://catancollector.com/images/rules-archive/6e-2025/05-CN3087-CATAN-CitiesKnights-Rulebook.pdf | như trên | ❌ host bị chặn (403) |
| `SRC-CK-FAQ` | FAQ Cities & Knights | https://www.catan.com/faq/cities-knights | không ghi edition | ❌ chỉ có đoạn trích tìm kiếm (S) |
| `SRC-CK20` | C&K 2020 Rule Book & Almanac (đối chiếu) | https://www.catan.com/sites/default/files/2021-06/catan_c_k_2020_rule_book_200708.pdf | 2020 | ❌ host bị chặn (403) |
| `SRC-RULES-IDX` | Danh mục rulebook | https://www.catan.com/understand-catan/game-rules | — | ❌ |
| `SRC-CK-PAGE` | Trang expansion | https://www.catan.com/cities-knights | — | ❌ |

**Hành động gỡ chặn (RB-001 trong implementation plan):** cho phép host `www.catan.com` trong network policy của môi trường, hoặc đặt bản PDF hợp lệ vào `docs/catan-ck/sources/` (đã thêm vào `.gitignore` — không commit file có bản quyền), sau đó chạy lại bước kiểm chứng ở §10.

### 1.1 Những gì đã biết từ tìm kiếm thứ cấp (S)

- C&K có 54 Progress Cards chia 3 bộ 18 (Science/Trade/Politics); có Commodity cards tổng 36 (bộ thay thế 2025 ghi "36 Commodity Cards, 54 Progress Cards").
- C&K hướng đến 13 VP; Progress Card được chơi ngay trong lượt rút, có thể chơi nhiều lá/lượt; giới hạn giữ 4 Progress Card (3–4 người).
- FAQ (đoạn trích): khi tàu Barbarian đến bờ thì trận đánh xảy ra ngay, không được kích hoạt knight nữa; thắng Barbarian khi không có city nào vẫn có phần thưởng; Defender VP vẫn được tính khi đã hết thẻ Defender (dùng vật đánh dấu khác).
- CATAN 6th edition (base) đổi thuật ngữ: "Longest Road" → **"Longest Route"**; development cards được "build" thay vì "buy"; VP cards không còn tên riêng; người đi đầu xác định bằng tung xúc xắc. **Tên thẻ C&K 2025 có thể cũng đã đổi** → catalog phải dùng ID ổn định, tên hiển thị lấy sau khi đọc PDF.
- Có dấu hiệu (S, đoạn trích bị trộn, chưa rõ thuộc tài liệu nào): "trade any 2 identical commodities for any 1 other commodity or resource"; "Knights always become inactive after taking an action"; "promote strong knights (Level 2) to mighty knights (Level 3)".

## 2. Quy ước rule ID

`<MODULE>-<NNN>`; module: `SET` setup, `BRD` board, `PRD` production, `TRN` turn, `TRD` trade, `CON` construction, `KNT` knights, `BAR` barbarians, `IMP` improvements, `MET` metropolis, `PRG` progress cards (chung — chi tiết từng thẻ ở `progress-cards-matrix.md`), `MER` merchant, `SCO` scoring, `INF` information, `DIG` điều chỉnh số hóa.

Mỗi rule có: mô tả do nhóm tự viết · giá trị ứng viên (evidence) · nguồn cần đối chiếu · loại · trạng thái · config key trong `src/games/catan-ck/rules/` · test ID (xem `test-plan.md`).

## 3. Setup & Board

| ID | Quy tắc (diễn đạt riêng) | Giá trị ứng viên (ev.) | Nguồn đối chiếu | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| SET-001 | C&K là expansion, cần bộ base; chế độ chuẩn 3–4 người | 3–4 người (M,S) | CK25 Intro | OFF | UNRESOLVED | `players.min/max` | T-SET-001 |
| SET-002 | Địa hình board mặc định và số lượng | 4 rừng, 4 đồng cỏ, 4 ruộng, 3 đồi, 3 núi, 1 sa mạc = 19 hex (M) | BASE25 Components | OFF | UNRESOLVED | `board.terrainCounts` | T-SET-002 |
| SET-003 | Token số và phân bố | 18 token: 2 và 12 mỗi số 1; 3–6, 8–11 mỗi số 2; không có 7 (M) | BASE25 | OFF | UNRESOLVED | `board.numberTokens` | T-SET-003 |
| SET-004 | Bố cục board "beginner" cố định và/hoặc cách xếp biến đổi; quy tắc không đặt 6/8 cạnh nhau | Có cả hai; 6th ed. khuyên xáo frame (S) | BASE25 Setup | OFF | UNRESOLVED | `board.layouts.*` | T-SET-004 |
| SET-005 | Cảng: số lượng, loại, vị trí trên khung | 9 cảng: 4 cảng 3:1, 5 cảng 2:1 mỗi tài nguyên một (M) | BASE25 | OFF | UNRESOLVED | `board.harbors` | T-SET-005 |
| SET-006 | Ngân hàng tài nguyên | 19 lá mỗi loại (M) | BASE25 Components | OFF | UNRESOLVED | `bank.resources` | T-SET-006 |
| SET-007 | Ngân hàng commodity (paper/cloth/coin) | 12 mỗi loại, tổng 36 (S,M) | CK25 Components | OFF | UNRESOLVED | `bank.commodities` | T-SET-007 |
| SET-008 | Stock quân mỗi người (base) | 15 road, 5 settlement, 4 city (M) | BASE25 | OFF | UNRESOLVED | `stock.base` | T-SET-008 |
| SET-009 | Stock quân C&K mỗi người | 6 knight (2 basic, 2 strong, 2 mighty), 3 city wall (M) | CK25 | OFF | UNRESOLVED | `stock.ck` | T-SET-009 |
| SET-010 | Stock dùng chung | 3 metropolis (mỗi nhánh 1), 1 merchant, 1 tàu barbarian, robber (M) | CK25 | OFF | UNRESOLVED | `stock.shared` | T-SET-010 |
| SET-011 | Thứ tự đặt ban đầu: mỗi người đặt 1 settlement + 1 road, rồi theo chiều ngược 1 **city** + 1 road | settlement trước, city sau (M) — cần xác minh 2025 | CK25 Setup | OFF | UNRESOLVED | `setup.placementOrder` | T-SET-011 |
| SET-012 | Tài nguyên khởi đầu từ công trình đặt thứ hai (city) | 1 tài nguyên/hex kề city, không có commodity (M) | CK25 Setup | OFF | UNRESOLVED | `setup.startingYield` | T-SET-012 |
| SET-013 | Xác định người đi đầu | tung xúc xắc (S cho base 6th ed.) | BASE25/CK25 | OFF | UNRESOLVED | `setup.firstPlayer` | T-SET-013 |
| SET-014 | Vị trí xuất phát robber | sa mạc (M) | BASE25 | OFF | UNRESOLVED | `setup.robberStart` | T-SET-014 |
| SET-015 | Tàu barbarian bắt đầu ở ô xuất phát của track | (M) | CK25 | OFF | UNRESOLVED | `barbarian.start` | T-SET-015 |
| SET-016 | Ba bộ Progress Card xáo riêng, úp | (S) | CK25 Setup | OFF | UNRESOLVED | `cards.decks` | T-SET-016 |
| SET-017 | Base Development Cards và giải Largest Army **không dùng** | (S,M) | CK25 | OFF | UNRESOLVED | `ruleset.excludes` | T-SET-017 |
| BRD-001 | Board là graph hex–vertex–edge; vertex kề ≤3 hex, edge nối 2 vertex | — (cấu trúc, không phải số luật) | — | DIG | n/a (thiết kế) | `topology` | T-BRD-001 |
| BRD-002 | Luật khoảng cách: không có công trình ở vertex kề vertex có công trình | (M) | BASE25 | OFF | UNRESOLVED | `rules.distance` | T-BRD-002 |
| BRD-003 | Đường phải nối với road/công trình của mình; không đi xuyên công trình đối thủ | (M) | BASE25 | OFF | UNRESOLVED | — | T-BRD-003 |
| BRD-004 | Knight chiếm vertex: không thể đặt công trình/knight khác lên; knight đối thủ chặn đường nối và cắt Longest Road | (M) | CK25 Knights | OFF | UNRESOLVED | — | T-BRD-004 |
| BRD-005 | Settlement sau setup phải nối với đường của mình | (M) | BASE25 | OFF | UNRESOLVED | — | T-BRD-005 |

## 4. Production, Turn, Robber

| ID | Quy tắc | Giá trị ứng viên (ev.) | Nguồn | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| TRN-001 | Mỗi lượt tung 3 xúc xắc: 2 die số (đỏ, vàng) + 1 event die | (M,S) | CK25 Turn | OFF | UNRESOLVED | `dice.*` | T-TRN-001 |
| TRN-002 | Mặt event die | 3 mặt tàu, 3 mặt cổng thành (vàng/xanh lá/xanh dương, mỗi màu 1) (M) | CK25 | OFF | UNRESOLVED | `dice.eventFaces` | T-TRN-002 |
| TRN-003 | **Event die được giải quyết trước production** (gồm cả trận barbarian) | (M) | CK25 Turn | OFF | UNRESOLVED | `turn.order` | T-TRN-003 |
| TRN-004 | Thẻ "trước khi tung" (Alchemist) chỉ chơi được ở PRE_ROLL của chính mình | (M,S) | CK25 Almanac | OFF | UNRESOLVED | — | T-TRN-004 |
| TRN-005 | Action phase: build/trade/knight/improvement/card xen kẽ, không theo thứ tự cố định | (M) | BASE25/CK25 | OFF | UNRESOLVED | — | T-TRN-005 |
| TRN-006 | Không chơi Progress Card (ngoài loại được phép) trước khi tung | (M) | CK25 | OFF | UNRESOLVED | — | T-TRN-006 |
| PRD-001 | Settlement trên hex trúng số nhận 1 tài nguyên | (M) | BASE25 | OFF | UNRESOLVED | `production.settlement` | T-PRD-001 |
| PRD-002 | City: ruộng/đồi → 2 tài nguyên; rừng/đồng cỏ/núi → 1 tài nguyên + 1 commodity (paper/cloth/coin) | (M) | CK25 Production | OFF | UNRESOLVED | `production.city` | T-PRD-002 |
| PRD-003 | Ngân hàng thiếu: nếu không đủ một loại cho tất cả người nhận → không ai nhận loại đó (trừ khi chỉ một người nhận thì nhận phần còn lại) | (M) — áp dụng cho commodity? | BASE25/CK25 | OFF | UNRESOLVED | `bank.shortagePolicy` | T-PRD-003 |
| PRD-004 | Hex có robber không sản xuất | (M) | BASE25 | OFF | UNRESOLVED | — | T-PRD-004 |
| PRD-005 | Tung 7: không ai sản xuất; người có quá giới hạn bài phải bỏ một nửa (làm tròn xuống) | giới hạn 7 + 2/city wall (M) | BASE25/CK25 | OFF | UNRESOLVED | `robber.discard` | T-PRD-005 |
| PRD-006 | Bỏ bài tính cả commodity; Progress Card không tính | (M) | CK25 | OFF | UNRESOLVED | — | T-PRD-006 |
| PRD-007 | **Robber "ngủ" đến trận barbarian đầu tiên**: trước đó tung 7 vẫn bỏ bài nhưng không di chuyển robber/không cướp | (M) | CK25 | OFF | UNRESOLVED | `robber.inactiveUntilFirstAttack` | T-PRD-007 |
| PRD-008 | Di chuyển robber: chọn hex khác, cướp 1 lá ngẫu nhiên (tài nguyên hoặc commodity) của người có công trình kề | (M) | BASE25/CK25 | OFF | UNRESOLVED | — | T-PRD-008 |
| PRD-009 | Aqueduct (Science cấp 3): khi tung số (không phải 7) mà mình không nhận gì → chọn 1 tài nguyên | (M) | CK25 Improvements | OFF | UNRESOLVED | `improvements.science.lvl3` | T-PRD-009 |

## 5. Trade & Construction

| ID | Quy tắc | Giá trị ứng viên (ev.) | Nguồn | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| TRD-001 | Domestic trade chỉ khi có người đang trong lượt tham gia; người ngoài lượt không trade với nhau | (M) | BASE25 | OFF | UNRESOLVED | — | T-TRD-001 |
| TRD-002 | Commodity được trade như tài nguyên (domestic & maritime) | (M) | CK25 | OFF | UNRESOLVED | — | T-TRD-002 |
| TRD-003 | Maritime: 4:1 với bank; cảng 3:1; cảng 2:1 cho đúng loại tài nguyên | (M) | BASE25 | OFF | UNRESOLVED | `trade.ratios` | T-TRD-003 |
| TRD-004 | Không trade Progress Card, không trade "miễn phí"/tặng, không trade cùng loại | (M) | BASE25/CK25 | OFF | UNRESOLVED | — | T-TRD-004 |
| TRD-005 | Trade cấp 3 (Merchant Guild/Trading House): 2:1 commodity → bất kỳ tài nguyên/commodity | (M,S) | CK25 Improvements | OFF | UNRESOLVED | `improvements.trade.lvl3` | T-TRD-005 |
| TRD-006 | Trade có thể xen với build trong action phase | (M) | BASE25 | OFF | UNRESOLVED | — | T-TRD-006 |
| CON-001 | Road: 1 brick + 1 lumber | (M) | BASE25 | OFF | UNRESOLVED | `costs.road` | T-CON-001 |
| CON-002 | Settlement: brick + lumber + wool + grain | (M) | BASE25 | OFF | UNRESOLVED | `costs.settlement` | T-CON-002 |
| CON-003 | City: 2 grain + 3 ore; settlement trả về stock | (M) | BASE25 | OFF | UNRESOLVED | `costs.city` | T-CON-003 |
| CON-004 | City wall: 2 brick; chỉ dưới city của mình; tối đa 3/người; +2 giới hạn bài mỗi tường | (M) | CK25 | OFF | UNRESOLVED | `costs.wall`, `walls.*` | T-CON-004 |
| CON-005 | City wall **không** bảo vệ khỏi barbarian; mất khi city bị hạ cấp | (M) | CK25 | OFF | UNRESOLVED | — | T-CON-005 |
| CON-006 | Hết quân trong stock thì không xây được loại đó | (M) | BASE25 | OFF | UNRESOLVED | — | T-CON-006 |

## 6. Knights & Barbarians

| ID | Quy tắc | Giá trị ứng viên (ev.) | Nguồn | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| KNT-001 | Xây knight basic: 1 wool + 1 ore; đặt trên vertex trống nối road của mình; đặt ở trạng thái inactive | (M) | CK25 Knights | OFF | UNRESOLVED | `costs.knight` | T-KNT-001 |
| KNT-002 | Kích hoạt knight: 1 grain | (M) | CK25 | OFF | UNRESOLVED | `costs.activate` | T-KNT-002 |
| KNT-003 | Thăng cấp: 1 wool + 1 ore; mỗi knight tối đa 1 lần/lượt; giữ trạng thái active/inactive | (M) | CK25 | OFF | UNRESOLVED | `costs.promote` | T-KNT-003 |
| KNT-004 | Thăng lên mighty (cấp 3) cần Politics cấp 3 (Fortress) | (M,S) | CK25 | OFF | UNRESOLVED | `improvements.politics.lvl3` | T-KNT-004 |
| KNT-005 | **Knight vừa kích hoạt trong lượt này không được hành động lượt này** | (M) | CK25 | OFF | UNRESOLVED | `knight.activationDelay` | T-KNT-005 |
| KNT-006 | Mỗi knight tối đa 1 hành động/lượt; sau hành động trở thành inactive | (M,S) | CK25 | OFF | UNRESOLVED | — | T-KNT-006 |
| KNT-007 | Di chuyển: dọc road liên tục của mình tới vertex trống | (M) | CK25 | OFF | UNRESOLVED | — | T-KNT-007 |
| KNT-008 | Đẩy (displace): tới vertex có knight đối thủ **yếu hơn** nối mạng road; knight bị đẩy được chủ di chuyển tới vertex hợp lệ, nếu không có thì bị loại về stock | (M) | CK25 | OFF | UNRESOLVED | — | T-KNT-008 |
| KNT-009 | Đuổi robber: knight active kề hex có robber → dời robber + cướp như tung 7 | (M) | CK25 | OFF | UNRESOLVED | — | T-KNT-009 |
| KNT-010 | Knight cấp 1 khi stock hết cấp cao hơn: không thăng được | (M) | CK25 | OFF | UNRESOLVED | — | T-KNT-010 |
| BAR-001 | Tàu tiến 1 ô mỗi khi event die ra mặt tàu | (M) | CK25 | OFF | UNRESOLVED | `barbarian.track` | T-BAR-001 |
| BAR-002 | Độ dài track (số bước tới bờ) | 7 bước (M) | CK25 | OFF | UNRESOLVED | `barbarian.trackLength` | T-BAR-002 |
| BAR-003 | Sức mạnh barbarian = tổng số city + metropolis trên bàn (mọi người) | (M) | CK25 | OFF | UNRESOLVED | `barbarian.strength` | T-BAR-003 |
| BAR-004 | Phòng thủ = tổng cấp các knight **active** của mọi người | (M) | CK25 | OFF | UNRESOLVED | — | T-BAR-004 |
| BAR-005 | Trận xảy ra ngay khi tàu đến bờ; không được kích hoạt thêm knight | (S — FAQ) | CK-FAQ | FAQ | UNRESOLVED | — | T-BAR-005 |
| BAR-006 | Thua (phòng thủ < sức mạnh): trong số người **có ít nhất một city không phải metropolis**, người có tổng knight active thấp nhất mất 1 city → settlement (hòa thấp nhất: tất cả cùng mất); người tự chọn city | (M) | CK25 | OFF | UNRESOLVED | `barbarian.loss` | T-BAR-006 |
| BAR-007 | Người không có city hợp lệ (chỉ có metropolis/không có city) không bị tính vào tập "thấp nhất" | (M) | CK25 | OFF | UNRESOLVED | — | T-BAR-007 |
| BAR-008 | Thắng (phòng thủ ≥ sức mạnh): người đóng góp nhiều nhất duy nhất nhận Defender of Catan (1 VP); hòa → mỗi người hòa chọn rút 1 Progress Card từ bộ tùy chọn | (M,S) — hòa mức "≥" cần xác minh | CK25/FAQ | OFF | UNRESOLVED | `barbarian.win` | T-BAR-008 |
| BAR-009 | Hết thẻ Defender vẫn nhận VP (marker thay thế) | (S — FAQ) | CK-FAQ | FAQ | UNRESOLVED | — | T-BAR-009 |
| BAR-010 | Sau trận: mọi knight → inactive; tàu về đầu track | (M) | CK25 | OFF | UNRESOLVED | — | T-BAR-010 |
| BAR-011 | Trận đầu tiên kích hoạt robber (liên kết PRD-007) | (M) | CK25 | OFF | UNRESOLVED | — | T-BAR-011 |
| BAR-012 | Thứ tự giải quyết lựa chọn của nhiều người mất city (đồng thời hay theo lượt) | — | CK25 | OFF | UNRESOLVED | `barbarian.choiceOrder` | T-BAR-012 |

## 7. Improvements, Metropolis, Merchant

| ID | Quy tắc | Giá trị ứng viên (ev.) | Nguồn | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| IMP-001 | Ba nhánh: Trade (vàng, cloth), Politics (xanh dương, coin), Science (xanh lá, paper) | màu/commodity (M); màu bộ thẻ có nguồn thứ cấp mâu thuẫn (S) | CK25 | OFF | UNRESOLVED | `improvements.tracks` | T-IMP-001 |
| IMP-002 | Mỗi nhánh 5 cấp; cấp n tốn n commodity loại tương ứng | (M) | CK25 | OFF | UNRESOLVED | `improvements.costs` | T-IMP-002 |
| IMP-003 | Phải có ít nhất 1 city (hoặc metropolis) để nâng cấp | (M) | CK25 | OFF | UNRESOLVED | — | T-IMP-003 |
| IMP-004 | Mất hết city: giữ cấp đã có hay không, có dùng đặc quyền không | — | CK25/FAQ | OFF | UNRESOLVED | `improvements.lossPolicy` | T-IMP-004 |
| IMP-005 | Đặc quyền cấp 3 mỗi nhánh (xem TRD-005, KNT-004, PRD-009) | (M) | CK25 | OFF | UNRESOLVED | `improvements.*.lvl3` | T-IMP-005 |
| IMP-006 | Ngưỡng rút Progress Card theo cấp: cổng màu X + die đỏ ≤ (cấp nhánh X + 1) | cấp 1: đỏ 1–2 … cấp 5: 1–6 (M) | CK25 | OFF | UNRESOLVED | `improvements.drawThreshold` | T-IMP-006 |
| MET-001 | Người đầu tiên đạt cấp 4 của nhánh nhận metropolis của nhánh, đặt lên một city của mình | (M) | CK25 | OFF | UNRESOLVED | `metropolis.*` | T-MET-001 |
| MET-002 | Người khác đạt cấp 5 trước thì giành metropolis đó; ai đạt cấp 5 trước giữ vĩnh viễn | (M) | CK25 | OFF | UNRESOLVED | — | T-MET-002 |
| MET-003 | Metropolis +2 VP (city 2 + 2 = 4); không bị barbarian hạ cấp; mỗi city tối đa 1 metropolis | (M) | CK25 | OFF | UNRESOLVED | `scoring.metropolis` | T-MET-003 |
| MET-004 | Không có city trống để đặt metropolis → không được nâng lên cấp 4 (hay vẫn được?) | — | CK25/FAQ | OFF | UNRESOLVED | — | T-MET-004 |
| MER-001 | Merchant đặt qua thẻ Trade "Merchant" lên hex đất kề settlement/city của mình; người sở hữu trade 2:1 tài nguyên của hex đó; +1 VP khi giữ | (M) | CK25 Almanac | OFF | UNRESOLVED | `merchant.*` | T-MER-001 |
| MER-002 | Người khác chơi Merchant thì merchant chuyển chủ | (M) | CK25 | OFF | UNRESOLVED | — | T-MER-002 |

## 8. Progress Cards (chung), Scoring, Information

| ID | Quy tắc | Giá trị ứng viên (ev.) | Nguồn | Loại | Trạng thái | Config key | Test |
|---|---|---|---|---|---|---|---|
| PRG-001 | 54 thẻ = 3 bộ × 18 (Science/Trade/Politics) | (S) | CK25 Components | OFF | UNRESOLVED | `cards.catalog` | T-PRG-001 |
| PRG-002 | Rút khi event die ra cổng màu X và die đỏ thỏa IMP-006; mọi người đủ điều kiện đều rút (thứ tự rút?) | (M) | CK25 | OFF | UNRESOLVED | `cards.drawOrder` | T-PRG-002 |
| PRG-003 | Giới hạn giữ 4 Progress Card (không tính thẻ VP đã lật) | (S,M) | CK25 | OFF | UNRESOLVED | `cards.handLimit` | T-PRG-003 |
| PRG-004 | Vượt giới hạn: ngoài lượt → bỏ ngay 1 lá (về đáy bộ); trong lượt → có thể chơi trước khi bỏ? | (M) | CK25 | OFF | UNRESOLVED | `cards.overLimitPolicy` | T-PRG-004 |
| PRG-005 | Chơi được trong lượt rút; nhiều lá/lượt; không giới hạn 1 lá như dev card base | (S) | CK25 | OFF | UNRESOLVED | — | T-PRG-005 |
| PRG-006 | Thẻ VP (Printer/Constitution — tên 2025 cần xác minh) lật ngay khi rút, không tính vào giới hạn tay | (M) | CK25 Almanac | OFF | UNRESOLVED | — | T-PRG-006 |
| PRG-007 | Thẻ đã chơi trả về đáy bộ tương ứng (úp) | (M) | CK25 | OFF | UNRESOLVED | `cards.returnPolicy` | T-PRG-007 |
| PRG-008 | Bộ hết thẻ thì không rút được | (M) | CK25 | OFF | UNRESOLVED | — | T-PRG-008 |
| SCO-001 | Settlement 1 VP, city 2 VP | (M) | BASE25 | OFF | UNRESOLVED | `scoring.buildings` | T-SCO-001 |
| SCO-002 | Longest Road/Route ≥5 đoạn liên tục: 2 VP; hòa giữ chủ cũ; knight/công trình đối thủ cắt đường | (M); tên "Longest Route" ở 6th ed. (S) | BASE25 | OFF | UNRESOLVED | `scoring.longestRoad` | T-SCO-002 |
| SCO-003 | Longest Road bị cắt và hòa giữa nhiều người mới → không ai giữ | (M) | BASE25 | OFF | UNRESOLVED | — | T-SCO-003 |
| SCO-004 | Defender of Catan: 1 VP mỗi thẻ | (M) | CK25 | OFF | UNRESOLVED | `scoring.defender` | T-SCO-004 |
| SCO-005 | Metropolis +2, Merchant +1, thẻ VP +1 mỗi lá | (M) | CK25 | OFF | UNRESOLVED | `scoring.*` | T-SCO-005 |
| SCO-006 | Ngưỡng thắng 13 VP | (S) | CK25 | OFF | UNRESOLVED | `scoring.target` | T-SCO-006 |
| SCO-007 | Thắng chỉ được tuyên bố trong lượt của mình (đạt ngưỡng ngoài lượt → thắng khi tới lượt mình nếu vẫn đủ) | (M) | BASE25/CK25 | OFF | UNRESOLVED | `scoring.winTiming` | T-SCO-007 |
| SCO-008 | Không có Largest Army | (S) | CK25 | OFF | UNRESOLVED | — | T-SCO-008 |
| INF-001 | Công khai: board, quân, cấp improvement, metropolis, merchant, vị trí tàu, số lá tài nguyên+commodity mỗi người, số Progress Card mỗi người, thẻ VP đã lật | (M) | BASE25/CK25 | OFF | UNRESOLVED | `visibility.*` | T-INF-001 |
| INF-002 | Bí mật: loại lá trong tay (resource/commodity), Progress Card trong tay | (M) | — | OFF | UNRESOLVED | — | T-INF-002 |
| INF-003 | Màu/bộ của Progress Card trong tay có công khai không | — | CK25 | OFF | UNRESOLVED | — | T-INF-003 |

## 9. Câu hỏi mở theo edition (phải đóng khi đọc PDF 2025)

| Q-ID | Câu hỏi | Ảnh hưởng | Rule liên quan |
|---|---|---|---|
| Q-01 | Tên/ID và số bản sao từng Progress Card trong 2025 có khác 2020 không? (6th ed. base đổi nhiều thuật ngữ) | Catalog, UI text | PRG-001, ma trận |
| Q-02 | Thứ tự đặt ban đầu (settlement → city) và nguồn tài nguyên khởi đầu | Setup flow | SET-011/012 |
| Q-03 | Robber có còn "ngủ" đến trận đầu tiên không | Turn flow | PRD-007, BAR-011 |
| Q-04 | Barbarian thắng khi phòng thủ **bằng** sức mạnh? | Kết quả trận | BAR-006/008 |
| Q-05 | Thứ tự rút Progress Card khi nhiều người đủ điều kiện, và khi bộ còn ít thẻ | Fairness, deck state | PRG-002/008 |
| Q-06 | Chính sách vượt giới hạn 4 thẻ trong/ngoài lượt | Decision queue | PRG-004 |
| Q-07 | Mất hết city: improvement & đặc quyền | Improvements | IMP-004 |
| Q-08 | Metropolis khi không còn city trống | Improvements | MET-004 |
| Q-09 | Thời điểm thắng (ngoài lượt) và đối với thẻ VP rút ngoài lượt | Win check | SCO-007 |
| Q-10 | Ngân hàng thiếu commodity áp dụng như tài nguyên? | Production | PRD-003 |
| Q-11 | Có "special build phase"? — chỉ thấy ở bản 5–6 người (S); xác nhận không có ở 3–4 | Turn | TRN-005 |
| Q-12 | Knight cấp và stock: hạ cấp thẻ (Deserter/…) khi stock cấp đó hết | Card handlers | KNT-010, PRG matrix |
| Q-13 | Màu bộ Progress Card (nguồn thứ cấp mâu thuẫn) | UI | IMP-001 |
| Q-14 | Thuật ngữ "Longest Route" có áp dụng trong C&K 2025 | UI text | SCO-002 |

## 10. Quy trình kiểm chứng khi có nguồn

1. Tải PDF vào `docs/catan-ck/sources/` (gitignored), ghi SHA-256 + ngày vào bảng §1.
2. Với từng rule: đọc mục, viết lại bằng lời mình, ghi `SRC-xxx p.N §…`, đổi evidence → `P`, trạng thái → `VERIFIED` hoặc ghi xung đột.
3. Cập nhật `rules-data` (`src/games/catan-ck/rules/ck2025.ts`) — mỗi hằng số kèm `ruleId` và `source`. Test `rules-data.provenance.test.ts` thất bại nếu preset chuẩn chứa giá trị có `status !== 'VERIFIED'`.
4. Đóng câu hỏi §9, ghi chênh lệch 2020↔2025 vào bảng dưới.

### 10.1 Chênh lệch 2020 ↔ 2025

_Chưa có — cần đọc cả hai bản._

## 11. Điều chỉnh số hóa (DIG) liên quan luật

Chi tiết ở `digital-adaptations.md`. Tóm tắt các rule ID: DIG-001 private session, DIG-002 Open Table, DIG-003 xác nhận hành động, DIG-004 timer nhắc, DIG-005 undo giới hạn, DIG-006 thu thập lựa chọn đồng thời, DIG-007 rút ngẫu nhiên bằng PRNG có seed.
