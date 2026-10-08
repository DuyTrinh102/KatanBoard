# Prompt cho Claude Code — Coffee Boardgame Digital / CATAN: Cities & Knights

Ngày chuẩn bị: 09/10/2026.

## Cách sử dụng

Đặt file này tại thư mục gốc repository và yêu cầu Claude Code đọc toàn bộ. Lượt đầu chỉ thực hiện Milestone 0: khảo sát repo, kiểm chứng luật, thiết kế trải nghiệm và lập kế hoạch. Chưa yêu cầu code toàn bộ game ngay. Các câu lệnh triển khai tiếp nằm cuối file.

Kế thừa bối cảnh Waterfall Park: một màn hình cảm ứng nằm ngang tại quán cà phê, người chơi ngồi quanh bàn; offline trong ván; điện thoại không bắt buộc. Đây là game tiếp theo trong bộ Coffee Boardgame Digital. Không giả định Waterfall Park đã được triển khai nếu repo chưa có.

---

# Bắt đầu prompt

Bạn là senior game developer kiêm technical lead, có kinh nghiệm về board game theo lượt, engine luật deterministic và giao diện tabletop cảm ứng. Hãy lập kế hoạch rồi triển khai CATAN kết hợp bản mở rộng Cities & Knights trong sản phẩm Coffee Boardgame Digital theo các milestone bên dưới.

## 1. Mục tiêu sản phẩm

Nhiều người ngồi quanh một bàn cảm ứng tại quán cà phê, tương tác trực tiếp và thương lượng bằng lời nói. Máy quản lý luật, tài nguyên, giao dịch, hành động, sự kiện và điểm. Giữ cảm giác chơi board game; không biến mọi hoạt động thành biểu mẫu.

Trải nghiệm cần làm rõ hai quyết định chiến thuật: phát triển kinh tế của mình và đóng góp phòng thủ chung. Người chơi phải hiểu điều gì đang xảy ra, ai đang cần thao tác và vì sao một hành động bị từ chối.

Mục tiêu là prototype chơi được trọn ván, sau đó pilot trên bàn thật. Không coi giao diện đẹp hoặc demo vài lượt là hoàn thành game.

## 2. Phạm vi và mặc định thiết kế

| Hạng mục | Phạm vi |
|---|---|
| Chế độ chính | CATAN base game + Cities & Knights |
| Người chơi MVP | 3–4 người thật tại cùng bàn |
| Hai người | Roadmap biến thể riêng; không tự thêm bot hoặc coi là luật chuẩn |
| 5–6 người | Roadmap; cần đặc tả extension riêng, không chỉ tăng giới hạn playerCount |
| Màn hình | Cảm ứng nằm ngang, người chơi ngồi quanh bốn cạnh |
| Điều khiển | Cảm ứng chính; chuột phục vụ phát triển/dự phòng |
| Ngôn ngữ | Tiếng Việt; có thuật ngữ tiếng Anh trong trợ giúp |
| Điện thoại | Không cần trong MVP; companion riêng tư để sau |
| Kết nối | Một máy; hoàn thành ván khi mất Internet |
| Hình ảnh | 2D rõ ràng, asset tự tạo hoặc có quyền sử dụng |
| Layout tham chiếu | 1920×1080, kiểm tra thêm 4K; kích thước bàn thật chưa xác định |
| Thời lượng | Giữ luật chuẩn; timer chỉ nhắc, không tự kết thúc lượt |
| Ngoài MVP | Online multiplayer, tài khoản, matchmaking, AI bot, 3D, thanh toán, các expansion khác |

Sản phẩm tổng thể hướng đến nhóm từ 2 người, nhưng từng game có phạm vi riêng. Không mang luật trao đổi tài sản của Waterfall Park sang Catan. Không buộc người chơi sử dụng điện thoại để hoàn thành các hành động cốt lõi.

## 3. Nguồn luật và quản lý phiên bản

Nguồn chính thức:

