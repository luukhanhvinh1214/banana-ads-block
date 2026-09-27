// Lớp 1: cắt lịch quảng cáo khỏi phản hồi trình phát YouTube.
//
// Đây là lớp duy nhất diệt được quảng cáo chèn giữa video; ba lớp còn lại chỉ
// dọn phần đã hiện ra màn hình. Phải chạy ở MAIN world và run_at document_start.

(() => {
  const NS = window.__BAB__;
  if (!NS || NS.hooked.length) return;

  // Bộ MAIN world nạp trên mọi trang cho ba_shield.js. Bỏ cổng này là hook
  // JSON.parse của cả Internet để đổi lấy không gì.
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(location.hostname)) return;

  // Chặn cửa sớm. JSON.parse trên YouTube chạy vài nghìn lần mỗi phút, duyệt
  // cây hết thảy thì giật hình khi cuộn trang.
  const MARKER = /"(?:adPlacements|playerAds|adSlots|adBreakHeartbeatParams|adSlotRenderer|promoted[A-Z]|searchPyvRenderer|bannerPromoRenderer|statementBannerRenderer|displayAdRenderer|inFeedAdLayoutRenderer|adsEngagementPanelContentRenderer)/;

  const isObj = (v) => v !== null && typeof v === "object";

  // Chỉ xoá đúng nhánh gốc. Quét sâu theo tên khoá bất kỳ sẽ đụng vào dữ liệu
  // phát lại bình thường và trình phát đứng ở vòng quay chờ không báo lỗi.
  const prunePlayer = (node) => {
    let n = 0;
    if (!isObj(node)) return n;
    // get_watch trả về một mảng [{playerResponse}, {watchNextResponse}].
    if (Array.isArray(node)) {
      for (const item of node) n += prunePlayer(item);
      return n;
    }
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

  // Bỏ cả phần tử thay vì để lại vỏ rỗng, vì vỏ rỗng thành một ô trắng.
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

  // Proxy chứ không phải hàm bọc: Proxy của một hàm vẫn trả "[native code]" khi
  // bị toString, nên mã dò của trang không thấy JSON.parse đã bị thay.
  const wrap = (target, apply) => new Proxy(target, { apply });

  const origParse = JSON.parse;

  // Trang chính www.youtube.com tự kiểm JSON.parse: đưa vào một mẫu có
  // adPlacements rồi so với bản gốc, lệch là ghi "phát hiện" vào CATSTAT gửi
  // lên máy chủ. Mẫu gồm cả một phản hồi giả sinh ngẫu nhiên, nên ở tầng này
  // không phân biệt được. Trang /embed/ không chạy bộ kiểm đó.
  const selfChecks = location.hostname === "www.youtube.com" && !location.pathname.startsWith("/embed/");

  if (!selfChecks) {
    JSON.parse = wrap(origParse, (target, thisArg, args) => {
      const out = Reflect.apply(target, thisArg, args);
      if (!NS.enabled) return out;
      const raw = args[0];
      if (typeof raw === "string" && !MARKER.test(raw)) return out;
      return pruneAll(out);
    });
    NS.hooked.push("JSON.parse");
  }

  // Cắt ở tầng mạng, theo URL thật của yêu cầu. Không hook Response.json vì
  // YouTube thử cả new Response(mẫu).json(). Nó còn thử một Request tới data:
  // gắn url giả là /youtubei/v1/player, nên URL phải đọc qua getter gốc.
  const API = /^https:\/\/[a-z]+\.youtube\.com\/youtubei\/v1\/(?:player|get_watch|next|browse|search|reel)/;
  const requestUrl = window.Request && Object.getOwnPropertyDescriptor(Request.prototype, "url").get;

  const isApi = (input) => {
    try {
      const raw = input instanceof Request ? requestUrl.call(input) : String(input);
      return API.test(new URL(raw, location.href).href);
    } catch (e) {
      return false;
    }
  };

  // Trả về Response mới chứ không sửa cái cũ: get_watch được đọc dần qua
  // response.body rồi JSON.parse từng phần, nên chỉ thay được cả thân.
  const pruneResponse = async (res) => {
    try {
      const text = await res.clone().text();
      if (!MARKER.test(text)) return res;
      const out = new Response(JSON.stringify(pruneAll(origParse(text))), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
      Object.defineProperties(out, {
        url: { value: res.url },
        type: { value: res.type },
        redirected: { value: res.redirected },
      });
      return out;
    } catch (e) {
      return res;
    }
  };

  if (typeof window.fetch === "function" && requestUrl) {
    window.fetch = wrap(window.fetch, (target, thisArg, args) => {
      const pending = Reflect.apply(target, thisArg, args);
      if (!NS.enabled || !isApi(args[0])) return pending;
      return pending.then(pruneResponse);
    });
    NS.hooked.push("fetch");
  }

  // Lần tải trang đầu không đi qua fetch: YouTube nhúng thẳng dữ liệu vào một
  // thẻ script trong HTML, nên phải bắt bằng setter mới chen vào kịp.
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
