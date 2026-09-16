// ===================== Cầu nối ISOLATED world =====================
// File này chạy trước ba file src/ba_cosmetic, ba_popup, ba_watchdog và dựng
// sẵn không gian tên window.__BAB_CS__ cho chúng dùng. Thứ tự nạp trong
// manifest.json không được đổi.
//
// Nó là nơi DUY NHẤT trong ISOLATED world nói chuyện được với service worker
// và với MAIN world:
//   popup -> service worker -> content.js -> (các lớp dọn trang)
//                                         -> postMessage -> src/ba_*.js
//
// Danh sách trang bỏ qua tính theo tên miền của TAB, không phải của khung.
// Quảng cáo luôn nằm trong iframe tên miền lạ; lấy theo tên miền khung thì mỗi
// khung quảng cáo lại tự coi mình là một trang khác và tắt nhầm.

(() => {
  if (window.__BAB_CS__) return;

  const listeners = [];

  const NS = {
    VERSION: "0.3.0",

    // Bật sẵn để không bỏ lọt quảng cáo trong lúc chờ service worker trả lời.
    // Nếu trang nằm trong danh sách bỏ qua, các lớp sẽ tự thu dọn ở lượt
    // apply() đầu tiên.
    active: true,
    opts: { cosmetic: true, popup: true, video: true, banners: true, popunder: true },
    host: location.hostname,

    // Lớp nào cần biết trạng thái đổi thì đăng ký ở đây. Gọi luôn một lần với
    // giá trị hiện tại để lớp đó không phải tự khởi động riêng.
    onChange(fn) {
      listeners.push(fn);
      try {
        fn(NS.active, NS.opts);
      } catch (e) {}
    },

    // Cùng một trang web hay không. Dùng để phân biệt liên kết nội bộ với
    // liên kết quảng cáo dẫn ra ngoài.
    //
    // So thẳng chuỗi hostname là sai: đo trên animevietsub.zip thì trang nằm ở
    // "www.animevietsub.zip" còn mọi liên kết nội bộ trỏ tới
    // "animevietsub.zip" — so chuỗi thì cả trang thành liên kết ngoài.
    // Không dùng danh sách hậu tố công cộng, chỉ cần một bên là tên miền con
    // của bên kia là đủ cho việc này.
    sameSite(host) {
      if (!host) return true;
      const a = host.replace(/^www\./, '').toLowerCase();
      const b = location.hostname.replace(/^www\./, '').toLowerCase();
      return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
    },

    // Gửi cho MAIN world (chỉ có trên YouTube).
    post(op, data) {
      try {
        window.postMessage({ __bab: true, from: "cs", op, data }, "*");
      } catch (e) {}
    },
  };

  const apply = (active, opts) => {
    NS.active = active !== false;
    if (opts) NS.opts = opts;
    NS.post("enabled", NS.active);
    NS.post("opts", NS.opts);
    for (const fn of listeners) {
      try {
        fn(NS.active, NS.opts);
      } catch (e) {}
    }
  };

  // ===== Đếm số lần chặn =====
  // Gộp rồi mới gửi. Một trang tin tức có thể ẩn vài chục khối quảng cáo trong
  // nửa giây đầu; gửi từng cái một thì đánh thức service worker liên tục và
  // huy hiệu trên thanh công cụ nhấp nháy theo.
  let pending = null;
  let timer = 0;

  const flush = () => {
    timer = 0;
    const batch = pending;
    pending = null;
    if (!batch) return;
    try {
      chrome.runtime.sendMessage({ op: "hit", counts: batch }, () => {
        // Đọc lastError để Chrome không in "Unchecked runtime.lastError" khi
        // service worker vừa ngủ dậy chưa kịp nghe.
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  };

  NS.report = (kind, n) => {
    if (!n) return;
    if (!pending) pending = {};
    pending[kind] = (pending[kind] || 0) + n;
    if (!timer) timer = setTimeout(flush, 500);
  };

  window.__BAB_CS__ = NS;

  // ===== Nghe MAIN world =====
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__bab !== true || d.from !== "main") return;

    // src/ba_boot.js hỏi trạng thái vì nó có thể nạp xong sau lượt apply đầu.
    if (d.op === "hello") {
      NS.post("enabled", NS.active);
      NS.post("opts", NS.opts);
    }
    if (d.op === "pruned") NS.report("video", d.data);
    // Popunder tính chung vào nhóm popup: với người dùng thì cả hai đều là
    // "thứ tự nhảy ra mà tôi không bảo".
    if (d.op === "popunder") NS.report("popup", d.data);
  });

  // ===== Nghe service worker =====
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.op !== "active") return;
      apply(msg.active, msg.opts);
    });
  } catch (e) {}

  // ===== Hỏi trạng thái ban đầu =====
  try {
    chrome.runtime.sendMessage({ op: "init" }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      NS.host = res.host || NS.host;
      apply(res.active, res.opts);
    });
  } catch (e) {}
})();