- Danh mục rulebook: https://www.catan.com/understand-catan/game-rules
- Trang expansion: https://www.catan.com/cities-knights
- Rulebook Cities & Knights 2025: https://www.catan.com/sites/default/files/2025-03/CN3087%20CATAN%E2%80%93Cities%26Knights_%20Rulebook.pdf
- Rulebook base 2025: https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf
- FAQ expansion: https://www.catan.com/faq/cities-knights
- Bản lưu trữ Cities & Knights 2020 để đối chiếu, không âm thầm trộn edition: https://www.catan.com/sites/default/files/2021-06/catan_c_k_2020_rule_book_200708.pdf

Baseline đề xuất là bộ rulebook 2025 của base và expansion. Đầu tiên phải đọc và pin edition, URL, ngày kiểm tra, trang/mục. Nếu không tải/đọc được tài liệu, ghi UNRESOLVED; tiếp tục kiến trúc và phần độc lập, không tuyên bố đã xác minh toàn bộ. Bản 2020 chỉ là tài liệu đối chiếu nếu chưa quyết định đổi baseline rõ ràng.

Tại thời điểm chuẩn bị prompt, trang game, danh mục tài liệu và FAQ đã được đối chiếu. Hai PDF 2025 gặp giới hạn tải của công cụ đọc, nên prompt này không phải rules-spec 2025 đã được kiểm chứng đầy đủ. Milestone 0 phải giải quyết việc đọc tài liệu trước khi chốt các bảng dữ liệu và ngoại lệ.

Tạo `docs/catan-ck/rules-spec.md`: mỗi rule có ID, mô tả do mình viết, source/trang, edition, trạng thái VERIFIED/UNRESOLVED, dữ liệu cấu hình, test tương ứng. Phân biệt luật chính thức, giải thích FAQ và điều chỉnh số hóa. Khi nguồn xung đột, ghi vấn đề cụ thể, không dùng kiến thức nhớ mang máng để điền vào.

Các mốc kiểm tra khái niệm: đây là expansion cần base game; chế độ chuẩn 3–4 người. C&K hướng đến 13 điểm, khởi đầu có settlement và city, sử dụng Progress Cards thay bộ Development Cards cơ bản; không có giải Largest Army. Cần xác minh chi tiết setup, tính điểm và thời điểm thắng theo edition đã pin.

Không chép nguyên văn rulebook hoặc dùng ảnh thẻ chính thức làm asset mặc định. Giữ nguồn tham khảo trong tài liệu; viết hướng dẫn ngắn bằng lời của mình.

## 4. Rule coverage bắt buộc trước khi gọi là hoàn thành

Đây là danh mục công việc đặc tả, không thay thế rulebook. Chuyển từng nhóm thành rule IDs, bảng cấu hình và test cases.

| Module | Những điều phải xác minh và đặc tả |
|---|---|
| Setup | Thành phần/số lượng, địa hình, token số, cảng, stock quân, thứ tự đặt ban đầu, tài nguyên khởi đầu |
| Board | Quan hệ hex–vertex–edge, điều kiện nối đường, khoảng cách công trình, điểm bị chiếm/chặn |
| Production | Hai xúc xắc số, sản lượng settlement/city, commodity, ngân hàng thiếu hàng, Robber |
| Turn | Thứ tự event/production/action, quyền hành động, xử lý lựa chọn của người ngoài lượt |
| Trade | Domestic/maritime trade, cảng, commodity, hiệu ứng giảm tỷ lệ, điều kiện giao dịch hợp lệ |
| Construction | Đường, settlement, city, city wall; chi phí, stock, nâng cấp và trả quân |
| Knights | Xây, kích hoạt, thăng cấp, di chuyển, đẩy quân, đuổi Robber; giới hạn mỗi lượt và đường đi |
| Barbarians | Track, thời điểm tấn công, sức mạnh, thắng/thua/hòa đóng góp, phần thưởng, hạ cấp city, reset |
| Improvements | Ba nhánh, chi phí/cấp, điều kiện có city, đặc quyền, tương tác sau khi mất city |
| Metropolis | Điều kiện nhận/chuyển quyền, chọn city, giới hạn, bảo vệ và điểm |
| Progress Cards | Toàn bộ loại và số bản sao, điều kiện nhận/chơi/trả, lựa chọn mục tiêu, ngoại lệ, giới hạn tay |
| Merchant | Quyền sở hữu, vị trí, giao thương, điểm và chuyển quyền |
| Scoring | Điểm công trình, Longest Road, Defender, metropolis, merchant, thẻ điểm và thời điểm kết thúc |
| Information | Dữ liệu công khai, bí mật, thông tin được tiết lộ bởi từng hiệu ứng |

