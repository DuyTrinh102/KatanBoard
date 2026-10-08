# Digital Adaptations — điều chỉnh số hóa (không phải luật)

Mọi mục ở đây có ID `DIG-xxx`, là **quyết định sản phẩm** để chơi trên một màn hình chung. Không mục nào được thay đổi kết quả luật trong preset chuẩn, trừ Open Table (công khai thông tin — có ghi rõ).

## DIG-001 Bài riêng trên màn hình chung — giới hạn trung thực

**Sự thật:** một màn hình dùng chung **không thể** giữ bí mật. CSS, xoay khay, blur hay PIN đều không ngăn người ngồi cạnh nhìn thấy. Chế độ xem riêng là **thỏa thuận lịch sự tại bàn**, không phải chống gian lận, và mọi tài liệu/UI không được mô tả nó là bảo mật.

Phương án MVP:

1. Mỗi khay người chơi có mặt úp: chỉ hiện **số lượng** (tài nguyên+commodity, Progress Card) — đây là thông tin công khai theo luật (INF-001, cần xác minh).
2. **Chỉ một private session** được mở tại một thời điểm trên toàn màn hình. Người khác bấm "Giữ để xem" khi đang có session → báo "Đợi [Tên] xem xong".
3. **Nhấn giữ để xem** (press-and-hold ≥ 300 ms trên nút của khay). Che ngay khi: `pointerup`, `pointercancel`, `lostpointercapture`, `blur`/`visibilitychange`, pause, có pending decision của người khác cần màn hình, hoặc timeout 20 s không chạm.
4. Hướng dẫn ngắn đầu ván: "Khi một người xem bài, những người khác quay đi. Người xem dùng tay che khu vực khay."
5. **Lựa chọn nhiều bước** (bỏ bài khi 7, Saboteur, Wedding, chọn lá trade, Spy/Master Merchant): mở *private decision panel* trong khay của người đó; board giữa có thể làm mờ (chỉ trang trí); panel dùng chế độ "chạm để chọn + nút Xác nhận" mà không cần giữ liên tục, nhưng vẫn tự che khi rời tay > 8 s hoặc khi hoàn tất. Bàn giao sang người tiếp theo luôn đi qua màn hình "Đến lượt [Tên] — chạm để mở" để người trước đã đóng.
6. **ViewModel là cửa duy nhất**: component công khai chỉ nhận `PublicGameView`; component riêng nhận `PrivateGameView` chỉ khi session đang mở. Dữ liệu riêng không tồn tại trong DOM khi bị che (không blur chữ có sẵn). Không xuất hiện trong toast, public log, tooltip, `aria-label`, animation (ví dụ animation cướp bài chỉ bay lá úp), thông báo lỗi ("Không đủ tài nguyên" — không nói thiếu loại nào trong public).
7. Debug panel và export đầy đủ chỉ trong vùng quản trị.

### Bảng public/private

| Dữ liệu | Công khai | Riêng (người sở hữu) | Ghi chú |
|---|---|---|---|
| Số lá tài nguyên+commodity trong tay | ✔ | | INF-001 |
| Loại từng lá tài nguyên/commodity | | ✔ | |
| Số Progress Card trong tay | ✔ | | |
| Bộ/màu của Progress Card trong tay | ? | ✔ | INF-003 UNRESOLVED; mặc định riêng tới khi xác minh |
| Nội dung Progress Card trong tay | | ✔ | |
| Thẻ VP đã lật | ✔ | | |
| Lá bị robber/Bishop lấy ngẫu nhiên | Chỉ "1 lá" | Người lấy + người mất thấy loại | Log công khai: "A lấy 1 lá của B" |
| Lá bỏ khi 7 / Saboteur | Chỉ số lượng | Người bỏ | |
| Lá đưa trong Wedding / Commercial Harbor / Monopoly | Monopoly: loại + số lượng công khai (do người chơi tuyên bố loại); Wedding/Harbor: chỉ số lượng | Hai bên | |
| Tay bị xem bởi Spy / Master Merchant | "A đã xem bài của B" | A (trong session), B (biết bị xem) | |
| Đề nghị trade đang soạn (chưa gửi) | | Người soạn | |
| Đề nghị trade đã gửi | ✔ | | Trade là thương lượng công khai |
| Bộ thẻ còn lại (số lượng) | ✔ | | |
| Thứ tự bộ thẻ, seed PRNG | | | Chỉ admin/export cứu hộ |
| Lựa chọn của người đã xong trong decision đồng thời | Chỉ "đã xong" | Người đó | |

