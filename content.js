// Cầu nối ISOLATED world: dựng không gian tên window.__BAB_CS__ cho ba lớp dọn
// trang, và là nơi duy nhất nói chuyện được với service worker lẫn MAIN world.
// Phải nạp trước ba file kia, thứ tự trong manifest.json không được đổi.

(() => {
  if (window.__BAB_CS__) return;

  const listeners = [];
  const adListeners = [];

  const NS = {
    VERSION: "0.9.4",

    // Bật sẵn để không bỏ lọt trong lúc chờ service worker trả lời. Trang trong
    // danh sách bỏ qua sẽ được thu dọn ở lượt apply() đầu tiên.
    active: true,
    opts: { cosmetic: true, popup: true, video: true, banners: true, popunder: true },
    host: location.hostname,

    // Rỗng trên mọi trang trừ facebook.com và tiktok.com. Service worker quyết
    // định, vì chỉ nó biết khung này nằm trong tab nào.
    site: "",
    block: false,
    posters: [],

    // Gọi luôn một lần với giá trị hiện tại để lớp đăng ký không phải tự khởi
    // động riêng.
    onChange(fn) {
      listeners.push(fn);
      try {
        fn(NS.active, NS.opts);
      } catch (e) {}
    },

    // So thẳng chuỗi hostname là sai: trang nằm ở "www.example.com" còn liên
    // kết nội bộ trỏ tới "example.com", so chuỗi thì cả trang thành liên kết
    // ngoài.
    sameSite(host) {
      if (!host) return true;
      const a = host.replace(/^www\./, '').toLowerCase();
      const b = location.hostname.replace(/^www\./, '').toLowerCase();
      return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
    },

    post(op, data) {
      try {
        window.postMessage({ __bab: true, from: "cs", op, data }, "*");
      } catch (e) {}
    },

    // Lớp dọn trang đăng ký ở đây để nhận nhà quảng cáo mà ba_fbfeed.js đọc
    // được từ gói tin feed.
    onAds(fn) {
      adListeners.push(fn);
    },
  };

  const apply = (active, opts, extra) => {
    NS.active = active !== false;
    if (opts) NS.opts = opts;
    if (extra) {
      NS.site = extra.site || "";
      NS.block = !!extra.block;
      NS.posters = Array.isArray(extra.posters) ? extra.posters : [];
    }
    NS.post("enabled", NS.active);
    NS.post("opts", NS.opts);
    for (const fn of listeners) {
      try {
        fn(NS.active, NS.opts);
      } catch (e) {}
    }
  };

  // Gộp rồi mới gửi: một trang tin có thể ẩn vài chục khối trong nửa giây đầu,
  // gửi từng cái thì đánh thức service worker liên tục và huy hiệu nhấp nháy.
  let pending = null;
  let timer = 0;

  const flush = () => {
    timer = 0;
    const batch = pending;
    pending = null;
    if (!batch) return;
    try {
      chrome.runtime.sendMessage({ op: "hit", counts: batch }, () => {
        // Đọc lastError để Chrome không in cảnh báo khi service worker vừa ngủ
        // dậy chưa kịp nghe.
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

  // Gửi thẳng, không gộp như report(): mỗi nhà quảng cáo chỉ gửi một lần trong
  // suốt đời trang, và gửi muộn thì bài kế tiếp của họ đã kịp hiện ra.
  NS.addPoster = (id, name) => {
    if (!id) return;
    try {
      chrome.runtime.sendMessage({ op: "addPoster", id, name }, () => {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  };

  window.__BAB_CS__ = NS;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__bab !== true || d.from !== "main") return;

    // ba_boot.js hỏi trạng thái vì nó có thể nạp xong sau lượt apply đầu.
    if (d.op === "hello") {
      NS.post("enabled", NS.active);
      NS.post("opts", NS.opts);
    }
    if (d.op === "pruned") NS.report("video", d.data);
    // Nhà quảng cáo đọc được từ gói tin feed, tới trước lúc bài được vẽ.
    if (d.op === "fbads" && Array.isArray(d.data)) {
      for (const fn of adListeners) {
        try {
          fn(d.data);
        } catch (e) {}
      }
    }
    // Popunder tính chung vào nhóm popup: với người dùng thì cả hai đều là thứ
    // tự nhảy ra mà họ không bảo.
    if (d.op === "popunder") NS.report("popup", d.data);
  });

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.op !== "active") return;
      apply(msg.active, msg.opts, msg);
    });
  } catch (e) {}

  try {
    chrome.runtime.sendMessage({ op: "init" }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      NS.host = res.host || NS.host;
      apply(res.active, res.opts, res);
    });
  } catch (e) {}
})();
