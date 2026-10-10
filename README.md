# KatanBoard

Coffee Boardgame Digital — CATAN + Cities & Knights cho màn hình cảm ứng nằm ngang tại quán cà phê (3–4 người, một máy, offline).

**Trạng thái: Milestone 1 (bản phát triển).** Engine nền, board, persistence và UI thô chơi được luồng base.
Mọi dữ liệu luật đang `UNRESOLVED` vì chưa đọc được rulebook 2025 chính thức (xem `docs/catan-ck/rules-spec.md` §1);
ván chạy bằng preset dev có nhãn "CHƯA KIỂM CHỨNG". Chưa phải bản Cities & Knights hoàn chỉnh.

## Chạy

Yêu cầu Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173 — mở toàn màn hình 1920×1080
npm run check        # typecheck + unit test (Vitest)
npm run test:e2e     # build + preview + Playwright (Chromium)
npm run build        # bản build tĩnh trong dist/
```

### Chế độ TV + điện thoại

Màn hình chính có công tắc **Chế độ chơi**: `Bàn cảm ứng` (một màn hình, offline) hoặc `TV + điện thoại`.

Chế độ TV + điện thoại cần máy chủ cục bộ (máy tính/mini-PC trong quán, cùng Wi-Fi với điện thoại):

```bash
npm run build
npm run server       # http://<IP-LAN>:8787 — PORT, DATA_DIR có thể đổi bằng biến môi trường
```

1. Mở `http://<IP-LAN>:8787` trên TV → chọn `TV + điện thoại` → Ván mới.
2. TV hiện mã QR cho từng ghế; mỗi người quét bằng điện thoại để vào ghế của mình.
3. Bài riêng, bỏ bài, trade, chọn vị trí xây… làm trên điện thoại; TV cập nhật tức thì.

Khi phát triển: chạy song song `npm run dev:server` (cổng 8787) và `npm run dev` (Vite proxy `/ws`).
Ván TV được lưu trên đĩa máy chủ (`data/catan-ck/`), máy chủ khởi động lại vẫn tiếp tục được; điện thoại mất kết nối sẽ tự kết nối lại.

### Mở trên iPad / máy khác trong mạng

`npm run dev` (hoặc `npm run build && npm run preview`) in ra địa chỉ `Network: http://<IP>:5173`. Mở địa chỉ đó trên iPad (iPadOS 15.4+), nên xoay ngang và dùng toàn màn hình.
Khi mở qua `http://<IP>` trình duyệt coi là *không bảo mật*: app tự dùng phương án thay thế cho `crypto.randomUUID` và Web Locks (khóa một tab bằng BroadcastChannel).

## Đã có ở M1

- Board graph hex/vertex/edge ID ổn định; board ngẫu nhiên (6/8 không kề nhau); cảng (vị trí xấp xỉ, chờ đối chiếu nguồn).
- Engine thuần, deterministic (PRNG sfc32 có seed lưu trong state): setup thứ tự rắn (settlement → city), tung 3 xúc xắc (đỏ, vàng, event — hiệu ứng event ở M2), production gồm commodity của city, ngân hàng thiếu hàng, tung 7 + bỏ bài đồng thời, robber (ngủ tới trận barbarian đầu — luật ứng viên), xây road/settlement/city, đổi ngân hàng/cảng, trade giữa người chơi có revision, Longest Road, điểm, kiểm tra thắng.
- `commandId` chống lặp, `expectedRevision`, invariants sau mỗi lệnh, replay từ log.
- Projection công khai/riêng tư; Open Table.
- IndexedDB (giữ bản trước), khóa một tab, xuất/nhập file cứu hộ có kiểm chứng replay; lỗi lưu → khóa thao tác.
- UI thô: launcher, tạo ván (3/4 người, chọn ghế B/T/L/R độc lập thứ tự lượt), board SVG, 4 khay xoay theo ghế, giữ-để-xem-bài, panel bỏ bài/trade riêng, pause + khu vực nhân viên.

## Chưa có (theo kế hoạch)

Knights, Barbarians, city wall, improvements, metropolis, merchant, Progress Cards (M2); UX tabletop hoàn chỉnh, minimap, trợ giúp, animation (M3); PWA offline, kiosk, pilot (M4).

## Tài liệu (`docs/catan-ck/`)

| File | Nội dung |
|---|---|
| `product-brief.md` | Khảo sát repo, mục tiêu, scope, giả định, tiêu chí thành công |
| `rules-spec.md` | Nguồn/edition, rule IDs, trạng thái kiểm chứng, câu hỏi mở |
| `progress-cards-matrix.md` | Catalog Progress Cards ứng viên + yêu cầu handler |
| `digital-adaptations.md` | Privacy, Open Table, xác nhận, timer, undo |
| `tabletop-ux.md` | Wireframe 3/4 ghế, khay, trade, battle, private session |
| `architecture.md` | Stack, board graph, state machine, pending resolution, persistence |
| `implementation-plan.md` | Backlog M1–M4, dependencies, rủi ro, trạng thái |
| `test-plan.md` | Rule→test mapping, invariants, fixtures, pilot |

Prompt gốc: `Claude_Code_Prompt_Coffee_Boardgame_Catan_Cities_Knights.md`.
