// Không gian tên dùng chung của MAIN world.
//
// Các file MAIN world KHÔNG chia sẻ closure với nhau. Mọi giá trị đổi được phải
// đọc/ghi thẳng qua window.__BAB__; copy ra biến cục bộ ở file khác sẽ đọc phải
// bản cũ mà không báo lỗi.

(() => {
  if (window.__BAB__) return;

  const SECOND_LEVEL = /^(?:com|net|org|edu|gov|ac|co|or|ne|go|mil|int|biz|info|name|pro|health)$/;

  const NS = {
    VERSION: "0.9.10",

    // Mặc định bật để không bỏ lọt trong lúc chờ storage. ISOLATED world ghi đè
    // ngay khi đọc xong.
    enabled: true,

    pruned: 0,
    hooked: [],

    PLAYER_AD_KEYS: [
      "adPlacements",
      "playerAds",
      "adSlots",
      "adBreakHeartbeatParams",
    ],

    // Renderer quảng cáo rải trong ytInitialData. Phần tử mảng chứa một trong
    // các khoá này thì bỏ cả phần tử.
    FEED_AD_RENDERERS: [
      "adSlotRenderer",
      "promotedSparklesWebRenderer",
      "promotedSparklesTextSearchRenderer",
      "promotedVideoRenderer",
      "compactPromotedVideoRenderer",
      "compactPromotedItemRenderer",
      "searchPyvRenderer",
      "bannerPromoRenderer",
      "statementBannerRenderer",
      "displayAdRenderer",
      "inFeedAdLayoutRenderer",
      "adsEngagementPanelContentRenderer",
    ],

    opts: { popunder: true },

    // Tên miền gốc: "drive.google.com" ra "google.com", "vnexpress.net" giữ
    // nguyên, "bbc.co.uk" giữ ba nhãn vì "co.uk" là hậu tố.
    // ponytail: đoán hậu tố theo danh sách ngắn, không có Public Suffix List
    // nên hai trang khác chủ trên github.io bị coi là một.
    baseDomain(host) {
      const parts = String(host).toLowerCase().split(".");
      const n = parts.length;
      const keep = n > 2 && parts[n - 1].length === 2 && SECOND_LEVEL.test(parts[n - 2]) ? 3 : 2;
      return parts.slice(-keep).join(".");
    },

    // So theo tên miền gốc, không so nguyên hostname: Drive tạo tệp bằng cách
    // tự bấm một <a target="_blank"> trỏ sang docs.google.com, so nguyên chuỗi
    // thì cú bấm đó thành popunder và tệp không được tạo. Bỏ trống "base" là so
    // với trang đang mở.
    sameSite(host, base) {
      if (!host) return true;
      const b = base === undefined ? location.hostname : base;
      if (!b) return false;
      return NS.baseDomain(host) === NS.baseDomain(b);
    },

    log(...args) {
      if (!NS.debug) return;
      console.log("[Banana]", ...args);
    },

    debug: false,

    post(op, data) {
      try {
        window.postMessage({ __bab: true, from: "main", op, data }, "*");
      } catch (e) {}
    },

    count(n) {
      if (!n) return;
      NS.pruned += n;
      NS.post("pruned", n);
    },
  };

  window.__BAB__ = NS;
})();
