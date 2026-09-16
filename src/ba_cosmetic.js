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

  // Chỉ những dấu hiệu gần như không thể là nội dung thật. Cố tình không dùng
  // [class*="ad-"]: nó khớp cả "add-to-cart", "adaptive", "address" và làm mất
  // nút bấm của trang.
  const SELECTORS = [
    'ins.adsbygoogle',
    '[data-ad-client]',
    '[data-ad-slot]',
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
    '[id*="taboola"]',
    '[class*="taboola"]',
    '[id*="outbrain"]',
    '[class*="OUTBRAIN"]',
    '[class*="mgid-"]',
    '[id^="M"][id*="ScriptRootC"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'iframe[src*="adnxs.com"]',
    'iframe[src*="criteo"]',
    'iframe[src*="admicro"]',
    'iframe[id^="google_ads_iframe"]',
    'iframe[id^="aswift_"]',
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

  const scan = (root) => {
    let n = 0;
    const frames = root.querySelectorAll
      ? root.querySelectorAll('iframe[src], iframe[data-src]')
      : [];
    for (const frame of frames) {
      if (frame.hasAttribute(MARK)) continue;
      if (!isAdUrl(frame.getAttribute('src') || frame.getAttribute('data-src'))) continue;
      n += hideWrapper(frame);
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
    if (active && opts.cosmetic !== false) start();
    else stop();
  });

  CS.cosmetic = { scan: sweep };
})();