Tạo `rules-data` có nguồn cho board mặc định, bank, stock, costs, dice faces, track, improvement tracks và card catalog. Không suy ra luật từ icon hoặc UI. Không nhúng số chưa kiểm chứng rải rác trong component.

### 4.1 Các lỗi luật cần chủ động ngăn chặn

- Không dùng một vòng hành động tuyến tính buộc người chơi giao dịch xong mới được xây; action phase phải hỗ trợ xen kẽ các hành động hợp lệ.
- Không xem mọi xúc xắc là cùng chức năng; tách event die và từng die số.
- Không lấy sản lượng trước rồi mới xử lý hậu quả sự kiện có thể thay đổi bàn.
- Không nhầm kích hoạt knight với quyền thực hiện ngay knight action; mô hình hóa lịch sử của quân qua từng lượt.
- Không bỏ người chơi ngoài lượt khỏi hàng đợi quyết định bắt buộc.
- Không áp luật Development Cards của base sang Progress Cards một cách máy móc.
- Không dùng city wall làm lá chắn chống Barbarians.
- Không coi mọi người ít knight nhất đều đương nhiên mất city; xác định tập người có city hợp lệ để bị ảnh hưởng.
- Không cho giao dịch Progress Cards hoặc mua bán công trình như Waterfall Park.
- Không coi đạt ngưỡng điểm ngoài lượt luôn là kết thúc ngay; cần kiểm tra điều kiện thắng ở đúng thời điểm.

Những điểm này là checklist đọc nguồn. Mọi ngoại lệ phải được rule engine quyết định theo edition đã pin.

### 4.2 Progress Cards phải là tính năng hoàn chỉnh

Tạo `docs/catan-ck/progress-cards-matrix.md`, mỗi loại thẻ một dòng với:

`cardId | category | copies | timing | preconditions | targets | choices | effects | visibility | returnPolicy | source | implementationStatus | tests`

- Catalog tách khỏi handler. Dùng ID ổn định, không dùng tên tiếng Việt làm khóa logic.
- Handler có validate → request choices → resolve effects → return card đúng quy tắc.
- Hiệu ứng nhiều bước dùng pending resolution có thể lưu/khôi phục. Không dùng chuỗi modal tự giữ state riêng.
- Điều kiện hiển thị nút và điều kiện engine phải dùng cùng nguồn.
- Nếu lá bài yêu cầu người khác chọn, chuyển quyền quyết định cụ thể cho người đó rồi mới tiếp tục.
- Phân biệt hết mục tiêu hợp lệ với không biết trước kết quả; không tự cho hoàn thẻ khi kết quả bất lợi.
- Thẻ điểm, thẻ trước khi tung xúc xắc, thẻ xem bài đối phương và thẻ thay đổi board cần luồng riêng.
- Có ma trận đối chiếu tất cả loại thẻ và số bản sao với nguồn. Đừng gọi một tập thẻ mẫu là bản expansion đầy đủ.

## 5. Trải nghiệm tabletop và thông tin riêng

### 5.1 Bố cục

- Board ở giữa, khay người chơi sát ghế; tên, chữ và nút xoay theo người đó.
- Vẽ riêng layout 3 người và 4 người. Ghế/orientation độc lập với playerId/thứ tự lượt.
- Không xoay board toàn cục mỗi khi đổi lượt. Các chi tiết giữa bàn có popover xoay theo người đang đọc.
- Thanh Barbarians luôn dễ thấy: vị trí hiện tại, sức mạnh dự kiến theo bàn hiện tại, tổng phòng thủ hiện tại và đóng góp từng người. Ghi rõ dự kiến có thể đổi khi state đổi.
- Hiển thị công khai tiến độ nâng cấp và các danh hiệu theo rules-spec.
- Vùng action gần người đang thao tác, có build menu, trade, knights, improvements, cards và end turn.
- Chọn vị trí bằng chạm trực tiếp hoặc bản xem thu nhỏ gần ghế; cả hai tham chiếu cùng ID. Không bắt người chơi liên tục với qua giữa bàn.
- Bảng chi phí/tra luật mở theo ngữ cảnh. Lý do nút bị khóa phải cụ thể, ví dụ thiếu tài nguyên hay không đúng thời điểm.
- Màu + biểu tượng + tên phân biệt người chơi; không chỉ dùng màu. Không bắt buộc hover hoặc bàn phím.

