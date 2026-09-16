# Banana Ads Block

Extension Chrome (Manifest V3) chặn quảng cáo: chặn ở tầng mạng, cắt lịch quảng
cáo của YouTube, dọn khối quảng cáo trên trang, đóng popup chèn ngang và tua qua
quảng cáo video. Chạy hoàn toàn trên máy, không có máy chủ ngoài.

## Cấu trúc

- `manifest.json` — khai báo thứ tự nạp và hai bộ luật mạng.
- `background.js` — service worker: giữ trạng thái, đồng bộ bộ luật, đếm, huy hiệu.
- `content.js` — ISOLATED world, cầu nối `chrome.*` cho ba lớp dọn trang.
- `src/ba_core.js`, `ba_shield.js`, `ba_prune.js`, `ba_boot.js` — MAIN world, mọi trang.
- `src/ba_cosmetic.js`, `ba_popup.js`, `ba_watchdog.js` — ISOLATED world, mọi trang.
- `surrogates/` — bản thế thân rỗng cho script quảng cáo bị chặn.
- `rules/*.txt` — danh sách lọc do người viết sửa. `rules/*.json` — bản sinh ra.
- `popup/` — giao diện popup.
- `tools/gen_rules.js` — sinh `rules/*.json` từ `rules/*.txt`, chạy tay.
- `test/` — smoke test cho lớp cắt dữ liệu.
- `mcp-server/` — cổng MCP lái Chrome để kiểm thử. Có README riêng.

## Năm lớp chặn

Dư thừa có chủ đích, sửa một lớp không được làm chết bốn lớp kia:

1. `rules/ads.json` — chặn yêu cầu tới máy chủ quảng cáo ở tầng mạng.
2. `src/ba_prune.js` — cắt `adPlacements`, `playerAds`, `adSlots`,
   `adBreakHeartbeatParams` khỏi phản hồi trình phát YouTube. Đây là lớp DUY
   NHẤT diệt được quảng cáo chèn giữa video.
3. `src/ba_shield.js` + `surrogates/` — không cho trang nhận ra đang bị chặn.
4. `src/ba_cosmetic.js` + `src/ba_popup.js` — ẩn khối quảng cáo, đóng lớp phủ.
5. `src/ba_watchdog.js` — bấm nút bỏ qua, không có nút thì tua nhanh.

## Quy tắc bắt buộc

### Thứ tự nạp

Không được đổi. MAIN world: `ba_core → ba_shield → ba_prune → ba_boot`.
ISOLATED world: `content.js` phải đứng đầu vì nó dựng không gian tên cho ba file
sau.

Content script cùng một world KHÔNG chia sẻ closure. MAIN world dùng chung
`window.__BAB__`, ISOLATED world dùng chung `window.__BAB_CS__`. Mọi giá trị đổi
được (`enabled`, `pruned`, `active`, `opts`) phải đọc/ghi thẳng qua không gian
tên. Copy ra biến cục bộ ở file khác sẽ đọc phải bản cũ mà không báo lỗi.

### Chống bị dò — phần dễ phá nhất

`src/ba_cosmetic.js` chia selector làm hai nhóm và ranh giới đó phải giữ.
Nhóm `BAIT_PRONE` (`.adsbox`, `.advertisement`, `[id^="div-gpt-ad"]`,
`[class^="ad-banner"]`...) CHỈ được ẩn khi kèm điều kiện `:has()`. Đó đúng là
những tên mà thư viện dò chặn quảng cáo dựng sẵn một thẻ div rỗng rồi đo xem nó
có bị ẩn không.

Đo trên youtube.com, animevietsub.zip và remove.bg: bỏ `:has()` đi thì 7 trong
12 mồi nhử ăn ngay trên cả ba trang. Thêm vào thì còn 0. Đừng gộp hai nhóm lại
cho gọn.

Thêm selector mới vào nhóm `HARD` thì phải tự hỏi: một đoạn mã dò có dựng ra thẻ
mang tên này không? Có thì nó thuộc `BAIT_PRONE`.

Không dùng `[class*="ad-"]`: nó khớp cả `add-to-cart`, `adaptive`, `address`.

`surrogates/*.js` trả về bộ khung rỗng cho script quảng cáo bị chặn, để thẻ
script bắn `onload` thay vì `onerror`. Luật thay thế phải có `priority` 2, cao
hơn luật chặn priority 1, nếu không luật chặn thắng và bản thế thân không bao
giờ được trả về. Mọi tệp trong `surrogates/` phải có mặt trong
`web_accessible_resources` của `manifest.json`.

