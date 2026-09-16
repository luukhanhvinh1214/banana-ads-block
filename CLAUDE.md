# Banana Ads Block

Extension Chrome (Manifest V3) chặn quảng cáo: chặn ở tầng mạng, cắt lịch quảng
cáo của YouTube, dọn khối quảng cáo trên trang, đóng popup chèn ngang và tua qua
quảng cáo video. Chạy hoàn toàn trên máy, không có máy chủ ngoài.

## Cấu trúc

- `manifest.json` — khai báo thứ tự nạp script và hai bộ luật mạng.
- `background.js` — service worker: giữ trạng thái, đồng bộ bộ luật, đếm, huy hiệu.
- `content.js` — ISOLATED world, cầu nối `chrome.*` cho ba lớp dọn trang.
- `src/ba_core.js`, `src/ba_prune.js`, `src/ba_boot.js` — MAIN world, chỉ nạp trên YouTube.
- `src/ba_cosmetic.js`, `src/ba_popup.js`, `src/ba_watchdog.js` — ISOLATED world, mọi trang.
- `rules/*.txt` — danh sách lọc do người viết sửa. `rules/*.json` — bản sinh ra.
- `popup/` — giao diện popup.
- `tools/` — script sinh `rules/*.json` và `icons/*.png`, chạy tay.
- `test/` — smoke test cho lớp cắt dữ liệu.

## Bốn lớp chặn

Bốn lớp dư thừa có chủ đích, sửa một lớp không được làm chết ba lớp kia:

1. `rules/ads.json` — chặn yêu cầu tới máy chủ quảng cáo ở tầng mạng.
2. `src/ba_prune.js` — cắt `adPlacements`, `playerAds`, `adSlots`,
   `adBreakHeartbeatParams` khỏi phản hồi trình phát YouTube. Đây là lớp DUY
   NHẤT diệt được quảng cáo chèn giữa video; ba lớp còn lại chỉ dọn phần đã
   hiện ra màn hình.
3. `src/ba_cosmetic.js` + `src/ba_popup.js` — ẩn khối quảng cáo, đóng lớp phủ.
4. `src/ba_watchdog.js` — bấm nút bỏ qua, không có nút thì tua nhanh.

## Quy tắc bắt buộc

Thứ tự nạp trong `manifest.json` không được đổi. MAIN world:
`ba_core → ba_prune → ba_boot`. ISOLATED world: `content.js` phải đứng đầu vì
nó dựng không gian tên cho ba file sau.

Content script cùng một world KHÔNG chia sẻ closure. MAIN world dùng chung
`window.__BAB__`, ISOLATED world dùng chung `window.__BAB_CS__`. Mọi giá trị
đổi được (`enabled`, `pruned`, `active`, `opts`) phải đọc/ghi thẳng qua không
gian tên. Copy ra biến cục bộ ở file khác sẽ đọc phải bản cũ mà không báo lỗi.

`src/ba_prune.js` phải chạy ở `world: "MAIN"` và `run_at: "document_start"`.
Ở ISOLATED world nó hook phải bản `JSON.parse` riêng của content script, trang
không thấy. Chạy muộn hơn `document_start` thì thẻ script nhúng sẵn trong HTML
đã gán xong `ytInitialPlayerResponse` trước khi setter kịp dựng.

Chỉ cắt đúng các nhánh gốc liệt kê trong `NS.PLAYER_AD_KEYS`. Quét sâu theo tên
khoá bất kỳ sẽ đụng vào dữ liệu phát lại bình thường: trình phát đứng ở vòng
quay chờ mà không báo lỗi gì, rất khó lần ra.

Hook `JSON.parse` và `Response.json` phải dựng bằng `Proxy`, không phải hàm bọc.
Proxy của một hàm vẫn trả `[native code]` khi bị `toString`, nên mã dò của trang
không thấy. Có test giữ điều này (`test/prune.test.js`, mục 5).

`rules/ads.json` và `rules/trackers.json` là **file sinh ra** — sửa
`rules/ads.txt` / `rules/trackers.txt` rồi chạy `node tools/gen_rules.js`.
Sửa thẳng file JSON sẽ mất ở lần sinh sau.

Dải id của luật không được chồng nhau: `ads` từ 1000, `trackers` từ 20000, luật
động cho danh sách bỏ qua từ 900000 (`ALLOW_RULE_BASE` trong `background.js`).

Luật `allowAllRequests` của danh sách bỏ qua phải có `priority` cao hơn 1, nếu
không luật chặn thắng và trang vẫn thủng dù người dùng đã bỏ qua nó.

Danh sách bỏ qua tính theo tên miền của TAB, lấy từ `sender.tab.url` trong
`background.js`. Đừng đổi sang `location.hostname` của content script: quảng cáo
nằm trong iframe tên miền lạ, mỗi khung sẽ tự coi mình là một trang khác.

`src/ba_watchdog.js` mượn `muted` và `playbackRate` của thẻ video thì phải trả
lại đúng thẻ đã mượn (biến `borrowed`). Bỏ bước trả là người dùng xem hết video
trong im lặng mà không hiểu vì sao.

`src/ba_cosmetic.js` và `src/ba_popup.js` chỉ được đụng vào thứ có bằng chứng là
quảng cáo. Không dùng `[class*="ad-"]`: nó khớp cả `add-to-cart`, `adaptive`,
`address`. Không gỡ lớp phủ chỉ vì nó là lớp phủ — sẽ gỡ luôn hộp đăng nhập và
hộp xác nhận tuổi.

Số phiên bản xuất hiện ở bốn nơi, phải khớp nhau: `manifest.json`,
`src/ba_core.js` (`VERSION`), `content.js` (`VERSION`), `popup/popup.html`.

## Lệnh

```
node test/prune.test.js                chạy smoke test lớp cắt dữ liệu
node --check <file>                    kiểm tra cú pháp
node tools/gen_rules.js                sinh lại rules/*.json sau khi sửa .txt
node tools/gen_icons.js                sinh lại icons/icon*.png
```

Không có bước build. Sửa xong thì tải lại extension trong `chrome://extensions`
và F5 tab đang mở.

## Cách viết mã

Hạn chế comment. Chỉ chú thích khi lý do không đọc được từ mã: một ràng buộc
của Chrome, một hành vi lạ của YouTube, một quyết định cố ý trông như lỗi.
Không viết comment mô tả lại việc mà dòng mã đã nói rõ.

Không dùng icon hay emoji trong mã, comment, tài liệu và thông điệp commit.

Giữ đúng phong cách đang có: tiếng Việt cho comment và tài liệu, JavaScript
thuần, không thêm thư viện hay công cụ build.

## Dữ liệu

Tiện ích thấy mọi trang người dùng mở. Không ghi lại URL, không gửi đi đâu.
Thứ duy nhất lưu là bốn con số đếm trong `chrome.storage.local` và danh sách
tên miền do chính người dùng bỏ qua. Đừng thêm bất cứ đường truyền dữ liệu nào
ra ngoài máy.