### 5.2 Bài riêng: phải mô tả trung thực giới hạn

Một màn hình nhìn chung không bảo đảm bí mật bằng CSS, xoay khay hoặc PIN. Người ngồi bên cạnh vẫn có thể nhìn thấy. MVP giữ phương án xem riêng mang tính thỏa thuận tại bàn:

1. Mỗi người có khay úp. Chỉ một private session được mở tại một thời điểm.
2. Nhấn giữ để xem; thả, pointercancel, mất focus, pause hoặc đổi người thì che ngay.
3. Người khác quay đi/người xem che khu vực màn hình. Hướng dẫn ngắn nói rõ điều này.
4. Hành động cần chọn nhiều bước như bỏ bài, chọn bài trao đổi hoặc hiệu ứng xem bài dùng private session: tạm che board khi cần, chọn trong vùng gần ghế và che trước khi bàn giao.
5. Dữ liệu riêng không xuất hiện trong toast, public log, tooltip, accessibility label, animation hoặc lỗi. ViewModel quyết định dữ liệu được đưa ra UI; không chỉ blur chữ vẫn có sẵn trong public component.
6. Debug panel/export đầy đủ thuộc vùng quản trị, không hiện trong chế độ chơi.

Tạo bảng public/private chi tiết cho hand, card category/count, bài đang chọn, kết quả lấy ngẫu nhiên và thông tin tiết lộ theo hiệu ứng. Những gì luật cho phép công khai vẫn hiển thị bình thường.

Thêm preset tùy chọn `Open Table — Chơi mở`: thông tin bí mật được công khai để dễ học. Ghi rõ đây là điều chỉnh trải nghiệm và có thể thay đổi chiến thuật. Người tạo ván phải chọn chủ động; không bật ngầm và không đổi giữa ván.

Companion điện thoại/QR để roadmap. Thiết kế view projection sẵn để sau này bổ sung, nhưng chưa xây network/auth trong MVP. Chế độ xem riêng tại bàn không được mô tả là chống gian lận.

### 5.3 Danh sách màn hình/luồng

Launcher → tạo ván/chọn ghế → hướng dẫn ngắn → setup bàn → đặt quân khởi đầu → chơi theo lượt → kết quả.

Các luồng trong ván: tung xúc xắc; giải quyết sự kiện; nhận tài nguyên; lựa chọn bắt buộc; xây dựng; trade; knight; improvement; Progress Card; trận Barbarians; chọn city bị ảnh hưởng; metropolis; Longest Road/điểm; kết thúc lượt; pause/resume.

Không dùng modal toàn màn hình cho mọi thông báo. Chỉ chặn tiến trình khi luật cần lựa chọn hoặc khi cần xem riêng. Animation giải thích kết quả, không quyết định kết quả; có rút gọn/bỏ qua hiệu ứng.

## 6. State machine và quyền thao tác

Đề xuất khung state: `SETUP → PRE_ROLL → ROLL_RESOLUTION → ACTION → END_TURN`, cùng `GAME_OVER`. Chi tiết resolution phải bám nguồn, không mặc định khung này là thứ tự luật đã đầy đủ.

- `activePlayerId`: người sở hữu lượt. `decisionOwnerIds`: người được trả lời pending decision hiện tại. Hai khái niệm này không luôn giống nhau.
- `pendingResolution` chứa nguồn hiệu ứng, bước đang xử lý, người cần chọn, lựa chọn hợp lệ, dữ liệu tiếp tục và ID duy nhất.
- Trong một resolution chưa xong, chỉ nhận command thuộc resolution đó hoặc thao tác đọc/pause hợp lệ. Không xen build/trade trái luật.
- Hàng đợi xử lý sự kiện theo thứ tự đã kiểm chứng. Các lựa chọn đồng thời theo luật có thể được thu thập riêng, nhưng commit theo policy rõ ràng.
- Khi nhiều người phải bỏ/chọn bài, UI chỉ rõ ai còn cần thao tác, không hiển thị lựa chọn bí mật của người đã xong.
- Khi reload, quay lại đúng pending decision; không chạy lại roll/draw/steal hoặc phát phần thưởng lần hai.
- Kết thúc lượt phải kiểm tra mọi obligation, proposal và giới hạn bài trước khi chuyển.
- Engine kiểm tra thắng sau các thay đổi điểm tại thời điểm hợp lệ; không chỉ kiểm tra khi người chơi bấm End Turn.

