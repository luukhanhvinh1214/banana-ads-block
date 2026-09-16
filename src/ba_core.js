// ===================== Không gian tên MAIN world =====================
// Ba file src/ba_core, ba_prune, ba_boot chạy ở MAIN world và KHÔNG chia sẻ
// closure với nhau — mỗi file là một scope riêng. Mọi giá trị đổi được phải
// đọc/ghi thẳng qua window.__BAB__, copy ra biến cục bộ ở file khác sẽ đọc
// phải bản cũ mà không báo lỗi.
//
// Vì sao cần MAIN world: YouTube đọc quảng cáo qua JSON.parse và fetch của
// chính trang. Content script ISOLATED có bản JSON.parse riêng, hook ở đó thì
// trang không thấy. Chỉ MAIN world mới chen được vào giữa.

(() => {
  if (window.__BAB__) return;

  const NS = {
    VERSION: "0.2.0",

    // ISOLATED world ghi đè ngay khi đọc xong chrome.storage. Mặc định bật để
    // không bỏ lọt quảng cáo trong vài mili giây chờ storage trả lời.
    enabled: true,

    pruned: 0,
    hooked: [],

    // Các nhánh quảng cáo trong phản hồi /youtubei/v1/player.
    // Chỉ cắt đúng nhánh gốc. Quét sâu theo tên khoá bất kỳ sẽ đụng vào dữ
    // liệu phát lại bình thường và làm trình phát đứng ở vòng quay chờ.
    PLAYER_AD_KEYS: [
      "adPlacements",
      "playerAds",
      "adSlots",
      "adBreakHeartbeatParams",
    ],

    // Các renderer quảng cáo nằm rải trong ytInitialData (trang chủ, kết quả
    // tìm kiếm, cột gợi ý). Phần tử nào của mảng chứa đúng một trong các khoá
    // này thì bỏ cả phần tử.
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
