// ===================== Lớp 1: cắt dữ liệu quảng cáo =====================
// Phản hồi /youtubei/v1/player mang theo lịch chiếu quảng cáo (adPlacements,
// playerAds, adSlots). Xoá các nhánh đó TRƯỚC khi trình phát đọc tới thì không
// có lần chen quảng cáo nào được xếp lịch — không có gì để bấm bỏ qua hay tua.
//
// Đây là lớp duy nhất diệt được quảng cáo chèn giữa video. Ba lớp còn lại
// (ba_cosmetic, ba_popup, ba_watchdog) chỉ dọn phần đã hiện ra màn hình.
//
// Cũng vì cắt ở đây mà YouTube không dò ra: bộ dò chống chặn quảng cáo tìm
// những ô quảng cáo đã nạp nhưng không được phát. Ô không tồn tại thì không có
// gì để nó so.

(() => {
  const NS = window.__BAB__;
  if (!NS || NS.hooked.length) return;

  // Bộ MAIN world nạp trên mọi trang để src/ba_shield.js làm việc của nó,
  // nhưng phần dưới đây chỉ có nghĩa với YouTube. Hook JSON.parse của mọi
  // trang trên đời là trả một cái giá không đổi lấy được gì.
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(location.hostname)) return;

  // Chặn cửa sớm: chỉ đụng vào chuỗi nào thật sự có dấu vết quảng cáo.
  // JSON.parse trên YouTube chạy vài nghìn lần mỗi phút, phần lớn là dữ liệu
  // bình thường; duyệt cây hết thảy thì giật hình khi cuộn trang.
  const MARKER = /"(?:adPlacements|playerAds|adSlots|adBreakHeartbeatParams|adSlotRenderer|promoted[A-Z]|searchPyvRenderer|bannerPromoRenderer|statementBannerRenderer|displayAdRenderer|inFeedAdLayoutRenderer|adsEngagementPanelContentRenderer)/;

  const isObj = (v) => v !== null && typeof v === "object";

  // Cắt lịch quảng cáo trong một phản hồi trình phát. Chỉ xoá đúng nhánh gốc;
  // phản hồi lồng nhau (dạng { playerResponse: {...} }) thì lột thêm một lớp.
  const prunePlayer = (node) => {
    let n = 0;
    if (!isObj(node)) return n;
    for (const key of NS.PLAYER_AD_KEYS) {
      if (node[key] !== undefined) {
        delete node[key];
        n++;
      }
    }
    if (isObj(node.playerResponse)) n += prunePlayer(node.playerResponse);
    return n;
  };

  const isAdItem = (item) => {
    for (const key of NS.FEED_AD_RENDERERS) {
      if (item[key] !== undefined) return true;
    }
    return false;
  };

  // Gỡ các thẻ quảng cáo nằm rải trong ytInitialData và các phản hồi
  // browse/next/search. Chúng luôn là một phần tử của mảng, nên bỏ cả phần tử
  // thay vì để lại vỏ rỗng — để vỏ rỗng thì YouTube dựng ra một ô trắng.
  const pruneFeed = (root) => {
    let n = 0;
    const seen = new WeakSet();

    const walk = (node, depth) => {
      if (!isObj(node) || depth > 24 || seen.has(node)) return;
      seen.add(node);

      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          const item = node[i];
          if (isObj(item) && !Array.isArray(item) && isAdItem(item)) {
            node.splice(i, 1);
            n++;
            continue;
          }
          walk(item, depth + 1);
        }
        return;
      }

      for (const key in node) {
        if (NS.FEED_AD_RENDERERS.indexOf(key) !== -1) {
          delete node[key];
          n++;
          continue;
        }
        walk(node[key], depth + 1);
      }
    };

    walk(root, 0);
    return n;
  };

  const pruneAll = (node) => {
    if (!NS.enabled || !isObj(node)) return node;
    try {
      NS.count(prunePlayer(node) + pruneFeed(node));
    } catch (e) {}
    return node;
  };

  // Proxy chứ không phải hàm bọc: Proxy của một hàm vẫn trả về
  // "function parse() { [native code] }" khi bị gọi toString, nên mã dò của
  // trang không thấy JSON.parse đã bị thay.
  const wrap = (target, apply) => new Proxy(target, { apply });

  // --- JSON.parse: đường chính, YouTube tự parse phần lớn phản hồi ---
  const origParse = JSON.parse;
  JSON.parse = wrap(origParse, (target, thisArg, args) => {
    const out = Reflect.apply(target, thisArg, args);
    if (!NS.enabled) return out;
    const raw = args[0];
    if (typeof raw === "string" && !MARKER.test(raw)) return out;
    return pruneAll(out);
  });
  NS.hooked.push("JSON.parse");

  // --- Response.json: một số đường của YouTube đọc thẳng qua đây ---
  if (window.Response && Response.prototype && Response.prototype.json) {
    const origJson = Response.prototype.json;
    Response.prototype.json = wrap(origJson, (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args).then((out) => pruneAll(out))
    );
    NS.hooked.push("Response.json");
  }

  // --- ytInitialPlayerResponse / ytInitialData ---
  // Lần tải trang đầu tiên không đi qua fetch: YouTube nhúng thẳng dữ liệu vào
  // một thẻ script trong HTML. Bắt bằng setter là cách duy nhất chen vào kịp,
  // và đó là lý do bộ script này phải chạy ở run_at document_start.
  const defineHooked = (name) => {
    let value;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (next) => {
          value = pruneAll(next);
        },
      });
      NS.hooked.push(name);
    } catch (e) {}
  };

  defineHooked("ytInitialPlayerResponse");
  defineHooked("ytInitialData");

  NS.log("đã hook", NS.hooked.join(", "));
})();