## 7. Trade và nhiều người chạm

Thương lượng bằng lời nói; UI ghi nhận đề nghị và thực thi sau xác nhận.

- MVP hỗ trợ đề nghị hai bên nhiều loại tài nguyên/hàng hóa. Người tham gia và thời điểm trao đổi theo luật Catan, không dùng giao dịch tự do mọi lúc.
- `proposalId`, `revision`, hai người, offered/requested bundle, xác nhận và trạng thái. Sửa đề nghị làm mất xác nhận cũ.
- Khi chấp nhận, engine kiểm tra lại lượt, phase, tài sản, số lượng, tính hợp lệ và revision; chuyển hai chiều nguyên tử.
- Không âm thầm bổ sung “tặng bài”, nợ, hẹn trả lượt sau hoặc chuyển công trình. Xác minh giới hạn trade từ nguồn.
- Đề nghị hết hiệu lực khi điều kiện thay đổi. Double tap không thực hiện hai lần; một tài sản không bị dùng vào nhiều giao dịch đã commit.
- Bank/port trade dùng cùng engine kiểm tra inventory và tỷ lệ hiệu lực; không để UI tự trừ/cộng.
- Cho người ngoài lượt phản hồi đề nghị hợp lệ mà không mở quyền xây/tung xúc xắc cho họ.

Pointer Events dùng pointerId và pointer capture theo interaction. Có tap-select/tap-target/confirm; drag không bắt buộc. Mỗi phiên tương tác có player context rõ từ khay ghế. Không đoán chủ thao tác qua tọa độ chạm board.

Mọi mutation qua một command queue tuần tự. Pointercancel/mất focus chỉ hủy preview, không tạo hành động. Ghế và touch không xác thực danh tính người chạm; UI tránh thao tác nhầm và giả định nhóm chơi thiện chí.

## 8. Kiến trúc engine

Khảo sát README/AGENTS, cấu trúc repo và game registry trước. Tái sử dụng launcher, seats, localization, persistence phù hợp nếu đã tồn tại. Không thay stack hoặc refactor Waterfall Park ngoài phạm vi chỉ để ép cùng mô hình luật.

Repo trống: đề xuất TypeScript + React + Vite, board SVG/HTML, IndexedDB, Vitest và Playwright. Đây là mặc định để khảo sát, không bắt buộc nếu repo có hướng khác. Xác minh API theo phiên bản dependency trước khi dùng.

```text
src/
  app/                         # launcher, sessions, game registry
  table/                       # seats, orientation, pointer, privacy
  games/catan-ck/
    engine/                    # commands, state, validation, transitions
    board/                     # hex/vertex/edge graph, topology
    rules/                     # versioned verified data and sources
    cards/                     # catalog and effect handlers
    projections/               # public/player/decision views
    ui/                        # board, trays, actions, trade, battle
  persistence/                 # saves, migrations, recovery
  shared/                      # UI, audio, i18n
tests/catan-ck/
docs/catan-ck/
```

Các API gợi ý:

```ts
createGame(config, randomSource): GameState
validateCommand(state, command): ValidationResult
applyCommand(state, command, randomSource): TransitionResult
getLegalActions(state, actorId): LegalAction[]
getPublicView(state): PublicGameView
getPrivateView(state, playerId, context): PrivateGameView
getPendingDecisionView(state, playerId): DecisionView
computeScore(state): ScoreBreakdown
```

