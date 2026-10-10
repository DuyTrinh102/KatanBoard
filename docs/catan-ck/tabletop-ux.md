# Tabletop UX — màn hình cảm ứng nằm ngang, 3–4 người

Tham chiếu 1920×1080 (kiểm thêm 3840×2160 bằng scale 2×). Mọi kích thước dưới đây là px ở 1080p; trong code dùng token theo `physicalWidthMm` (A-03) để giữ touch target ≥ 12 mm.

## 1. Nguyên tắc

1. Board ở giữa, **không bao giờ xoay toàn cục** khi đổi lượt.
2. Mỗi ghế có một **khay** sát cạnh màn hình, xoay theo người ngồi (0° dưới, 180° trên, 90° trái, 270° phải). Tên, chữ, nút trong khay xoay theo ghế.
3. **Ghế ≠ thứ tự lượt ≠ playerId.** `seatId` (B/T/L/R) chỉ quyết định vị trí và hướng; thứ tự lượt lưu riêng.
4. Mọi thao tác bắt đầu từ khay của người thao tác → interaction có player context rõ ràng. Chạm lên board chỉ là **chọn target** cho interaction đang mở, không bao giờ suy ra "ai đang chạm" từ tọa độ.
5. Người chơi phân biệt bằng **màu + biểu tượng (khiên, lá, sao, sóng) + tên**; không chỉ màu.
6. Không bắt buộc hover, bàn phím hay kéo thả. Mọi việc: chạm chọn → chạm target → Xác nhận.
7. Thông tin chung giữa bàn dùng biểu tượng + số lớn, đọc được từ mọi hướng; chạm vào sẽ mở **popover xoay theo ghế của người chạm** (ghế xác định bằng nút "đọc" trong khay đã chạm gần nhất, hoặc popover mở ra 4 bản nhỏ hướng về các ghế đang có người nếu không xác định được).

## 2. Layout 4 người

```text
 0                   300                                        1620                1920
 ┌──────────────────┬───────────────────────────────────────────┬───────────────────┐ 0
 │ ⏸ (góc T-L)      │        KHAY T (xoay 180°) — người C        │       ⏸ log      │
 │                  │  [tay úp 7 | thẻ 2] [Knights] [Hành động] │                   │ 170
 ├──────┬───────────┴───────────────────────────────────────────┴─────────┬────────┤
 │      │ ┌─────────────┐    ┌─────────────────────────────┐ ┌────────────┐│        │
 │ KHAY │ │ BARBARIAN   │    │                             │ │IMPROVEMENTS││ KHAY   │
 │  L   │ │ track dọc   │    │       BOARD (hex SVG)       │ │ T  P  S    ││  R     │
 │(90°) │ │ ⛵ 4/7       │    │   ~760×700, r≈62px          │ │ ■■□ ■□□ ■■■││(270°)  │
 │người │ │ Sức mạnh 6* │    │                             │ │ Metropolis ││người D │
 │  B   │ │ Phòng thủ 4 │    │                             │ │ Merchant   ││        │
 │      │ │ A2 B1 C0 D1 │    │                             │ │ Bộ thẻ 3×n ││        │
 │      │ │ *dự kiến    │    │                             │ │ Bank       ││        │
 │      │ └─────────────┘    └─────────────────────────────┘ └────────────┘│        │
 ├──────┴───────────┬───────────────────────────────────────────┬─────────┴────────┤ 910
 │ ⏸                │        KHAY B (0°) — người A               │      ⏸ ⚙(staff) │
 │                  │  [tay úp] [Xây][Trade][Knight][Nâng][Thẻ]  [KẾT THÚC LƯỢT] │
 └──────────────────┴───────────────────────────────────────────┴───────────────────┘ 1080
```

- Khay T/B: 1320×170. Khay L/R: 260×740. Khay L/R hẹp nên dock hành động xếp 2 cột, biểu tượng + nhãn ngắn.
- Dải public bên trái board: Barbarian track (dọc), bên phải: improvements + metropolis + merchant + bank + bộ thẻ. Trong layout 4 người các dải này đọc được từ 2 phía; số lớn ≥ 32 px.
- Pause ⏸ ở cả 4 góc, cách xa End Turn ≥ 200 px. Nút staff ⚙ cần giữ 2 s + PIN.

## 3. Layout 3 người

Người tạo ván chọn 3 trong 4 cạnh (mặc định B, T, R — cạnh dài cho 2 người đối diện). Cạnh trống chứa **bảng công khai mở rộng**:

