# Banana Ads Block

Extension chặn quảng cáo cho Chrome do **Lưu Khánh Vinh** xây dựng.

Mọi thứ chạy trên máy bạn. Không có máy chủ, không thu thập lịch sử duyệt web.

## Chức năng

- Chặn quảng cáo ngay từ tầng mạng, trước khi trình duyệt tải về.
- Dọn banner và khung rỗng còn sót lại trên trang.
- Ẩn bài và khối mang nhãn tài trợ trên Facebook và TikTok.
- Đóng popup chèn ngang, kể cả popup khuyến mãi của chính trang, và mở lại thanh
  cuộn bị khoá.
- Ngăn trang tự mở tab quảng cáo khi bạn bấm vào chỗ bất kỳ.
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

Không cần `npm install`, không có bước build.

## Sử dụng

Bấm vào icon trên thanh công cụ:

- **Công tắc tổng** — tắt toàn bộ tiện ích.
- **Bỏ qua trang này** — tha đúng một tên miền và các tên miền con của nó. Dùng
  khi một trang hiển thị sai.
- **Các lớp chặn** — bật tắt từng lớp một. Trang nào mất ảnh thật hoặc bấm nút
  không ăn thì tắt bớt một lớp rồi tải lại trang.
- **Chặn thêm mã theo dõi** — mặc định tắt. Mạnh tay hơn nhưng một số trang có
  thể đăng nhập lỗi hoặc không phát được video.

Huy hiệu trên icon là số lần chặn trong lần tải trang hiện tại.

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