- Board dùng graph hex/vertex/edge có ID ổn định; không suy adjacency từ pixel hay float.
- Model entity: player, seat, road, building, knight, wall, improvement tracks, metropolis claims, merchant, robber, bank, decks, barbarian track, turn, pending resolution, proposal và score ledger.
- Phân biệt “thuộc tính quân” với “quyền hành động lượt này”; lưu đủ turn markers cho knight/card effects.
- Longest Road phải xử lý vòng, nhánh, giao điểm chặn và hòa; không dùng số edge trong component làm độ dài.
- Score có breakdown và danh hiệu có chủ sở hữu; tránh cộng lặp khi danh hiệu chuyển qua lại.
- Dữ liệu thay đổi trong action transaction; intermediate state của một hiệu ứng không được tạo chiến thắng giả.
- Randomness được inject. Sinh seed riêng cho ván, lưu PRNG state và kết quả draw/roll/steal để replay. Không hiển thị seed/deck order qua public UI.
- Cùng initial state + log phải replay ra cùng kết quả, không phụ thuộc animation hoặc wall clock.
- `commandId` chống lặp; `expectedRevision` phát hiện state cũ. Rule engine mới có quyền cho phép action, UI không phải nơi duy nhất validate.
- Game registry có interface vừa đủ. Không xây framework mọi board game hoặc hệ plugin trước khi hoàn thành game này.

## 9. Lưu ván, offline và hỗ trợ quán

- Autosave mỗi command được chấp nhận, gồm pending choice/resolution. Transaction chứa state, log, revision và PRNG state nhất quán.
- Chỉ báo lưu thành công khi ghi bền vững thành công. Khi quota/storage lỗi, dừng mutation tiếp theo, giữ state để cứu hộ và báo rõ.
- Save chứa gameId, schemaVersion, rulesetId/version, board/config, người chơi/ghế, state, decks, randomness, pending decisions, proposals và log.
- Reload tự che thông tin riêng. Preview không được khôi phục thành action; trade pending phải tái kiểm tra và xác nhận lại.
- Một tab ghi state; tab thứ hai không được cùng điều khiển một ván.
- Export/import JSON có validate schema/invariants, không ghi đè ván hiện tại trước khi xác nhận. File cứu hộ chứa bài riêng, nên đặt trong thao tác nhân viên.
- Giữ save tốt gần nhất; migration rõ ràng. Save không tương thích phải báo lỗi có cách phục hồi, không tự reset.
- Chọn phương án offline cụ thể: local server và bundle tại máy hoặc PWA precache đầy đủ. Test khởi động lại khi mất Internet sau cài đặt.
- Không phụ thuộc font/icon/audio CDN trong ván; không cập nhật code/ruleset giữa ván đang chơi.
- Pause dùng được từ các cạnh, nhân viên có Resume, Export, Restart có xác nhận. Không cho pause làm mất pending resolution.
- Undo chỉ cho preview/chọn chưa commit. Không undo roll, draw, steal hay hành động đã tiết lộ bài trong chế độ chuẩn. Công cụ khôi phục của nhân viên phải đánh dấu can thiệp.
- Âm thanh có mute/volume; thao tác reset/thoát không đặt sát nút End Turn. Fullscreen trong app và kiosk của OS/browser được hướng dẫn riêng.

## 10. Kiểm thử và tiêu chí nghiệm thu

Ưu tiên tính đúng của luật và khả năng tiếp tục ván. Test theo rule IDs và kịch bản kết quả; không chỉ snapshot giao diện.

| Nhóm | Trường hợp bắt buộc |
|---|---|
| Topology/setup | Không trùng vertex/edge; mọi quan hệ đối xứng đúng; setup hợp lệ cho 3/4 người |
| Production/bank | Nhiều người nhận, thiếu một loại trong bank, Robber, city/commodity; không âm inventory |
| Event order | Sự kiện làm đổi board trước production; nhiều pending choices; không bỏ qua bước |
| Knights | Mới kích hoạt, thăng cấp, action/reaction, đường bị chặn, displacement không có chỗ hợp lệ |
| Barbarians | Phòng thủ đủ/thiếu, hòa đóng góp, người không có city dễ bị ảnh hưởng, chọn city, tường và metropolis |
| Improvements | Nâng cấp hợp lệ/không hợp lệ, mất city, cấp đặc quyền, giành/chuyển metropolis |
| Cards | Mỗi loại có happy path, invalid timing/target, edge case, save/resume; catalog khớp nguồn |
| Longest Road | Vòng, nhánh, bị chặn, hòa, chuyển chủ và không có chủ |
| Trade | State cũ, thiếu bài, sửa proposal, double tap, giao dịch đồng thời cùng inventory, ngoài lượt |
| Scoring | Chuyển danh hiệu, thẻ điểm, thay đổi ngoài lượt, ngưỡng thắng đúng thời điểm |
| Privacy | Không lộ bài qua log/DOM public/toast; che khi focus mất; bàn giao private session |
| Persistence | Reload giữa roll resolution, chọn bài, trade, battle; storage lỗi; import sai; nhiều tab |
| Touch/layout | Ghế xoay 0/90/180/270 độ; pointercancel; đa điểm; UI đúng owner khi chọn board |

