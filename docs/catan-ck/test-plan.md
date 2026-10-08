# Test Plan — rule-to-test mapping, fixtures, pilot

Nguyên tắc: test theo **rule ID và kịch bản kết quả**, không chỉ snapshot UI. Không báo pass nếu chưa chạy. Test của rule UNRESOLVED được viết với giá trị lấy từ `rules/` (không hard-code) và đánh dấu `describe.todo`/`skip` có lý do cho tới khi rule VERIFIED — riêng **test cấu trúc** (topology, replay, invariants, privacy) không phụ thuộc nguồn và chạy ngay từ M1.

## 1. Tầng test

| Tầng | Công cụ | Phạm vi |
|---|---|---|
| Unit engine | Vitest (Node) | Mỗi rule ID; mỗi handler thẻ |
| Property/fuzz | Vitest + generator tự viết từ PRNG | Topology, invariants, replay, command lặp |
| Projection/privacy | Vitest + React Testing Library | Không lộ dữ liệu riêng |
| E2E | Playwright (touch emulation, 1920×1080 + 3840×2160) | Luồng ván, 4 hướng ghế, offline, reload |
| Pilot | Thủ công trên bàn thật | Học, với tay, lộ bài, latency |

## 2. Rule → test mapping

| Rule IDs | Test IDs | Tầng | Kịch bản chính | Phụ thuộc nguồn |
|---|---|---|---|---|
| BRD-001 | T-BRD-001 | property | Không trùng vertex/edge; mọi quan hệ kề đối xứng; vertex ≤3 hex | Không |
| BRD-002..005 | T-BRD-002..005 | unit | Khoảng cách; road nối; knight chặn | Có |
| SET-001..017 | T-SET-* | unit | Setup 3 và 4 người; số lượng bank/stock; thứ tự rắn; tài nguyên khởi đầu | Có |
| TRN-001..006 | T-TRN-* | unit | Event die trước production; Alchemist chỉ PRE_ROLL; action xen kẽ build/trade | Có |
| PRD-001..009 | T-PRD-* | unit | Nhiều người nhận; thiếu một loại trong bank; robber chặn; 7 + tường; robber ngủ; aqueduct | Có |
| TRD-001..006 | T-TRD-* | unit | State cũ (STALE); thiếu bài; sửa proposal xóa chấp nhận; double tap; 2 proposal cùng inventory; ngoài lượt | Một phần |
| CON-001..006 | T-CON-* | unit | Chi phí; stock hết; tường tối đa; tường mất khi hạ cấp | Có |
| KNT-001..010 | T-KNT-* | unit | Mới kích hoạt không hành động; thăng 1 lần/lượt; đường bị chặn; displacement không có chỗ → loại | Có |
| BAR-001..012 | T-BAR-* | unit | Đủ/thiếu phòng thủ; hòa đóng góp; người không có city hợp lệ; chọn city; tường; metropolis miễn | Có |
| IMP-001..006 | T-IMP-* | unit | Nâng hợp lệ/không; mất city; đặc quyền cấp 3; ngưỡng rút | Có |
| MET-001..004 | T-MET-* | unit | Giành/chuyển ở cấp 5; không city trống | Có |
| MER-001..002 | T-MER-* | unit | Đặt/chuyển chủ; 2:1; VP | Có |
| PRG-001..008 + 25 thẻ | T-PRG-* , T-PRG-<DECK>-<CARD>-H/I/E/R | unit | Catalog khớp nguồn (18/18/18); happy path; invalid timing/target; edge; save/resume giữa hiệu ứng | Có |
| SCO-001..008 | T-SCO-* | unit | Longest Road vòng/nhánh/chặn/hòa/không chủ; chuyển danh hiệu không cộng lặp; VP rút ngoài lượt; ngưỡng thắng đúng thời điểm | Có |
| INF-001..003, DIG-001/002 | T-PRIV-* | projection + E2E | Marker tay bài không có trong DOM công khai/aria/log/toast; che khi blur/pointercancel; bàn giao session; Open Table | Một phần |
| (kiến trúc) | T-ENG-REPLAY, T-ENG-IDEMP, T-ENG-INV | property | replay == state; command lặp; invariants | Không |
| (persistence) | T-PER-* | unit + E2E | Reload giữa roll resolution, discard, trade, battle, card nhiều bước; quota lỗi; import sai; 2 tab | Không |
| (touch) | T-UX-* | E2E | Ghế 0/90/180/270; pointercancel; 2 ngón từ 2 khay; target đúng owner | Không |

## 3. Invariants tự động (chạy sau mỗi `applyCommand` trong test và dev build)

1. Mọi inventory ≥ 0.
2. Với mỗi loại tài nguyên/commodity: tổng tay + bank = tổng ruleset.
3. Mỗi card instance thuộc đúng một zone (deck/tay/đã lật/discard).
4. Không hai quân trên một vertex/edge trái luật; owner tồn tại.
5. `revision` tăng đúng 1 mỗi command chấp nhận.
6. Command lặp (`commandId`) không đổi state.
7. `replay(initialState, log)` deep-equal state hiện tại.
8. Không có pending resolution mồ côi (mỗi pending có decisionOwner hợp lệ hoặc là bước tự động).

## 4. Fixtures

- `tests/catan-ck/fixtures/*.json`: state hợp lệ đạt được **bằng chuỗi command** từ seed cố định (không sửa state trực tiếp), mỗi fixture có `ruleRefs` và nguồn.
- Fixture bắt buộc: `pre-battle-tie`, `battle-no-valid-city`, `metropolis-contest-lvl5`, `longest-road-cycle`, `longest-road-cut-tie`, `discard-three-players`, `spy-mid-resolution`, `wedding-two-targets`, `deserter-no-space`, `bank-shortage-commodity`, `win-on-vp-card-out-of-turn`.
- Builder `scenario()` trong test chơi command để tới tình huống; production UI không có chức năng sửa state.

## 5. E2E tối thiểu

1. Tạo ván 3 người (ghế B/T/R) và 4 người.
2. Setup đầy đủ.
3. Một lượt hoàn chỉnh với production và 7.
4. Trade domestic với người ngoài lượt + bank trade.
5. Knight: xây, kích hoạt, hành động lượt sau.
6. Trận barbarian (thua và thắng) qua fixture.
7. Một thẻ nhiều bước có người khác quyết định (Wedding/Saboteur).
8. Metropolis.
9. Save → reload giữa decision → tiếp tục.
10. Kết thúc ván (fixture gần thắng).
11. Offline boot sau cài PWA.

## 6. Pilot (M4) — mẫu báo cáo

| Mục | Ghi nhận |
|---|---|
| Thiết bị (kích thước, độ phân giải, số điểm chạm, máy) | |
| Nhóm chơi (số người, kinh nghiệm Catan) | |
| Thời gian: hướng dẫn → lượt đầu tự thao tác; tổng ván | |
| Thao tác nhầm (loại, số lần, ghế) | |
| Vị trí khó với tay (ghế, vùng board) | |
| Mức lộ bài quan sát được / người chơi phản hồi | |
| Lần cần nhân viên và lý do | |
| Latency đo được (công cụ, giá trị) | |
| Lỗi chặn ván | |
| Kết luận + việc cần sửa | |

Không có thiết bị → ghi "Pilot chưa thực hiện"; kiểm thử chuột/emulation không thay thế pilot.
