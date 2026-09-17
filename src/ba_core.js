// Không gian tên dùng chung của MAIN world.
//
// Các file MAIN world KHÔNG chia sẻ closure với nhau. Mọi giá trị đổi được phải
// đọc/ghi thẳng qua window.__BAB__; copy ra biến cục bộ ở file khác sẽ đọc phải
// bản cũ mà không báo lỗi.

(() => {
  if (window.__BAB__) return;

  const NS = {
    VERSION: "0.5.6",

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

    // So thẳng chuỗi hostname là sai: trang nằm ở "www.example.com" còn liên
    // kết nội bộ trỏ tới "example.com".
    sameSite(host) {
      if (!host) return true;
      const a = String(host).replace(/^www\./, "").toLowerCase();
      const b = location.hostname.replace(/^www\./, "").toLowerCase();
      return a === b || a.endsWith("." + b) || b.endsWith("." + a);
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