Invariants cần kiểm tra tự động: inventory không âm; bảo toàn từng loại bài trong các vùng theo ruleset; mỗi card instance ở đúng một nơi; quân/vị trí không chồng trái luật; owner hợp lệ; revision tăng đơn điệu; command lặp không đổi kết quả; replay khớp snapshot.

E2E tối thiểu: tạo ván 3 người và 4 người; setup; giải quyết lượt; trade; knight; battle; card nhiều bước; metropolis; save/reload và kết thúc ván. Dùng fixture có nguồn để đưa đến tình huống khó, không sửa trực tiếp state trong production UI.

Pilot phải có ít nhất một ván thực tế trên bàn cảm ứng, từ setup đến game over; ghi thời gian học, thao tác nhầm, khó với tay, mức lộ bài và đoạn phải nhờ nhân viên. Kiểm thử chuột/emulation không thay thế được pilot phần cứng.

Mục tiêu UX ban đầu: phản hồi chạm dưới 100 ms, animation không gây chặn kéo dài. Đây là mục tiêu cần đo trên máy đích, không tuyên bố đạt bằng cảm nhận.

## 11. Milestone và đầu ra

### Milestone 0 — Khảo sát, kiểm chứng và kế hoạch

Chỉ hoàn thành giai đoạn này ở lượt đầu.

Tạo:

1. `docs/catan-ck/product-brief.md`: mục tiêu, scope, assumptions, tiêu chí thành công.
2. `docs/catan-ck/rules-spec.md`: edition, rule IDs, sources, VERIFIED/UNRESOLVED.
3. `docs/catan-ck/progress-cards-matrix.md`: catalog coverage và yêu cầu hiệu ứng.
4. `docs/catan-ck/digital-adaptations.md`: privacy, open-table, confirmations, timer, undo.
5. `docs/catan-ck/tabletop-ux.md`: wireframe 3/4 ghế, board/actions/trade/private/battle.
6. `docs/catan-ck/architecture.md`: engine, graph, state machine, resolution, persistence.
7. `docs/catan-ck/implementation-plan.md`: backlog, dependencies, milestones, acceptance và rủi ro.
8. `docs/catan-ck/test-plan.md`: rule-to-test mapping, fixtures, pilot.

Mỗi backlog item: ID, outcome, module, dependencies, acceptance criteria, cách kiểm chứng, mức ưu tiên và rủi ro. Estimate theo phạm vi, nêu độ bất định; không đưa cam kết ngày giao khi chưa khảo sát repo.

Nghiệm thu M0: phân biệt rõ đã xác minh/chưa xác minh, có phương án privacy cụ thể, thiết kế pending resolutions, card coverage đầy đủ theo nguồn đọc được, backlog thực thi được. Chỉ hỏi câu chặn quyết định khi thật sự thiếu dữ liệu; các lựa chọn reversible ghi assumption và tiếp tục.

### Milestone 1 — Board, engine nền và persistence

Topology, setup, base actions cần thiết, production, turn state, bank, trade, score nền; command validation; log/replay; save/resume. UI thô chơi được các luồng này. Tích hợp launcher nếu repo có.

Nghiệm thu: engine chạy độc lập UI, có test quy tắc đã triển khai, reload không đổi roll/draw. Đây là bản phát triển, chưa gắn nhãn C&K hoàn chỉnh.

### Milestone 2 — Cơ chế expansion và toàn bộ Progress Cards

Knights, Barbarians, city walls, commodities, improvements, metropolis, merchant, event dice, Progress Cards, tất cả lựa chọn bắt buộc và scoring kết hợp.

