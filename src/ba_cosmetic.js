// ===================== Lớp 2: dọn khối quảng cáo trên trang =====================
// Chặn ở tầng mạng làm yêu cầu quảng cáo thất bại, nhưng cái khung rỗng vẫn
// chiếm chỗ: một dải trắng cao 250px giữa bài viết. Lớp này ẩn phần vỏ đó.
//
// Hai đường, cố ý dư thừa:
//   1. Một thẻ style cắm ngay lúc document_start với danh sách selector chắc
//      chắn là quảng cáo. Trình duyệt tự áp, không chờ JavaScript, nên không
//      thấy quảng cáo loé lên rồi mới biến mất.
//   2. Một bộ quét chạy sau, bắt những khung iframe trỏ về máy chủ quảng cáo
//      mà danh sách selector không đoán trước được tên lớp.

(() => {
  const CS = window.__BAB_CS__;
  if (!CS || CS.cosmetic) return;

  // Ẩn thẳng, không hỏi han. Toàn những thứ mà một đoạn mã dò không dựng ra:
  // khung của đúng máy chủ quảng cáo, hoặc thẻ riêng của YouTube.
  // Cố tình không dùng [class*="ad-"]: nó khớp cả "add-to-cart", "adaptive",
  // "address" và làm mất nút bấm của trang.
  const HARD = [
    '[data-ad-client]',
    '[data-ad-slot]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'iframe[src*="adnxs.com"]',
    'iframe[src*="criteo"]',
    'iframe[src*="admicro"]',
    'iframe[id^="google_ads_iframe"]',
    'iframe[id^="aswift_"]',
    '[id*="taboola"]',
    '[class*="taboola"]',
    '[id*="outbrain"]',
    '[class*="OUTBRAIN"]',
    '[class*="mgid-"]',
    // "catfish" là tên quy ước cho dải quảng cáo dính đáy màn hình, dùng rộng
    // rãi trên các trang Việt Nam. Đo được trên animevietsub.zip: id
    // "pc-catfixx". Đoạn mã dò chặn quảng cáo không dựng tên này bao giờ.
    '[id*="catfish" i]',
    '[class*="catfish" i]',
    '[id*="catfix" i]',
    '[class*="catfix" i]',
    // Ô quảng cáo của trình phát JW Player
    '[class*="afs_ads"]',
    // YouTube: các ô quảng cáo mà lớp cắt dữ liệu để lọt qua
    '#player-ads',
    '#masthead-ad',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-display-ad-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-ad-slot-renderer',
    'ytm-promoted-video-renderer',
    '.ytp-ad-overlay-slot',
  ];

  // Ẩn CÓ ĐIỀU KIỆN. Đây đúng là những tên mà thư viện dò chặn quảng cáo dựng
  // sẵn một thẻ div rỗng rồi đo xem nó có bị ẩn không — ẩn thẳng là tự khai
  // báo mình đang chạy, và trang sẽ khoá nội dung lại.
  //
  // Đo được trên youtube.com, animevietsub.zip và remove.bg: bảy tên dưới đây
  // từng làm mồi nhử ăn đúng, cho tới khi thêm điều kiện :has().
  //
  // Điều kiện: chỉ ẩn khi bên trong CÓ THỰC THỂ hiển thị được. Quảng cáo thật
  // luôn bọc một khung, một ảnh hay một liên kết; mồi nhử thì rỗng hoặc chỉ có
  // mỗi chữ.
  const HAS_REAL_AD = ':has(iframe, ins, img, video, a, object, embed, canvas)';

  const BAIT_PRONE = [
    'ins.adsbygoogle',
    '[id^="google_ads_"]',
    '[id^="google_ad_"]',
    '[id^="div-gpt-ad"]',
    '[id^="gpt-ad"]',
    '[id^="ad-slot"]',
    '[id^="adslot"]',
    '[id^="banner-ad"]',
    '[id$="-advertisement"]',
    '[class^="adsbygoogle"]',
    '[class^="ad-slot"]',
    '[class^="ad-banner"]',
    '[class^="ad-container"]',
    '[class^="ad-wrapper"]',
    '[class^="ad-placeholder"]',
    '[class*=" ad-slot"]',
    '[class*=" ad-banner"]',
    '[class*=" ad-container"]',
    '[class*=" ad-wrapper"]',
    '.adsbox',
    '.advertisement',
    '.advertising-container',
    '[id^="M"][id*="ScriptRootC"]',
  ];

  const SELECTORS = HARD.concat(BAIT_PRONE.map((s) => s + HAS_REAL_AD));

  // Mảnh tên miền dùng để nhận iframe quảng cáo. Ngắn gọn có chủ đích: đây chỉ
  // là lưới vớt, việc chặn thật đã do rules/ads.json làm ở tầng mạng.
  const AD_HOSTS = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'googletagservices.com',
    '2mdn.net',
    'amazon-adsystem.com',
    'adnxs.com',
    'criteo',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'smartadserver.com',
    'adform.net',
    'taboola.com',
    'outbrain.com',
    'mgid.com',
    'revcontent.com',
    'media.net',
    'adsterra.com',
    'exoclick.com',
    'popads.net',
    'propellerads.com',
    'admicro.vn',
    'eclick.vn',
    'adtima.vn',
  ];

  const MARK = 'data-bab-hidden';

  let styleEl = null;
  let observer = null;
  let scheduled = 0;
  let on = false;
  // Tách công tắc riêng cho phần nhận banner theo hình dạng: đây là phần đoán
  // nhiều nhất trong cả extension, nên phải tắt được mà không mất các lớp kia.
  let banners = true;

  const addStyle = () => {
    if (styleEl && styleEl.isConnected) return;
    // documentElement chứ không phải head: ở document_start thẻ head có thể
    // chưa tồn tại, mà chờ nó thì mất đúng khoảng thời gian cần che.
    const root = document.documentElement;
    if (!root) return;
    styleEl = document.createElement('style');
    styleEl.textContent = SELECTORS.join(',\n') + '{display:none!important}';
    root.appendChild(styleEl);
  };

  const removeStyle = () => {
    if (styleEl) styleEl.remove();
    styleEl = null;
  };

  const isAdUrl = (url) => {
    if (!url) return false;
    for (const host of AD_HOSTS) {
      if (url.indexOf(host) !== -1) return true;
    }
    return false;
  };

  const hide = (el) => {
    if (!el || el.hasAttribute(MARK)) return 0;
    el.setAttribute(MARK, '1');
    el.style.setProperty('display', 'none', 'important');
    return 1;
  };

  // Ẩn cái iframe thôi thì vẫn còn cái khung bọc nó, thường có nền xám và một
  // dòng "Quảng cáo". Leo lên tối đa ba tầng, và chỉ leo khi tầng cha không
  // chứa gì khác ngoài quảng cáo — nếu không sẽ nuốt luôn nội dung bài viết.
  const hideWrapper = (el) => {
    let node = el;
    for (let i = 0; i < 3; i++) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      if (parent.childElementCount !== 1) break;
      if ((parent.textContent || '').trim().length > 24) break;
      node = parent;
    }
    return hide(node);
  };

  // Banner ảnh nằm ngay trong dòng chảy trang, không phải lớp phủ.
  //
  // Loại này không để lại dấu vết nào cho hai lớp trước: trang tự phục vụ ảnh
  // nên không có yêu cầu mạng để chặn, và đặt tên lớp riêng nên selector không
  // đoán được. Đo trên animevietsub.zip: ba dải quảng cáo cờ bạc quanh trình
  // phát, mỗi dải là một thẻ <a target="_blank" rel="nofollow"> bọc đúng một
  // tấm ảnh, không kèm chữ nào.
  //
  // Nhận theo hình dạng: ảnh đủ to, dẫn sang tên miền khác, mở tab mới hoặc
  // đánh dấu nofollow/sponsored, và KHÔNG có chữ. Chỗ "không có chữ" là điều
  // kiện quan trọng nhất — nó loại được liên kết thật trong bài viết, thẻ ảnh
  // minh hoạ có chú thích, và mục tin bài dẫn sang trang khác.
  const SPONSORED = /(^|\s)(nofollow|sponsored)(\s|$)/i;
  const MIN_BANNER_W = 180;
  const MIN_BANNER_H = 40;

  const isBannerAd = (a) => {
    let host;
    try {
      const url = new URL(a.href, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      host = url.hostname;
    } catch (e) {
      return false;
    }
    if (!host || CS.sameSite(host)) return false;

    if (a.target !== '_blank' && !SPONSORED.test(a.getAttribute('rel') || '')) return false;
    if ((a.innerText || a.textContent || '').trim().length > 3) return false;
    if (!a.querySelector('img')) return false;

    // Thanh điều hướng và đầu trang hay có logo đối tác dẫn ra ngoài. Đó là
    // bộ khung của trang, không phải quảng cáo chèn vào.
    if (a.closest('nav, header')) return false;

    const rect = a.getBoundingClientRect();
    return rect.width >= MIN_BANNER_W && rect.height >= MIN_BANNER_H;
  };

  const scan = (root) => {
    if (!root.querySelectorAll) return 0;
    let n = 0;

    for (const frame of root.querySelectorAll('iframe[src], iframe[data-src]')) {
      if (frame.hasAttribute(MARK)) continue;
      if (!isAdUrl(frame.getAttribute('src') || frame.getAttribute('data-src'))) continue;
      n += hideWrapper(frame);
    }

    if (banners) {
      for (const a of root.querySelectorAll('a[href][target="_blank"], a[href][rel]')) {
        if (a.hasAttribute(MARK)) continue;
        if (!isBannerAd(a)) continue;
        n += hideWrapper(a);
      }
    }

    return n;
  };

  const sweep = () => {
    scheduled = 0;
    if (!on) return;
    try {
      CS.report('cosmetic', scan(document));
    } catch (e) {}
  };

  const schedule = () => {
    if (scheduled || !on) return;
    scheduled = setTimeout(sweep, 300);
  };

  const start = () => {
    if (on) return;
    on = true;
    addStyle();
    observer = new MutationObserver(schedule);
    const attach = () => {
      if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    attach();
    schedule();
  };

  const stop = () => {
    on = false;
    removeStyle();
    if (observer) observer.disconnect();
    observer = null;
    // Trả lại những gì đã ẩn, nếu không người dùng tắt tiện ích xong vẫn thấy
    // trang thủng lỗ chỗ cho tới lúc F5.
    for (const el of document.querySelectorAll('[' + MARK + ']')) {
      el.removeAttribute(MARK);
      el.style.removeProperty('display');
    }
  };

  // Cắm style ngay, đừng chờ service worker trả lời. Trang nào nằm trong danh
  // sách bỏ qua thì lượt onChange đầu tiên sẽ gỡ ra, chậm vài chục mili giây.
  addStyle();

  CS.onChange((active, opts) => {
    banners = opts.banners !== false;
    if (active && opts.cosmetic !== false) start();
    else stop();
    // Bật lại giữa chừng thì quét ngay, đừng chờ trang có thay đổi mới quét.
    if (on) schedule();
  });

  CS.cosmetic = { scan: sweep };
})();