`surrogates/gpt.js` chạy hết `googletag.cmd` rồi mới thay `push`. Nhiều trang
xếp cả việc dựng bố cục vào hàng đợi đó; bỏ bước chạy nốt là phần nội dung bình
thường của trang cũng đứng im.

### Nhận quảng cáo theo hình dạng

`src/ba_popup.js` (`isAdBanner`) và `src/ba_cosmetic.js` (`isBannerAd`) nhận
quảng cáo bằng hình dạng chứ không bằng tên: ảnh đủ to, dẫn sang tên miền khác,
và KHÔNG có chữ. Điều kiện "không có chữ" là thứ tách nó khỏi băng cookie, hộp
đăng nhập và mục tin bài — bỏ điều kiện đó ra là bắt đầu xoá nội dung thật.

So tên miền phải qua `CS.sameSite()`, không so thẳng `location.hostname`. Đo
trên animevietsub.zip: trang nằm ở `www.animevietsub.zip` còn mọi liên kết nội
bộ trỏ tới `animevietsub.zip`, so chuỗi thì cả trang thành liên kết ngoài.

Phần này bật tắt riêng bằng tuỳ chọn `banners` vì nó đoán nhiều nhất.

`src/ba_popup.js` chỉ được gỡ lớp phủ khi có bằng chứng: bên trong có khung của
máy chủ quảng cáo, hoặc có chữ đòi tắt trình chặn, hoặc có hình dạng banner. Gỡ
lớp phủ chỉ vì nó là lớp phủ sẽ gỡ luôn hộp đăng nhập và hộp xác nhận tuổi.

### YouTube

`src/ba_prune.js` phải chạy ở `world: "MAIN"` và `run_at: "document_start"`.
Ở ISOLATED world nó hook phải bản `JSON.parse` riêng của content script, trang
không thấy. Chạy muộn hơn `document_start` thì thẻ script nhúng sẵn trong HTML
đã gán xong `ytInitialPlayerResponse` trước khi setter kịp dựng.

File này nạp trên mọi trang nên tự kiểm tên miền ở đầu. Bỏ cái cổng đó là hook
`JSON.parse` của cả Internet để đổi lấy không gì.

Chỉ cắt đúng các nhánh gốc liệt kê trong `NS.PLAYER_AD_KEYS`. Quét sâu theo tên
khoá bất kỳ sẽ đụng vào dữ liệu phát lại bình thường: trình phát đứng ở vòng
quay chờ mà không báo lỗi gì, rất khó lần ra.

Hook `JSON.parse` và `Response.json` phải dựng bằng `Proxy`, không phải hàm bọc.
Proxy của một hàm vẫn trả `[native code]` khi bị `toString`. Có test giữ điều
này (`test/prune.test.js`, mục 5).

### Bộ luật mạng

`rules/ads.json` và `rules/trackers.json` là **file sinh ra** — sửa
`rules/ads.txt` / `rules/trackers.txt` rồi chạy `node tools/gen_rules.js`.
Sửa thẳng file JSON sẽ mất ở lần sinh sau.

Trong `rules/*.txt`, dòng có `=>` là luật THAY THẾ, không phải chặn.

Dải id không được chồng nhau: `ads` từ 1000, `trackers` từ 20000, luật động cho
danh sách bỏ qua từ 900000 (`ALLOW_RULE_BASE` trong `background.js`).

Luật `allowAllRequests` của danh sách bỏ qua phải có `priority` cao hơn 1, nếu
không luật chặn thắng và trang vẫn thủng dù người dùng đã bỏ qua nó.

### Linh tinh

Danh sách bỏ qua tính theo tên miền của TAB, lấy từ `sender.tab.url` trong
`background.js`. Đừng đổi sang `location.hostname` của content script: quảng cáo
nằm trong iframe tên miền lạ, mỗi khung sẽ tự coi mình là một trang khác.

`src/ba_watchdog.js` mượn `muted` và `playbackRate` của thẻ video thì phải trả
lại đúng thẻ đã mượn (biến `borrowed`). Bỏ bước trả là người dùng xem hết video
trong im lặng mà không hiểu vì sao.

`icons/icon*.png` sinh từ `icons/logo-bab.png` bằng một script đã xoá sau khi
chạy xong. Các cỡ nhỏ (16, 24, 32, 48) chỉ lấy dải biểu tượng trên cùng của
logo; cỡ 128 lấy nguyên logo. Thu cả phần chữ xuống 16px thì thành một vệt xám
không đọc được. Đổi logo thì viết lại script sinh, dùng xong xoá đi.