Có thể chia M2 thành nhiều PR nhỏ theo dependencies, nhưng không tuyên bố hoàn tất khi còn thẻ placeholder. Nghiệm thu: mọi rule/card trong phạm vi có implementation status và test; chạy được ván hoàn chỉnh qua UI chức năng.

### Milestone 3 — UX tabletop và hướng dẫn

Layout 3/4 người, xoay khay, private sessions, open-table preset, multitouch, touch targets, log công khai, trợ giúp ngữ cảnh, animation, âm thanh, tutorial thực hành.

Nghiệm thu: mọi hành động cốt lõi hoàn thành bằng cảm ứng; người ngoài lượt xử lý được decision/trade của mình; dữ liệu riêng không lộ qua thành phần công khai; không bắt buộc điện thoại.

### Milestone 4 — Pilot tại quán và bản giao

Offline boot, recovery, kiosk guide, storage failure, performance, full-game test và pilot bàn thật; sửa lỗi cản trở ván.

Bàn giao source, README chạy/build, tài liệu rule coverage, hướng dẫn nhân viên, báo cáo test/pilot và known limitations. Chưa có thiết bị thì ghi pilot chưa thực hiện, không đánh dấu đạt. Chưa hoàn thành rule coverage thì chưa gọi là bản bám luật đầy đủ.

## 12. Cách làm việc

- Bắt đầu bằng khảo sát repo, nêu ngắn gọn điểm tái sử dụng và phạm vi thêm mới.
- Làm theo milestone, ưu tiên ván chơi end-to-end trước trang trí.
- Không thay đổi luật để né phần code khó. Nếu triển khai tạm, tách dev flag và ghi rõ giới hạn.
- Không tạo dữ liệu luật giả trong preset chuẩn. Không báo test pass nếu chưa chạy.
- Nếu thiếu nguồn/thiết bị, hoàn thành mọi phần độc lập và nêu đúng chỗ bị chặn.
- Sau mỗi milestone: báo phần đã làm, cách chạy, bằng chứng kiểm chứng, giới hạn và phần kế tiếp.
- Trong lượt đầu, hoàn tất Milestone 0 rồi dừng để tôi xem kế hoạch; chưa tự triển khai các milestone sau.

# Kết thúc prompt

---

## Câu lệnh mở đầu gửi Claude Code

```text
Đọc toàn bộ Claude_Code_Prompt_Coffee_Boardgame_Catan_Cities_Knights.md.
Hãy thực hiện Milestone 0: khảo sát repository, kiểm chứng luật base + Cities & Knights theo một edition nhất quán, lập ma trận Progress Cards, thiết kế UX màn hình cảm ứng nằm ngang cho 3–4 người, kiến trúc và backlog triển khai.
Giữ phương án offline, một màn hình, không bắt buộc điện thoại. Nêu rõ hạn chế của bài riêng trên màn hình chung.
Tạo đầy đủ tài liệu theo prompt, chỉ ra các rule chưa xác minh. Chưa code toàn bộ game.
```

## Câu lệnh tiếp nối sau khi xem kế hoạch

```text
Triển khai Milestone 1 theo kế hoạch đã thống nhất. Hoàn thành engine nền, board, luồng chức năng và save/resume; chạy các kiểm thử liên quan, cập nhật coverage và hướng dẫn chạy. Không tự đổi luật hoặc mở rộng scope.
```

```text
Tiếp tục Milestone 2. Hoàn thành cơ chế Cities & Knights và toàn bộ Progress Cards trong edition đã pin, gồm pending decisions, restore giữa hiệu ứng và scoring. Đối chiếu rule/card coverage; không để placeholder được tính là hoàn thành.
```

```text
Tiếp tục Milestone 3. Hoàn thiện trải nghiệm tabletop 3–4 ghế, cảm ứng, riêng tư theo thỏa thuận tại bàn, chế độ chơi mở và hướng dẫn. Kiểm tra luồng từ mọi cạnh màn hình.
```

```text
Thực hiện Milestone 4. Kiểm tra offline, recovery, kiosk, performance và ván chơi hoàn chỉnh; chuẩn bị tài liệu pilot tại quán. Báo đúng những thử nghiệm đã thực hiện và những phần cần kiểm chứng trên bàn thật.
```
