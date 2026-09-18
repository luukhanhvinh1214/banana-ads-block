# Banana Ads Block

Extension chặn quảng cáo cho Chrome do **Vinhdeptrai** xây dựng.

Mọi thứ chạy trên máy bạn, an toàn, bảo mật, không thu thập lịch sử duyệt web.

## Chức năng

- Chặn quảng cáo ngay từ tầng mạng, trước khi trình duyệt tải về.
- Dọn banner và khung rỗng còn sót lại trên trang.
- Ẩn bài và khối mang nhãn tài trợ trên Facebook và TikTok, kể cả video quảng
  cáo chen vào giữa feed TikTok.
- Riêng Facebook, đọc luôn dữ liệu feed để biết bài nào là quảng cáo trước khi
  nó kịp hiện ra, nên bài tài trợ không còn loé lên một nhịp rồi mới biến mất.
- Chặn hẳn tài khoản đăng quảng cáo trên hai trang đó, nếu bạn bật.
- Đóng popup chèn ngang, kể cả popup khuyến mãi của chính trang, và mở lại thanh
  cuộn bị khoá.
- Ngăn trang tự mở tab quảng cáo khi bạn bấm vào chỗ bất kỳ.
- Giữ lại tab bạn đang xem khi trang định ném nội dung thật sang tab mới rồi
  biến tab cũ thành quảng cáo.
- Bỏ qua quảng cáo video trên YouTube — chặn được thì chặn, không chặn được thì
  tua nhanh.

## Cài đặt

Chưa lên Chrome Web Store, nạp thủ công:

```bash
git clone https://github.com/luukhanhvinh1214/banana-ads-block.git
```

1. Mở `chrome://extensions`
2. Bật **Chế độ dành cho nhà phát triển** (góc trên bên phải)
3. Bấm **Tải tiện ích đã giải nén** và chọn thư mục vừa clone
4. Tải lại các tab đang mở

## Bản ổn định

Nếu bạn gặp lỗi hoặc không thể sử dụng git thì hãy tải phiên bản ổn định ở đây:

[Google Drive](https://drive.google.com/drive/folders/1hk_-QRqmFatN4ZNTmJw1FyMURhguPKpJ?usp=sharing)

Tải về, giải nén, rồi làm bốn bước ở trên với thư mục vừa giải nén.

## Sử dụng

Bấm vào icon trên thanh công cụ:

- **Công tắc tổng** — tắt toàn bộ tiện ích.
- **Bỏ qua trang này** — tha đúng một tên miền và các tên miền con của nó. Dùng
  khi một trang hiển thị sai.
- **Chặn tài khoản quảng cáo** — chỉ hiện khi bạn đang ở Facebook hoặc TikTok,
  mặc định tắt. Bật lên thì thấy ai đăng quảng cáo là nhớ tên họ lại, rồi ẩn mọi
  bài sau của họ dù bài đó không gắn nhãn quảng cáo. Danh sách lưu trên máy, xoá
  lại được bất cứ lúc nào.

  Riêng Facebook còn chặn được thật phía máy chủ. Menu của bài quảng cáo không
  có nút chặn nào, nên chỗ duy nhất làm được là **Trung tâm tài khoản**, mục
  **Nhà quảng cáo**. Bạn mở trang đó một lần, tiện ích tự bấm ẩn giúp. Muốn bỏ
  thì bấm **Bỏ ẩn** ngay tại đó.
- **Các lớp chặn** — bật tắt từng lớp một. Trang nào mất ảnh thật hoặc bấm nút
  không ăn thì tắt bớt một lớp rồi tải lại trang.
- **Chặn thêm mã theo dõi** — mặc định tắt. Mạnh tay hơn nhưng một số trang có
  thể đăng nhập lỗi hoặc không phát được video.

Nếu máy bạn đang chạy một trình chặn quảng cáo khác, nhất là loại cài ở tầng hệ
thống chứ không phải extension, hãy tắt nó. Hai bộ lọc chồng lên nhau thì rất
khó biết trang hỏng vì bên nào.

## Giới hạn

Không có bộ chặn nào đúng 100%.

Gặp trang hiển thị sai hoặc còn sót quảng cáo thì mở một
[issue](https://github.com/luukhanhvinh1214/banana-ads-block/issues).

## Nguồn tham khảo

Cách chặn và danh sách lọc tham khảo từ các dự án mã nguồn mở:
[uBlock Origin](https://github.com/gorhill/uBlock),
[EasyList](https://easylist.to) và
[AdPrune](https://github.com/achintha-ekanayake/AdPrune).