Số phiên bản xuất hiện ở bốn nơi, phải khớp nhau: `manifest.json`,
`src/ba_core.js` (`VERSION`), `content.js` (`VERSION`), `popup/popup.html`.

## Lệnh

```
node test/prune.test.js                smoke test lớp cắt dữ liệu
node mcp-server/test/smoke.test.js     smoke test cổng MCP (không mở Chrome)
node --check <file>                    kiểm tra cú pháp
node tools/gen_rules.js                sinh lại rules/*.json sau khi sửa .txt
node mcp-server/server.js --info       xem tìm thấy Chrome ở đâu
```

Không có bước build. Sửa xong thì tải lại extension trong `chrome://extensions`
và F5 tab đang mở.

## Kiểm thử trên trang thật

Cổng MCP `bab-chrome` mở Chrome đã nạp extension và chạy được bộ chẩn đoán.
Đọc [mcp-server/README.md](mcp-server/README.md) trước khi dùng — có vài cái bẫy
của Chrome đời mới ghi ở đó, cái nào cũng hỏng theo kiểu im lặng.

Sau mỗi lần sửa lớp chống dò, chạy `chrome_probe` và xác nhận
`antiAdblock.baitDetected` là mảng rỗng. Đó là thước đo duy nhất đáng tin cho
việc extension có tự lộ ra hay không.

## Cách viết mã

### Dọn file dùng một lần

Script chạy xong là xoá. Viết một đoạn mã để làm đúng một việc — sinh ảnh, đổi
hàng loạt, dò một lỗi, thử một giả thuyết — thì khi việc xong phải xoá file đó
đi, không để lại trong repo.

Tiêu chí phân biệt, chỉ một câu hỏi: **chạy lại có ra kết quả khác không?**

- KHÔNG → file dùng một lần, xoá. Kết quả đã nằm trong repo rồi, giữ script chỉ
  làm người đọc sau tưởng nó còn phần việc nào đó.
- CÓ → công cụ còn sống, giữ lại và ghi vào mục Lệnh ở trên.

Theo tiêu chí đó: `tools/gen_rules.js` được giữ vì nó chạy lại mỗi lần sửa
`rules/*.txt`. Script sinh `icons/icon*.png` đã bị xoá vì ảnh đã sinh xong và
logo thì không đổi.

Việc này áp dụng cho cả mã thử nghiệm: đoạn mã dựng ra để tái hiện một lỗi rồi
kiểm lại bản vá, xong thì xoá — hoặc biến nó thành một test thật trong `test/`
nếu điều nó kiểm còn đáng kiểm về sau. Không có tầng lửng ở giữa.

Không áp dụng cho `test/` và `mcp-server/`: cả hai chạy lại nhiều lần và có
người dùng thật.

### Comment

Hạn chế comment. Mặc định là KHÔNG viết. Mã đặt tên tử tế đã tự nói ra nó làm
gì; comment nhắc lại điều đó chỉ tạo thêm một chỗ nữa để sai lệch khi sửa mã.

Chỉ chú thích khi lý do không đọc được từ chính dòng mã:

- một ràng buộc của Chrome (vì sao phải MAIN world, vì sao phải document_start)
- một hành vi lạ của trang web (vì sao YouTube cần cắt đúng nhánh gốc)
- một quyết định cố ý trông như lỗi (vì sao ba đường thu thập lại dư thừa)
- một con số đo được, kèm chỗ đã đo (vì sao ngưỡng là 120 ký tự)

Nghĩa là comment trả lời "tại sao", không bao giờ trả lời "cái gì".

### Giao diện

Không dùng icon, emoji hay ký tự hình vẽ trong giao diện popup — chỉ chữ. Không
dùng chúng trong mã, comment, tài liệu và thông điệp commit.

Thứ duy nhất được phép là ảnh trong `icons/`: logo thương hiệu ở đầu popup và
bộ icon của extension trên thanh công cụ.

### Khác

Giữ đúng phong cách đang có: tiếng Việt cho comment và tài liệu, JavaScript
thuần, không thêm thư viện hay công cụ build.

## Dữ liệu

Tiện ích thấy mọi trang người dùng mở. Không ghi lại URL, không gửi đi đâu.
Thứ duy nhất lưu là bốn con số đếm trong `chrome.storage.local` và danh sách
tên miền do chính người dùng bỏ qua. Đừng thêm bất cứ đường truyền dữ liệu nào
ra ngoài máy.
