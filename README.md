# Banana Ads Block

Extension chặn quảng cáo cho Chrome (Manifest V3), do **Lưu Khánh Vinh** thực hiện.

Chặn quảng cáo ở tầng mạng, tự đóng popup chèn ngang trên trang thường, và bỏ
qua quảng cáo trên YouTube — chặn được thì chặn, không chặn được thì tua nhanh.
Mọi thứ chạy trên máy, không có máy chủ ngoài, không thu thập lịch sử duyệt web.

## Cài đặt

Chưa lên Chrome Web Store, nạp thủ công:

```bash
git clone https://github.com/luukhanhvinh1214/banana-ads-block.git
```

1. Mở `chrome://extensions`
2. Bật **Chế độ dành cho nhà phát triển** (góc trên bên phải)
3. Bấm **Tải tiện ích đã giải nén** và chọn thư mục vừa clone
4. Tải lại các tab đang mở

Không cần `npm install`, không có bước build.

## Cách hoạt động

Bốn lớp độc lập, lớp sau đỡ cho lớp trước:

| Lớp | Tệp | Việc |
| --- | --- | --- |
| 1. Tầng mạng | `rules/ads.json` | Chặn yêu cầu tới máy chủ quảng cáo trước khi trình duyệt tải về |
| 2. Cắt dữ liệu | `src/ba_prune.js` | Xoá lịch chiếu quảng cáo khỏi phản hồi trình phát YouTube |
| 3. Dọn trang | `src/ba_cosmetic.js`, `src/ba_popup.js` | Ẩn khối quảng cáo còn sót, đóng lớp phủ, mở lại thanh cuộn |
| 4. Lưới an toàn | `src/ba_watchdog.js` | Bấm nút bỏ qua, không có nút thì tắt tiếng và tua tới cuối |

Lớp 2 là lớp quan trọng nhất với YouTube. Phản hồi `/youtubei/v1/player` mang
theo lịch chiếu quảng cáo trong các nhánh `adPlacements`, `playerAds`,
`adSlots`. Xoá chúng trước khi trình phát đọc tới thì không có lần chen quảng
cáo nào được xếp lịch — không có gì để mà bấm bỏ qua hay tua. Đây cũng là lý do
bộ dò chống chặn quảng cáo của YouTube khó phát hiện: nó tìm những ô quảng cáo
đã nạp nhưng không được phát, mà ô thì không tồn tại.

Lớp 4 chỉ vào cuộc khi lớp 2 không áp dụng được — trang không phải YouTube,
hoặc quảng cáo được ghép thẳng vào luồng video từ máy chủ.

## Sử dụng

Bấm vào icon trên thanh công cụ:

- **Công tắc tổng** — tắt toàn bộ tiện ích.
- **Bỏ qua trang này** — tha đúng một tên miền (và các tên miền con của nó), tha
  ở cả tầng mạng lẫn trên trang. Dùng khi một trang hiển thị sai.
- **Các lớp chặn** — bật tắt từng lớp một.
- **Chặn thêm mã theo dõi** — bộ lọc thứ hai, mặc định tắt. Mạnh tay hơn nhưng
  một số trang có thể đăng nhập lỗi hoặc không phát được video.

Huy hiệu trên icon là số lần chặn trong lần tải trang hiện tại.

## Giới hạn

Không có bộ chặn nào đúng 100%.

- YouTube đang thử ghép quảng cáo thẳng vào luồng video từ phía máy chủ. Khi đó
  không còn yêu cầu mạng nào để chặn và không còn nhánh dữ liệu nào để cắt;
  tiện ích chuyển sang tua nhanh, nên bạn vẫn thấy vài giây quảng cáo trôi qua.
- Danh sách lọc là bản rút gọn viết tay, không phải EasyList đầy đủ. Trang nào
  dùng mạng quảng cáo lạ thì cần bổ sung vào `rules/ads.txt`.
- Quảng cáo chèn ngang chỉ bị đóng khi có bằng chứng rõ ràng là quảng cáo. Đây
  là lựa chọn có chủ đích: cứ thấy lớp phủ là gỡ thì sẽ gỡ luôn hộp đăng nhập.

## Phát triển

```bash
node test/prune.test.js     # smoke test cho lớp cắt dữ liệu
node tools/gen_rules.js     # sinh lại rules/*.json sau khi sửa rules/*.txt
node tools/gen_icons.js     # sinh lại icons/icon*.png
```

`rules/ads.json` và `rules/trackers.json` là file sinh ra — sửa bản `.txt` rồi
chạy lại script, đừng sửa thẳng JSON.

Ghi chú kiến trúc và các ràng buộc không được phá nằm ở [CLAUDE.md](CLAUDE.md).

## Ghi công

Cách chặn và danh sách lọc tham khảo từ các dự án mã nguồn mở:
[uBlock Origin](https://github.com/gorhill/uBlock),
[EasyList](https://easylist.to) và
[AdPrune](https://github.com/achintha-ekanayake/AdPrune).
