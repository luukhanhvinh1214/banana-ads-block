// Lớp 2: ẩn khối quảng cáo còn sót lại trên trang.

(() => {
  const CS = window.__BAB_CS__;
  if (!CS || CS.cosmetic) return;

  // Ẩn thẳng. Không dùng [class*="ad-"]: nó khớp cả "add-to-cart", "address".
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
    '[id*="catfish" i]',
    '[class*="catfish" i]',
    '[id*="catfix" i]',
    '[class*="catfix" i]',
    '[class*="afs_ads"]',
    // TikTok. Bám data-e2e vì đó là móc test của chính TikTok, sống qua các
    // lượt build; tên lớp bên cạnh sinh lại mỗi lần.
    'article:has([data-e2e="sponsored-tag"])',
    '[data-e2e="recommend-list-item-container"]:has([data-e2e="sponsored-tag"])',
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

  // Ẩn CÓ ĐIỀU KIỆN. Thư viện dò chặn quảng cáo dựng sẵn thẻ div rỗng mang
  // đúng những tên này rồi đo xem có bị ẩn không, nên ẩn thẳng là tự khai báo.
  // Quảng cáo thật luôn bọc một khung, một ảnh hay một liên kết; mồi thì rỗng.
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
    '[class*="ads-banner"]',
    '[class^="ads-"]',
    '[class*=" ads-"]',
    '[id^="ad_info"]',
  ];

  const SELECTORS = HARD.concat(BAIT_PRONE.map((s) => s + HAS_REAL_AD));

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

  // Mạng quảng cáo đổi tên miền liên tục, nhưng tên id của khung thì cố định.
  const AD_FRAME_ID = [
    '[id*="clb-spot"]',
    '[id^="google_ads_iframe"]',
    '[id^="aswift_"]',
    '[id^="ad-frame"]',
    '[id^="adframe"]',
  ].join(',');

  // Cỡ chuẩn IAB. Nhúng thật không bao giờ rơi đúng vào bảng cỡ quảng cáo.
  const IAB_SIZES = [
    [728, 90], [970, 90], [970, 250], [300, 250], [336, 280], [300, 600],
    [160, 600], [120, 600], [320, 50], [320, 100], [468, 60], [234, 60],
    [300, 100], [250, 250], [200, 200], [180, 150], [125, 125], [980, 120],
  ];

  // Bên thứ ba nhưng là nhúng thật, không được đụng vào.
  const EMBED_OK = [
    'youtube.com', 'youtube-nocookie.com', 'youtu.be', 'vimeo.com',
    'dailymotion.com', 'soundcloud.com', 'spotify.com', 'twitch.tv',
    'google.com', 'gstatic.com', 'googleapis.com', 'recaptcha.net',
    'hcaptcha.com', 'cloudflare.com', 'facebook.com', 'instagram.com',
    'twitter.com', 'x.com', 'disqus.com', 'stripe.com', 'paypal.com',
    'codepen.io', 'jsfiddle.net', 'github.com', 'gitlab.com',
  ];

  const MARK = 'data-bab-hidden';

  let styleEl = null;
  let observer = null;
  let scheduled = 0;
  let on = false;
  let banners = true;

  const addStyle = () => {
    if (styleEl && styleEl.isConnected) return;
    // documentElement chứ không phải head: ở document_start head có thể chưa có.
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

  // Chỉ leo khi tầng cha không chứa gì ngoài quảng cáo, nếu không sẽ nuốt luôn
  // nội dung bài viết.
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

  const SPONSORED = /(^|\s)(nofollow|sponsored)(\s|$)/i;
  const MIN_BANNER_SIDE = 50;
  const MIN_BANNER_AREA = 20000;

  // Huy hiệu đánh giá có đúng hình dạng quảng cáo nên phải loại theo tên miền:
  // huy hiệu Product Hunt 242x108 còn nhỏ hơn banner quảng cáo dọc 135x270.
  const BADGE_HOSTS = [
    'producthunt.com',
    'trustpilot.com',
    'g2.com',
    'capterra.com',
    'getapp.com',
    'sourceforge.net',
    'shields.io',
    'badgen.net',
    'w3.org',
    'play.google.com',
    'apps.apple.com',
    'microsoft.com',
  ];

  const isBadgeHost = (host) => {
    for (const b of BADGE_HOSTS) {
      if (host === b || host.endsWith('.' + b)) return true;
    }
    return false;
  };

  // Không đo bằng hộp của chính thẻ <a>: thẻ <a> là inline nên bọc quanh <img>
  // block thì hộp xẹp còn đúng chiều cao dòng chữ.
  const linkBox = (a) => {
    let best = a.getBoundingClientRect();
    let area = best.width * best.height;
    for (const img of a.querySelectorAll('img, picture, video')) {
      const r = img.getBoundingClientRect();
      if (r.width * r.height > area) {
        best = r;
        area = r.width * r.height;
      }
    }
    return best;
  };

  // Nhận banner theo hình dạng: ảnh đủ to, dẫn sang tên miền khác, KHÔNG có chữ.
  // Điều kiện không có chữ tách nó khỏi liên kết thật trong bài viết.
  const isBannerAd = (a) => {
    let host;
    try {
      const url = new URL(a.href, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      host = url.hostname;
    } catch (e) {
      return false;
    }
    if (!host || CS.sameSite(host) || isBadgeHost(host)) return false;

    if (a.target !== '_blank' && !SPONSORED.test(a.getAttribute('rel') || '')) return false;
    if ((a.innerText || a.textContent || '').trim().length > 3) return false;
    if (!a.querySelector('img')) return false;

    if (a.closest('nav, header')) return false;

    const rect = linkBox(a);
    if (rect.width < MIN_BANNER_SIDE || rect.height < MIN_BANNER_SIDE) return false;
    return rect.width * rect.height >= MIN_BANNER_AREA;
  };

  const embedAllowed = (host) => {
    for (const ok of EMBED_OK) {
      if (host === ok || host.endsWith('.' + ok)) return true;
    }
    return false;
  };

  const isAdSizedFrame = (frame) => {
    const src = frame.getAttribute('src') || frame.getAttribute('data-src');
    if (!src) return false;

    let host;
    try {
      const url = new URL(src, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      host = url.hostname;
    } catch (e) {
      return false;
    }
    if (CS.sameSite(host) || embedAllowed(host)) return false;

    const rect = frame.getBoundingClientRect();
    for (const [w, h] of IAB_SIZES) {
      if (Math.abs(rect.width - w) <= 4 && Math.abs(rect.height - h) <= 4) return true;
    }
    return false;
  };

  // Facebook không có selector nào bám được: tên lớp là chuỗi băm sinh lại mỗi
  // lượt build. Chỉ còn chữ trên nhãn, mà chữ đó có một ký tự U+200B dính ngay
  // sau và trim() không cắt nó, nên phải lọc ký tự vô hình trước khi so.
  const IS_FACEBOOK = /(^|\.)facebook\.com$/i.test(location.hostname);

  const FB_INVISIBLE = /[­​-‏⁠﻿]/g;
  const FB_LABELS = [
    'được tài trợ',
    'sponsored',
    'đủ điều kiện nhận tiền hoa hồng',
    'eligible for commission',
  ];

  // So khớp CẢ CHUỖI: có người tên "Nguyễn Thành Được" và có bài viết nguyên
  // câu "hôm nay tôi được tài trợ một chuyến đi".
  const FB_LABEL_MAX = 40;

  const FB_REF_ATTRS = ['aria-labelledby', 'aria-describedby'];
  const FB_REFS = '[aria-labelledby], [aria-describedby]';
  const FB_POST = '[aria-posinset]';

  const isFbLabel = (raw) => {
    const t = (raw || '').replace(FB_INVISIBLE, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t || t.length > FB_LABEL_MAX) return false;
    for (const label of FB_LABELS) {
      if (t === label) return true;
    }
    return false;
  };

  // Nhớ lại kết quả tra id để lượt sau khỏi đọc DOM lần nữa. Facebook đổi
  // aria-labelledby liên tục, mà mỗi lần tra là một lần dựng lại chuỗi chữ của
  // thẻ đích.
  const fbLabelIds = new Set();
  const fbPlainIds = new Set();
  const FB_ID_CACHE_MAX = 4000;

  const fbIsLabelId = (id) => {
    if (fbLabelIds.has(id)) return true;
    if (fbPlainIds.has(id)) return false;

    const target = document.getElementById(id);
    if (!target) return false;
    const text = target.textContent;
    if (isFbLabel(text)) {
      fbLabelIds.add(id);
      return true;
    }

    // Thẻ rỗng nghĩa là chữ còn đang trên đường tới. Nhớ "không phải" lúc này
    // là khoá luôn bài đó lại.
    if (text && text.trim()) {
      if (fbPlainIds.size >= FB_ID_CACHE_MAX) fbPlainIds.clear();
      fbPlainIds.add(id);
    }
    return false;
  };

  // Đường duy nhất bắt được bài quảng cáo trong feed: chữ nhãn không nằm trong
  // bài. Facebook để nó trong một <span id> ẩn ở cuối body, bài chỉ giữ con trỏ
  // aria-labelledby tới id đó.
  const fbRefIsAd = (el) => {
    for (const attr of FB_REF_ATTRS) {
      const ids = el.getAttribute(attr);
      if (!ids) continue;
      for (const id of ids.split(/\s+/)) {
        if (fbIsLabelId(id)) return true;
      }
    }
    return false;
  };

  // Facebook chèn hàng chục nút chữ mồi vào trước phần đầu bài: đo trên feed
  // thật thấy 33 nút "Facebook" lặp lại rồi mới tới tên người đăng, nhãn rơi
  // xuống nút thứ 38. Trần 80 như trước là bài nào đệm dày hơn thì thoát hẳn,
  // và thoát hẳn thì không lượt quét nào sau đó bắt lại được.
  const FB_TEXT_MAX = 600;

  const fbPostIsAd = (post) => {
    const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT);
    let node;
    let seen = 0;
    while ((node = walker.nextNode()) && seen++ < FB_TEXT_MAX) {
      if (isFbLabel(node.nodeValue)) return true;
    }

    for (const el of post.querySelectorAll(FB_REFS)) {
      if (fbRefIsAd(el)) return true;
    }

    return false;
  };

  // Leo từ nhãn lên tổ tiên đầu tiên CÓ CHỨA liên kết; các tầng dưới chỉ bọc
  // mỗi dòng tiêu đề. Chặn theo kích thước là bắt buộc: thêm một tầng nữa là
  // khung ôm cả trang, ẩn nhầm thành màn hình trắng.
  const fbAdBox = (label) => {
    let node = label;
    for (let i = 0; i < 14; i++) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) return null;
      node = parent;
      const rect = node.getBoundingClientRect();
      if (rect.width > innerWidth * 0.6 || rect.height > innerHeight * 2) return null;
      if (node.querySelector('a[href]')) return node;
    }
    return null;
  };

  // Ưu tiên khung [aria-posinset]: đó là ranh giới bài viết do chính Facebook
  // đánh dấu, chính xác hơn mọi phép leo cây.
  const fbHideFrom = (el) => {
    const post = el.closest(FB_POST);
    if (post) return hide(post);
    const box = fbAdBox(el);
    return box ? hide(box) : 0;
  };

  // Nhãn ẩn và con trỏ trỏ tới nó không vào DOM cùng lúc, và thứ tự không cố
  // định. Nhánh này lo chiều nhãn tới sau; chiều ngược lại do bản ghi
  // attributes lo.
  const fbLabelAppeared = (el) => {
    if (!el) return 0;
    if (!el.id) return fbHideFrom(el);
    fbLabelIds.add(el.id);
    let ref = null;
    try {
      const id = CSS.escape(el.id);
      ref = document.querySelector(
        '[aria-labelledby~="' + id + '"], [aria-describedby~="' + id + '"]'
      );
    } catch (e) {}
    return ref ? fbHideFrom(ref) : 0;
  };

  // Trần cho một lượt. Facebook dựng lại cả vùng feed trong một tác vụ khi cuộn
  // nhanh, không chặn thì lượt này kéo dài ngay giữa đường vẽ.
  const FB_LIVE_RECORDS = 400;
  const FB_LIVE_POSTS = 40;

  // Chạy thẳng trong callback của MutationObserver. Callback đó tới ở cuối tác
  // vụ vừa đổi DOM, trước lượt vẽ kế tiếp, nên bài quảng cáo bị ẩn mà chưa kịp
  // hiện lên lần nào. Chờ bộ đếm giờ của sweep thì nó đã nằm trên màn hình vài
  // trăm mili giây, và trên feed dài thì lâu hơn nữa vì sweep quét lại cả trang.
  //
  // Đổi lại, mã trong này chỉ được đụng vào đúng phần DOM vừa đổi.
  const fbLive = (records) => {
    let n = 0;
    let seen = FB_LIVE_RECORDS;
    let deep = FB_LIVE_POSTS;

    for (const rec of records) {
      if (seen <= 0) break;

      if (rec.type === 'attributes') {
        seen--;
        if (fbRefIsAd(rec.target)) n += fbHideFrom(rec.target);
        continue;
      }

      for (const node of rec.addedNodes) {
        if (seen <= 0) break;
        seen--;

        if (node.nodeType === 3) {
          if (isFbLabel(node.nodeValue)) n += fbLabelAppeared(node.parentElement);
          continue;
        }
        if (node.nodeType !== 1) continue;

        // Nhãn ẩn là một thẻ lá nên đọc textContent của nó không tốn gì. Thẻ có
        // con thì bỏ qua, nếu không mỗi bài viết mới lại dựng lại chuỗi chữ của
        // cả bài chỉ để so với bốn chữ.
        if (node.childElementCount === 0) {
          if (isFbLabel(node.textContent)) n += fbLabelAppeared(node);
          continue;
        }

        if (deep <= 0) continue;

        const posts = node.matches(FB_POST) ? [node] : node.querySelectorAll(FB_POST);
        if (posts.length) {
          for (const post of posts) {
            if (deep-- <= 0) break;
            if (!post.hasAttribute(MARK) && fbPostIsAd(post)) n += hide(post);
          }
          continue;
        }

        // Mảnh gắn thêm vào bài đã nằm sẵn trong DOM. Facebook chỉ dựng nội
        // dung bài khi nó sắp vào tầm mắt, nên đây mới là lúc nhãn xuất hiện
        // lúc người dùng cuộn tới. Phải soi cả chữ lẫn con trỏ.
        deep--;
        if (fbPostIsAd(node)) n += fbHideFrom(node);
      }
    }

    return n;
  };

  // Lưới an toàn cho những gì fbLive bỏ lọt: phần DOM có sẵn từ lúc trang mở,
  // lúc vừa bật lại tiện ích, và những lượt cuộn tiêu hết hạn mức.
  const scanFacebook = (root) => {
    let n = 0;

    for (const post of root.querySelectorAll(FB_POST)) {
      if (post.hasAttribute(MARK)) continue;
      if (fbPostIsAd(post)) n += hide(post);
    }

    for (const label of root.querySelectorAll('h3')) {
      if (!isFbLabel(label.textContent)) continue;
      n += fbHideFrom(label);
    }

    return n;
  };

  const scan = (root) => {
    if (!root.querySelectorAll) return 0;
    let n = 0;

    for (const frame of root.querySelectorAll('iframe[src], iframe[data-src]')) {
      if (frame.hasAttribute(MARK)) continue;
      const byHost = isAdUrl(frame.getAttribute('src') || frame.getAttribute('data-src'));
      if (!byHost && !isAdSizedFrame(frame)) continue;
      n += hideWrapper(frame);
    }

    for (const frame of root.querySelectorAll(AD_FRAME_ID)) {
      if (frame.hasAttribute(MARK)) continue;
      n += hideWrapper(frame);
    }

    if (banners) {
      for (const a of root.querySelectorAll('a[href][target="_blank"], a[href][rel]')) {
        if (a.hasAttribute(MARK)) continue;
        if (!isBannerAd(a)) continue;
        n += hideWrapper(a);
      }
    }

    if (IS_FACEBOOK) n += scanFacebook(root);

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
    observer = new MutationObserver((records) => {
      if (IS_FACEBOOK) {
        try {
          CS.report('cosmetic', fbLive(records));
        } catch (e) {}
      }
      schedule();
    });
    const attach = () => {
      if (!document.documentElement) return;
      const opts = { childList: true, subtree: true };
      // Facebook gắn aria-labelledby vào bài SAU khi bài đã vào DOM. Nghe mỗi
      // childList thì không còn gì đánh thức bộ quét và bài quảng cáo lọt hẳn.
      if (IS_FACEBOOK) {
        opts.attributes = true;
        opts.attributeFilter = FB_REF_ATTRS;
      }
      observer.observe(document.documentElement, opts);
    };
    attach();
    schedule();
  };

  const stop = () => {
    on = false;
    removeStyle();
    if (observer) observer.disconnect();
    observer = null;
    for (const el of document.querySelectorAll('[' + MARK + ']')) {
      el.removeAttribute(MARK);
      el.style.removeProperty('display');
    }
  };

  // Cắm style ngay, đừng chờ service worker trả lời. Trang trong danh sách bỏ
  // qua sẽ được gỡ ở lượt onChange đầu tiên.
  addStyle();

  CS.onChange((active, opts) => {
    banners = opts.banners !== false;
    if (active && opts.cosmetic !== false) start();
    else stop();
    if (on) schedule();
  });

  CS.cosmetic = { scan: sweep };
})();