```text
 ┌───────────────┬──────────────────────────────────────────┬──────────────────┐
 │               │        KHAY T (180°) — người B            │                  │
 ├───────────────┴──────────────────────────────────────────┴────────┬─────────┤
 │ BẢNG CÔNG KHAI (cạnh trống)  │                            │       │  KHAY R │
 │ Barbarian track ngang lớn    │        BOARD               │ bank  │ (270°)  │
 │ Improvements 3 nhánh × 3 ng. │                            │ decks │ người C │
 │ Score breakdown công khai    │                            │       │         │
 │ Log công khai (xoay 0°/180°) │                            │       │         │
 ├───────────────┬──────────────────────────────────────────┬────────┴─────────┤
 │               │        KHAY B (0°) — người A              │                  │
 └───────────────┴──────────────────────────────────────────┴──────────────────┘
```

Board dịch lệch về phía cạnh trống khoảng 80 px để cân khoảng với tay của người L/R. Chọn ghế khác (ví dụ B, L, R) dùng cùng template, cạnh trống luôn chứa bảng công khai.

## 4. Khay người chơi

```text
┌───────────────────────────────────────────────────────────────────────┐
│ 🛡 An (Đỏ)  9 VP*  ▸Lượt của bạn      [Giữ để xem bài 🂠 7 | 📜 2]  ⏸ │
│ Knights: ♞1● ♞2○ ♞2●  (● active)   Tường 1/3   Giới hạn bài 9          │
│ ┌──────┬──────┬────────┬────────┬──────────┬──────┐  ┌───────────────┐ │
│ │ Xây  │Trade │ Knight │Nâng cấp│Thẻ tiến bộ│ Luật │  │ KẾT THÚC LƯỢT │ │
│ └──────┴──────┴────────┴────────┴──────────┴──────┘  └───────────────┘ │
│ [Lý do khóa: "Chưa tung xúc xắc" / "Thiếu 1 ore" (chỉ thấy khi xem riêng)] │
└───────────────────────────────────────────────────────────────────────┘
```

- `*` VP hiển thị là VP công khai (không gồm thứ người khác không biết — hiện mọi VP đều công khai nếu thẻ VP lật ngay; xác minh PRG-006).
- Lý do khóa nút: công khai khi lý do không lộ bài ("Chưa tung xúc xắc", "Không phải lượt bạn", "Đang chờ D bỏ bài"); lý do liên quan tay bài ("Thiếu 1 ore") chỉ hiện trong private session.
- Nút dùng cùng `getLegalActions(state, playerId)` với engine.
- Khay người không trong lượt chỉ hiện các nút hợp lệ cho họ: trả lời trade, decision của họ, xem bài, tra luật.

## 5. Chọn vị trí trên board

1. Người chơi chạm "Xây → Settlement" trong khay → interaction `{interactionId, playerId, kind}` mở.
2. Board tô các vertex hợp lệ bằng vòng màu + biểu tượng người chơi (touch target ≥ 56 px dù hình vẽ nhỏ hơn).
3. Chạm vertex (bất kỳ ngón tay nào) → preview quân mờ + thẻ chi phí trong khay → **Xác nhận** trong khay.
4. Thay thế không phải với tay: nút "Bản đồ nhỏ" mở minimap 320×300 xoay theo ghế ngay trong khay; cùng ID vertex/edge/hex với board lớn.
5. Nếu hai interaction cùng chờ target trên board (hiếm — chỉ khi decision đồng thời), target được highlight bằng viền màu của *từng* người, và chạm vào vùng chồng lặp mở bộ chọn "Cho ai?" nhỏ — ưu tiên dùng minimap trong trường hợp này.

## 6. Luồng màn hình

```text
Launcher → Tạo ván (số người, chọn ghế, màu+biểu tượng, Open Table?, timer) → Hướng dẫn ngắn (privacy + điều khiển)
 → Setup bàn (board beginner / ngẫu nhiên) → Đặt quân khởi đầu (theo thứ tự rắn) → Chơi theo lượt → Kết quả
```

| Luồng trong ván | Ai thao tác | Chặn? | Hình thức |
|---|---|---|---|
| Tung xúc xắc | active | — | Nút trong khay; 3 xúc xắc lăn giữa board ≤ 800 ms, có "bỏ qua animation" |
| Giải quyết event | máy | ngắn | Banner ngang giữa bàn, 4 bản xoay về các ghế; tàu tiến 1 ô / cổng màu |
| Rút Progress Card | người đủ điều kiện | không | Lá úp bay tới khay; VP lật công khai |
| Nhận tài nguyên | máy | không | Lá bay từ hex tới khay; loại + số lượng công khai vì suy ra được từ board và xúc xắc (sửa ở M1 — trước đây ghi nhầm là bí mật) |
| Lựa chọn bắt buộc (bỏ bài, chọn city…) | decisionOwners | **có** | Dải trạng thái "Đang chờ: B, D" ở mọi khay; private panel ở khay người cần chọn |
| Xây | active | — | §5 |
| Trade | active + đối tác | — | §7 |
| Knight (xây/kích hoạt/thăng/di chuyển/đẩy/đuổi robber) | active (+ chủ knight bị đẩy) | khi bị đẩy | Chọn knight → menu hành động hợp lệ → target → xác nhận |
| Improvement | active | — | Bảng 3 nhánh trong khay, cấp tiếp theo + chi phí + đặc quyền mở khóa |
| Progress Card | active (+ mục tiêu) | khi có mục tiêu chọn | Private session để chọn thẻ; sau xác nhận thẻ lật công khai giữa bàn |
| Trận Barbarians | máy → người mất city | **có** | §8 |
| Metropolis | người đạt cấp | có (chọn city) | Chọn city trên board/minimap |
| Longest Road / điểm | máy | không | Huy hiệu bay sang khay chủ mới; score breakdown trong popover |
| Kết thúc lượt | active | — | Kiểm tra obligation; bàn giao: "Lượt của [Tên]" ở khay người mới |
| Pause/resume | ai cũng pause; staff resume nếu bị khóa | có | Lớp phủ che toàn bộ, không hiển thị bài |

