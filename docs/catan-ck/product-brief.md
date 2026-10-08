# Product Brief — CATAN: Cities & Knights trên bàn cảm ứng (Coffee Boardgame Digital)

## 1. Khảo sát repository (2026-10-08)

| Hạng mục | Hiện trạng |
|---|---|
| Nội dung | `README.md` (1 dòng tiêu đề), file prompt; 2 commit |
| Stack, build, test | Không có |
| Launcher / game registry / seats / i18n / persistence | Không có |
| Waterfall Park | **Không có trong repo** → không giả định đã tồn tại, không có gì để tái sử dụng |
| AGENTS.md / CLAUDE.md | Không có |

**Kết luận:** repo trống. Dùng stack mặc định đề xuất trong prompt: TypeScript + React + Vite, board SVG, IndexedDB, Vitest, Playwright (lý do và phiên bản ở `architecture.md`). Launcher + game registry tối thiểu sẽ được tạo mới, đủ để Waterfall Park cắm vào sau mà không phải refactor.

## 2. Mục tiêu

Một màn hình cảm ứng nằm ngang đặt giữa bàn quán cà phê; 3–4 người ngồi quanh bốn cạnh chơi CATAN + Cities & Knights. Người chơi nói chuyện, thương lượng trực tiếp; máy giữ luật, tài nguyên, giao dịch, sự kiện và điểm. Giữ cảm giác board game: chạm trực tiếp lên bàn, khay riêng sát ghế, không biến mọi việc thành form.

Hai quyết định chiến thuật phải luôn rõ trên màn hình:
1. **Phát triển kinh tế của mình** (công trình, commodity, improvement).
2. **Đóng góp phòng thủ chung** (knight active so với sức mạnh barbarian dự kiến).

## 3. Phạm vi

| Trong MVP | Ngoài MVP (roadmap) |
|---|---|
| Base + C&K, 3–4 người thật tại cùng bàn | 2 người (biến thể riêng), 5–6 người (extension riêng) |
| Một máy, offline trong ván | Online, tài khoản, matchmaking |
| Cảm ứng chính; chuột cho dev | Companion điện thoại / QR (chỉ thiết kế projection sẵn) |
| Tiếng Việt, thuật ngữ tiếng Anh trong trợ giúp | Ngôn ngữ khác |
| 2D tự vẽ | 3D, asset chính thức |
| Private session theo thỏa thuận tại bàn + preset Open Table | Bảo mật/chống gian lận thật sự |
| Timer nhắc (không tự kết thúc lượt) | AI bot, thanh toán, các expansion khác |

Không mang luật trao đổi tài sản của Waterfall Park sang Catan.

## 4. Giả định (reversible — ghi lại và tiếp tục)

| A-ID | Giả định | Nếu sai thì |
|---|---|---|
| A-01 | Edition baseline = 2025 (CN3081 + CN3087) | Đổi `rulesetId`, cập nhật rules-data; engine không đổi |
| A-02 | Màn hình mục tiêu 1920×1080 cảm ứng điện dung đa điểm (≥4 điểm), chạy Chromium/Edge kiosk | Layout dùng đơn vị tương đối; kiểm thêm 4K |
| A-03 | Kích thước bàn thật chưa biết → touch target tối thiểu 12 mm vật lý; cấu hình `physicalWidthMm` trong admin để quy đổi px | Điều chỉnh token kích thước |
| A-04 | Thiết bị là PC/mini-PC ở quán, có Chromium; offline bằng PWA precache (phương án dự phòng: static server cục bộ) | Chuyển sang Electron/Tauri nếu kiosk yêu cầu |
| A-05 | Một ván tại một thời điểm trên một máy | Thêm danh sách ván đang lưu |
| A-06 | Asset hình ảnh/âm thanh tự tạo (SVG thủ công) | — |
| A-07 | Nhân viên quán có quyền vào vùng quản trị bằng PIN (không phải bảo mật mạnh) | — |

## 5. Rủi ro chính

1. **Nguồn luật 2025 chưa đọc được** (host bị chặn trong môi trường) → toàn bộ dữ liệu luật UNRESOLVED. Đây là blocker cho việc gắn nhãn "bám luật", không chặn việc dựng engine/topology/UI.
2. Bí mật trên màn hình chung là thỏa thuận xã hội, không phải bảo mật.
3. Kích thước/độ phân giải bàn thật chưa biết → khả năng với tay và đọc chữ phải kiểm tra trên phần cứng.
4. Progress Cards nhiều hiệu ứng nhiều bước, nhiều người quyết định → độ phức tạp state machine cao.

## 6. Tiêu chí thành công

| Mức | Tiêu chí |
|---|---|
| M1 | Engine chạy độc lập UI; topology đúng; setup 3/4 người; production/trade/build base; save/reload không đổi kết quả random |
| M2 | Mọi rule/thẻ trong phạm vi có implementation status + test; ván đầy đủ qua UI chức năng; 0 thẻ placeholder |
| M3 | Mọi hành động cốt lõi bằng cảm ứng từ mọi cạnh; người ngoài lượt tự xử lý decision/trade; không lộ dữ liệu riêng qua component công khai (có test tự động) |
| M4 | Ít nhất 1 ván thật trên bàn cảm ứng từ setup đến game over; khởi động offline; khôi phục sau mất điện/reload; báo cáo pilot trung thực |
| Bám luật | Chỉ tuyên bố khi 100% rule trong `rules-spec.md` và 100% dòng `progress-cards-matrix.md` là VERIFIED + TESTED |

Chỉ số pilot (đo, không ước lượng): thời gian học đến lượt đầu tiên tự làm; số thao tác nhầm/ván; số lần cần nhân viên; số lần lộ bài được ghi nhận; latency phản hồi chạm (mục tiêu < 100 ms trên máy đích); thời lượng ván.