## DIG-002 Preset `Open Table — Chơi mở`

- Mọi thông tin ở cột "Riêng" trở thành công khai (tay bài lật trên khay, log ghi rõ loại lá).
- Ghi rõ ở màn hình tạo ván: "Điều chỉnh trải nghiệm để học — thay đổi chiến thuật, không phải luật chuẩn."
- Người tạo ván phải bật chủ động (mặc định tắt); khóa trong suốt ván; lưu trong save (`config.openTable`). Kết quả ván ghi nhãn "Chơi mở".
- Thứ tự bộ thẻ và seed vẫn ẩn (không phải thông tin trong tay ai).

## DIG-003 Xác nhận hành động

- Hành động có chi phí/không đảo ngược (xây, nâng cấp, chơi thẻ, kết thúc lượt, trade) dùng mô hình **chọn → preview → Xác nhận**. Preview hiển thị chi phí và hệ quả (ví dụ: "Longest Road chuyển sang bạn").
- Hành động rẻ và tức thời trong preview (chọn vị trí) không cần xác nhận riêng.
- End Turn: nút tách xa Pause/Thoát; nếu còn việc có thể làm thì *không* cảnh báo (tránh làm phiền), chỉ chặn khi còn obligation bắt buộc (với lý do cụ thể).

## DIG-004 Timer

- Chỉ nhắc: vòng tiến trình mờ quanh avatar người đang thao tác sau N phút (cấu hình, mặc định 2 phút); không tự kết thúc lượt, không tự chọn thay.
- Có thể tắt trong cấu hình ván.

## DIG-005 Undo

- Được: bỏ preview, bỏ chọn chưa commit, rút lại đề nghị trade chưa được chấp nhận.
- Không được (chế độ chuẩn): roll, draw, steal, hành động đã tiết lộ thông tin, hành động đã commit.
- Công cụ nhân viên "Khôi phục về revision N" (admin, có xác nhận 2 bước) ghi dấu `staffIntervention` vĩnh viễn trong log và màn hình kết quả.

## DIG-006 Lựa chọn đồng thời

Khi luật cho phép nhiều người chọn cùng lúc (bỏ bài khi 7, Saboteur — cần xác minh luật có "đồng thời" không): engine thu thập từng lựa chọn riêng (`collected[playerId]`, private), UI chỉ hiển thị ai đã xong, **commit một lần** khi đủ tất cả. Vì một màn hình chỉ cho một private session, người chơi thực tế làm lần lượt; thứ tự gợi ý theo chiều lượt chơi bắt đầu từ người kế tiếp active player.

## DIG-007 Random

PRNG có seed riêng mỗi ván (seed từ `crypto.getRandomValues` lúc tạo ván), lưu PRNG state; mọi roll/draw/steal ghi kết quả vào log để replay. Không hiển thị seed/thứ tự bộ thẻ ngoài vùng admin. Animation xúc xắc chỉ minh họa kết quả đã quyết định.

## DIG-008 Xúc xắc vật lý (tùy chọn, roadmap)

Không trong MVP. Nếu thêm: nhập tay kết quả xúc xắc thật, đánh dấu ván "xúc xắc vật lý", replay dùng giá trị nhập.

## DIG-009 Pause / nhân viên

Pause từ mọi cạnh (nút nhỏ ở góc mỗi khay). Pause che toàn bộ thông tin riêng, giữ nguyên pending resolution. Resume/Export/Restart nằm trong menu nhân viên.