Không dùng modal toàn màn hình cho thông báo; chỉ chặn khi luật cần lựa chọn hoặc khi cần xem riêng.

## 7. Trade

```text
Khay A (active):  ĐƯA  [🧱-][1][+] [🌾-][0][+] ...  NHẬN [⛏-][1][+] ...   Gửi cho: (B)(C)(D)(Mọi người)
Khay B:           ┌ Đề nghị #12 r2 từ An: An đưa 🧱1  ↔  An nhận ⛏1 ┐
                  │ [Chấp nhận]  [Sửa (đề nghị ngược)]  [Từ chối]   │
                  └──────────────────────────────────────────────────┘
Khay A sau khi B chấp nhận:  "B đồng ý #12 r2"  [XÁC NHẬN GIAO DỊCH]
Bank/cảng:        Nút "Đổi với ngân hàng" — tỷ lệ hiệu lực hiển thị theo từng loại (4:1 / 3:1 / 2:1 / Merchant / Merchant Fleet)
```

- Soạn đề nghị cần xem tay → diễn ra trong private session của A; đề nghị **đã gửi** là công khai (đúng tinh thần thương lượng).
- Mỗi sửa đổi tăng `revision` và xóa mọi chấp nhận cũ. Chấp nhận/Xác nhận mang `proposalId + revision`; double tap bị idempotent.
- Người ngoài lượt chỉ thấy nút trả lời trade, không có Xây/Tung.

## 8. Trận Barbarians

1. Tàu tới bờ: banner "BARBARIANS TẤN CÔNG" giữa bàn.
2. Bảng so sánh (4 bản xoay): `Sức mạnh 7 (7 city/metropolis) — Phòng thủ 6 (A 2 · B 3 · C 0 · D 1)`.
3. Kết quả:
   - Thua: "C có phòng thủ thấp nhất trong số người có city hợp lệ" → khay C nhận decision "Chọn city bị hạ cấp" (highlight city hợp lệ; metropolis không được chọn). Nhiều người → dải "Đang chờ: C, D".
   - Thắng: "B là Defender of Catan +1 VP" hoặc hòa → từng người hòa chọn bộ thẻ (decision).
4. Sau trận: knight chuyển inactive (animation hạ cờ), tàu về đầu track; nếu là trận đầu — thông báo robber bắt đầu hoạt động (PRD-007, chờ xác minh).
5. Dải barbarian thường trực luôn ghi "dự kiến" vì sức mạnh/phòng thủ đổi theo state.

## 9. Private session (chi tiết ở `digital-adaptations.md` DIG-001)

```text
Khay úp:   [ 🂠 Giữ để xem bài (7 lá · 2 thẻ) ]
Đang giữ:  ┌ chỉ hiện khi ngón tay còn giữ ─────────────────────────┐
           │ 🌲2 🧱1 🐑0 🌾3 ⛰1 | 📜1 🧵0 🪙0 | Thẻ: [Alchemist][Spy] │
           └──────────────────────────────────────────────────────────┘
Người khác đang xem:  khay khác hiển thị "Đang có người xem bài — vui lòng quay đi"
```

## 10. Trợ giúp, âm thanh, khả năng tiếp cận

- Nút "Luật" trong khay mở thẻ tra cứu ngữ cảnh (chi phí, đặc quyền cấp, ý nghĩa event die), thuật ngữ tiếng Anh trong ngoặc.
- Âm thanh: mute/volume trong menu pause; không dùng âm thanh để truyền thông tin riêng.
- Animation có chế độ rút gọn; không animation nào quyết định kết quả.
- Tương phản ≥ 4.5:1 cho chữ; biểu tượng người chơi khác hình dạng cho người mù màu.

## 11. Cần kiểm trên phần cứng (không tuyên bố đạt bằng emulation)

Khả năng với tay tới vertex xa nhất từ mỗi ghế; đọc chữ từ cạnh ngắn; độ chính xác chạm ở mép màn hình; số điểm chạm đồng thời; latency; ánh sáng quán phản chiếu.
