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
  //
  // Chặn ở tầng mạng xong thì khung vẫn nằm đó, rỗng nhưng còn chiếm chỗ: đo
  // trên kenh14.vn thấy 6 khung admicro để lại 2611px khoảng trống. Vào đây thì
  // hideWrapper leo lên gỡ luôn thẻ bọc, nên khoảng trống xẹp theo.
  const AD_FRAME_ID = [
    '[id*="clb-spot"]',
    '[id^="google_ads_iframe"]',
    '[id^="aswift_"]',
    '[id^="ad-frame"]',
    '[id^="adframe"]',
    '[id^="adnzone"]',
    '[id^="ias-adnzone"]',
    '[id^="admzone"]',
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
  let blockPosters = false;

  // Chứa cả id lẫn tên hiển thị, đều hạ chữ thường. Facebook có chỗ chỉ đọc
  // được tên, có chỗ chỉ đọc được id, nên khớp trúng bên nào cũng tính.
  const blocked = new Set();
  const announced = new Set();

  // Nhà quảng cáo mà ba_fbfeed.js đọc được từ gói tin feed. Tập này luôn tới
  // trước lúc bài được vẽ, nên đây là đường duy nhất ẩn kịp mà không để bài
  // loé lên một nhịp.
  const feedAds = new Set();

  const setBlocked = (list) => {
    blocked.clear();
    for (const p of list || []) {
      if (p && p.id) blocked.add(String(p.id).toLowerCase());
      if (p && p.name) blocked.add(String(p.name).toLowerCase());
    }
  };

  const isBlockedWho = (who) => {
    if (!who) return false;
    if (who.id && blocked.has(who.id.toLowerCase())) return true;
    return !!who.name && blocked.has(who.name.toLowerCase());
  };

  const isFeedAd = (who) => {
    if (!who) return false;
    if (who.id && feedAds.has(who.id.toLowerCase())) return true;
    return !!who.name && feedAds.has(who.name.toLowerCase());
  };

  const rememberPoster = (who) => {
    if (!blockPosters || !who || !who.id) return;
    const key = who.id.toLowerCase();
    if (announced.has(key)) return;
    announced.add(key);
    blocked.add(key);
    if (who.name) blocked.add(who.name.toLowerCase());
    CS.addPoster(who.id, who.name);
  };

  const addStyle = () => {
    if (styleEl && styleEl.isConnected) return;
    // documentElement chứ không phải head: ở document_start head có thể chưa có.
    const root = document.documentElement;
    if (!root) return;
    styleEl = document.createElement('style');
    let css = SELECTORS.join(',\n') + '{display:none!important}';
    // display:none làm xẹp thẻ bài TikTok: đo được 788px tụt còn 724px, và một
    // thẻ thấp hơn khung nhìn thì mốc cuộn dính lệch theo, video không còn nằm
    // giữa khung. visibility giấu chữ mà giữ nguyên chỗ nó chiếm.
    if (IS_TIKTOK) css += '\n' + TT_TAG + '{visibility:hidden!important}';
    styleEl.textContent = css;
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
  const IS_TIKTOK = /(^|\.)tiktok\.com$/i.test(location.hostname);

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

  // Chỉ dùng cho closest(), không dùng để duyệt: mỗi bình luận cũng là một
  // role="article", quét hết chúng mỗi lượt thì lượt quét dài gấp mấy lần.
  const FB_POST_BOX = '[aria-posinset], div[role="article"]';

  // Nút ba chấm của khối tài trợ. Đây là móc chắc nhất trên Facebook: nhãn nhìn
  // thấy thì họ xẻ nhỏ và xáo trộn được, còn chuỗi này thì không, vì trình đọc
  // màn hình phải đọc ra được. Nó kèm luôn tên nhà quảng cáo.
  const FB_MENU = '[role="button"][aria-label]';
  const FB_MENU_TEXT = /nội dung được (?:tài trợ|quảng cáo)|sponsored content/i;

  // Tiền tố tham lam để lấy lần xuất hiện CUỐI: nhãn tiếng Anh có "for" ở đầu
  // câu, bắt trúng chỗ đó thì tên nhà quảng cáo thành cả vế sau.
  const FB_MENU_NAME = /^(?:.*\s)?(?:của|by|from)\s+(.+)$/i;

  const fbAdMenu = (root) => {
    if (!root.querySelectorAll) return null;
    for (const el of root.querySelectorAll(FB_MENU)) {
      if (FB_MENU_TEXT.test(el.getAttribute('aria-label') || '')) return el;
    }
    return null;
  };

  const fbMenuName = (el) => {
    const label = (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const m = FB_MENU_NAME.exec(label);
    return m ? m[1].trim() : '';
  };

  // Chỉ hai nhãn đầu là tài khoản quảng cáo. Hai nhãn sau là người dùng thường
  // gắn liên kết tiếp thị vào bài của họ: ẩn bài thì được, chặn cả người đăng
  // vì một bài thì quá tay.
  const FB_AD_LABELS = ['được tài trợ', 'sponsored'];

  const fbLabelText = (raw) => {
    const t = (raw || '').replace(FB_INVISIBLE, '').replace(/\s+/g, ' ').trim().toLowerCase();
    return t.length > FB_LABEL_MAX ? '' : t;
  };

  const isFbLabel = (raw) => {
    const t = fbLabelText(raw);
    return !!t && FB_LABELS.indexOf(t) !== -1;
  };

  const isFbAdLabel = (raw) => {
    const t = fbLabelText(raw);
    return !!t && FB_AD_LABELS.indexOf(t) !== -1;
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

  // Tên hiển thị đổi được bất cứ lúc nào, id trong đường dẫn thì không, nên lấy
  // id làm khoá và giữ tên chỉ để hiện trong popup.
  const FB_NOT_PROFILE =
    /^\/(?:photo|reel|reels|watch|stories|story\.php|permalink\.php|groups|events|marketplace|hashtag|media|pages|share|video|l\.php)/i;

  const fbProfileId = (href) => {
    let url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return '';
    }
    if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return '';
    if (url.pathname === '/profile.php') return url.searchParams.get('id') || '';
    if (FB_NOT_PROFILE.test(url.pathname)) return '';
    const seg = url.pathname.split('/').filter(Boolean);
    return seg.length === 1 ? seg[0] : '';
  };

  // Nhớ theo phần tử, không theo id: Facebook dựng lại vùng feed liên tục, mà
  // mỗi lần tra lại là một lần duyệt hết liên kết đầu bài.
  const fbAuthors = new WeakMap();
  const FB_AUTHOR_LINKS = 24;
  const FB_NAME_MAX = 80;

  const fbAuthor = (post) => {
    const cached = fbAuthors.get(post);
    if (cached) return cached;

    // Tên người đăng nằm trong thẻ tiêu đề đầu bài. Không có tiêu đề thì đành
    // dò trong cả bài, nhưng chặn số liên kết để không quét hết bài dài.
    const head = post.querySelector('h2, h3, h4');
    const links = (head || post).querySelectorAll('a[href]');
    let seen = 0;

    for (const a of links) {
      if (seen++ >= FB_AUTHOR_LINKS) break;
      const id = fbProfileId(a.getAttribute('href'));
      if (!id) continue;
      const name = (a.innerText || a.textContent || '')
        .replace(FB_INVISIBLE, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name || name.length > FB_NAME_MAX) continue;
      const who = { id, name };
      fbAuthors.set(post, who);
      return who;
    }
    return null;
  };

  // Bài quảng cáo có khi chưa dựng xong liên kết tên trang lúc bị bắt, nên lấy
  // được tên từ nhãn nút ba chấm thì dùng luôn tên đó làm khoá.
  const fbAdWho = (post, menu) => {
    const who = fbAuthor(post);
    if (who) return who;
    const name = menu ? fbMenuName(menu) : '';
    return name ? { id: name, name } : null;
  };

  const fbPostIsAd = (post) => {
    if (isFeedAd(fbAuthor(post))) return true;
    if (fbAdMenu(post)) return true;

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

  // Cột phải gom "Được tài trợ", "Sinh nhật" và "Người liên hệ" vào chung một
  // thẻ chỉ rộng 300px, nên chặn theo kích thước không cứu được. Tiêu đề của
  // mục khác mới là ranh giới: thẻ nào chứa nó thì thẻ đó không phải quảng cáo.
  const fbHasOtherHeading = (el) => {
    for (const h of el.querySelectorAll('h3')) {
      if (!isFbLabel(h.textContent)) return true;
    }
    return false;
  };

  // Khối quảng cáo là tầng thấp nhất vừa có liên kết vừa không chứa tiêu đề của
  // mục khác. Xét từ chính thẻ được đưa vào: nhánh fbLive đưa vào cả mảng DOM
  // vừa dựng, mà mảng đó nhiều khi đã là khối cần ẩn.
  //
  // Quảng cáo dựng liên kết sau nhãn vài trăm mili giây. Lượt quét rơi vào
  // quãng đó thì không tầng nào hợp lệ và trả rỗng là đúng: ẩn tạm khung bọc
  // thì mục "Sinh nhật" dựng sau sẽ nằm trong đó và mất theo. Lượt quét sau bắt
  // lại đúng khối.
  const fbAdBox = (start) => {
    let node = start;
    for (let i = 0; i < 14; i++) {
      if (node.querySelector('a[href]') && !fbHasOtherHeading(node)) return node;
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) return null;
      const rect = parent.getBoundingClientRect();
      if (rect.width > innerWidth * 0.6 || rect.height > innerHeight * 2) return null;
      node = parent;
    }
    return null;
  };

  // Ưu tiên khung [aria-posinset]: đó là ranh giới bài viết do chính Facebook
  // đánh dấu, chính xác hơn mọi phép leo cây.
  // Nhãn hoa hồng cũng đủ để ẩn bài, nhưng không đủ để kết luận người đăng là
  // tài khoản quảng cáo. Chỉ nút ba chấm của khối tài trợ và nhãn "Được tài
  // trợ" mới nói được điều đó.
  const fbIsAdvertiser = (box) => {
    const menu = fbAdMenu(box);
    if (menu) return menu;

    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let node;
    let seen = 0;
    while ((node = walker.nextNode()) && seen++ < FB_TEXT_MAX) {
      if (isFbAdLabel(node.nodeValue)) return true;
    }
    return null;
  };

  // Ẩn và, khi người dùng đã bật, ghi tên nhà quảng cáo lại để lần sau chặn cả
  // bài không mang nhãn của họ.
  const fbHideAd = (box) => {
    if (!box) return 0;
    if (blockPosters) {
      const proof = fbIsAdvertiser(box);
      if (proof) rememberPoster(fbAdWho(box, proof === true ? null : proof));
    }
    return hide(box);
  };

  const fbHideFrom = (el) => {
    const post = el.closest(FB_POST_BOX);
    if (post) return fbHideAd(post);
    return fbHideAd(fbAdBox(el));
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
            if (post.hasAttribute(MARK)) continue;
            if (fbPostIsAd(post)) n += fbHideAd(post);
            else if (blockPosters && isBlockedWho(fbAuthor(post))) n += hide(post);
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
      if (fbPostIsAd(post)) n += fbHideAd(post);
      else if (blockPosters && isBlockedWho(fbAuthor(post))) n += hide(post);
    }

    // Khối tài trợ cột phải không phải là bài viết nên không lọt vào vòng trên.
    for (const menu of root.querySelectorAll(FB_MENU)) {
      if (!FB_MENU_TEXT.test(menu.getAttribute('aria-label') || '')) continue;
      n += fbHideFrom(menu);
    }

    for (const label of root.querySelectorAll('h3')) {
      if (!isFbLabel(label.textContent)) continue;
      n += fbHideFrom(label);
    }

    return n;
  };

  // TikTok dựng feed bằng cuộn dính: ẩn thẻ bài bằng display:none làm sụp chiều
  // cao thẻ về 0 và hỏng tính toán offsetTop của TikTok, dẫn tới lỗi giật
  // ngược video khi cuộn.
  // Thay vào đó: giữ nguyên chiều cao thẻ, tắt tiếng, giấu nhãn quảng cáo và
  // tự động bỏ qua sang video kế tiếp khi người dùng duyệt xuống.
  const TT_AD = '[data-e2e="ad-tag"], [data-e2e="ttam-ads-cta"], [data-e2e="sponsored-tag"], [data-e2e="feed-ad"], a[href*="ads.tiktok.com"]';
  // Chỉ ba nhãn con này mới được giấu. TT_AD còn bắt cả thẻ bọc, giấu nó đi là
  // mất luôn khung video.
  const TT_TAG = '[data-e2e="ad-tag"], [data-e2e="sponsored-tag"], [data-e2e="ttam-ads-cta"]';
  const TT_ITEM = 'article, [data-e2e="recommend-list-item-container"]';
  const TT_AD_OWN = '[data-e2e="ad-tag"], [data-e2e="ttam-ads-cta"]';
  const TT_MARK = 'data-bab-tt-ad';
  const TT_SKIPPED = 'data-bab-tt-skipped';

  const ttAuthor = (item) => {
    const a = item.querySelector('a[href^="/@"]');
    if (!a) return null;
    const id = (a.getAttribute('href') || '').slice(2).split(/[/?#]/)[0];
    return id ? { id, name: '@' + id } : null;
  };

  let ttLastDirection = 'down';
  let ttSkipping = false;
  let ttSkipTimer = 0;
  let ttFastScanTimer = 0;

  const ttContainer = () =>
    document.querySelector('[class*="DivColumnListContainer"]') ||
    document.querySelector('[data-e2e="feed-container"]');

  const ttMuteItem = (item) => {
    const v = item ? item.querySelector('video') : null;
    if (v) {
      v.muted = true;
      try { v.pause(); } catch (e) {}
    }
  };

  // Thẻ đang chiếm giữa khung nhìn. Giữa lúc TikTok cuộn sang thẻ khác thì không
  // thẻ nào thoả, nên đây cũng là dấu hiệu cú bấm trước đã ăn.
  const ttCentered = (item) => {
    const r = item.getBoundingClientRect();
    return r.top < innerHeight * 0.45 && r.bottom > innerHeight * 0.55;
  };

  const ttAdvance = () => {
    const btn = document.querySelector('[data-e2e="feed-navigation-next"]');
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    // Khung hẹp thì TikTok không vẽ nút điều hướng. Danh sách cuộn dính bắt
    // buộc, nên một cú đẩy nhỏ đủ để trình duyệt nhảy sang mốc dính kế tiếp.
    const c = ttContainer();
    if (c) c.scrollBy({ top: 1, behavior: 'smooth' });
  };

  const TT_TICK_MS = 100;
  // TikTok cuộn sang thẻ kế tiếp hết khoảng 350ms. Bấm lại thưa hơn quãng đó,
  // nếu không cú thứ hai rơi vào giữa chuyển động và đẩy vượt thêm một thẻ.
  const TT_CLICK_EVERY = 5;
  const TT_TRIES = 6;

  const ttSkipNext = (item) => {
    if (ttSkipping || !item) return;
    ttSkipping = true;
    ttMuteItem(item);
    ttAdvance();

    let ticks = 0;
    let tries = 1;
    clearInterval(ttSkipTimer);
    ttSkipTimer = setInterval(() => {
      const gone = !item.isConnected || !ttCentered(item);
      if (gone || tries > TT_TRIES) {
        clearInterval(ttSkipTimer);
        ttSkipTimer = 0;
        // Chỉ đánh dấu khi đã thôi đeo bám thẻ này. Đánh dấu ngay lúc bấm như
        // trước thì một cú bấm trượt là thẻ đó hết cơ hội được bỏ qua.
        item.setAttribute(TT_SKIPPED, '1');
        ttSkipping = false;
        // Hai quảng cáo liền nhau: cái sau đã vào giữa khung từ lúc còn bận, mà
        // lúc đó không còn sự kiện cuộn nào nữa để đánh thức.
        if (gone) checkTikTokFeed();
        return;
      }
      if (++ticks % TT_CLICK_EVERY === 0) {
        tries++;
        ttAdvance();
      }
    }, TT_TICK_MS);
  };

  const checkTikTokFeed = () => {
    if (!on || !IS_TIKTOK || ttSkipping) return;
    const c = ttContainer();
    if (!c) return;

    scanTikTok(document);

    // Tắt tiếng video quảng cáo khi vừa chớm vào tầm nhìn
    for (const item of c.querySelectorAll('[' + TT_MARK + ']')) {
      const rect = item.getBoundingClientRect();
      if (rect.top <= innerHeight * 0.9 && rect.bottom >= innerHeight * 0.1) {
        ttMuteItem(item);
      }
    }

    // Khi người dùng chủ động cuộn ngược lên, giữ nguyên vị trí xem, không can thiệp
    if (ttLastDirection === 'up') return;

    for (const item of c.querySelectorAll('[' + TT_MARK + ']')) {
      if (item.hasAttribute(TT_SKIPPED)) continue;
      if (ttCentered(item)) {
        ttSkipNext(item);
        break;
      }
    }
  };

  // Hướng duyệt chỉ đọc từ thao tác của người dùng, không suy từ scrollTop:
  // cuộn dính của TikTok nảy ngược vài pixel lúc dừng, đo được 3944 rồi 3941,
  // và bấy nhiêu đủ để bị hiểu nhầm là người dùng đang cuộn lên.
  const onTikTokKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
      ttLastDirection = 'down';
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
      ttLastDirection = 'up';
    }
  };

  const onTikTokClick = (e) => {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('[data-e2e="feed-navigation-prev"]')) {
      ttLastDirection = 'up';
    } else if (e.target.closest('[data-e2e="feed-navigation-next"]')) {
      ttLastDirection = 'down';
    }
  };

  const onTikTokWheel = (e) => {
    if (e.deltaY > 0) {
      ttLastDirection = 'down';
    } else if (e.deltaY < 0) {
      ttLastDirection = 'up';
    }
  };

  const scanTikTok = (root) => {
    let n = 0;
    const items = (root.matches && root.matches(TT_ITEM))
      ? [root]
      : root.querySelectorAll(TT_ITEM);

    for (const item of items) {
      if (item.hasAttribute(TT_MARK)) continue;

      const isAd = item.querySelector(TT_AD);
      const isBlocked = blockPosters && isBlockedWho(ttAuthor(item));

      if (isAd || isBlocked) {
        item.setAttribute(TT_MARK, '1');
        if (item.querySelector(TT_AD_OWN)) rememberPoster(ttAuthor(item));
        ttMuteItem(item);
        n++;

        // Nếu thẻ quảng cáo vừa phát hiện đã nằm ngay chính giữa màn hình, bỏ qua ngay
        if (!item.hasAttribute(TT_SKIPPED) && ttLastDirection !== 'up' && ttCentered(item)) {
          ttSkipNext(item);
        }
      }
    }

    return n;
  };

  const fastScanTikTok = () => {
    if (ttFastScanTimer || !on) return;
    ttFastScanTimer = requestAnimationFrame(() => {
      ttFastScanTimer = 0;
      if (!on) return;
      try {
        scanTikTok(document);
      } catch (e) {}
    });
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
    if (IS_TIKTOK) n += scanTikTok(root);

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
      if (IS_TIKTOK) {
        fastScanTikTok();
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
    if (IS_TIKTOK) {
      document.addEventListener('scroll', checkTikTokFeed, { capture: true, passive: true });
      document.addEventListener('keydown', onTikTokKey, { capture: true, passive: true });
      document.addEventListener('click', onTikTokClick, { capture: true, passive: true });
      document.addEventListener('wheel', onTikTokWheel, { capture: true, passive: true });
    }
    schedule();
  };

  const stop = () => {
    on = false;
    removeStyle();
    if (observer) observer.disconnect();
    observer = null;
    if (IS_TIKTOK) {
      document.removeEventListener('scroll', checkTikTokFeed, true);
      document.removeEventListener('keydown', onTikTokKey, true);
      document.removeEventListener('click', onTikTokClick, true);
      document.removeEventListener('wheel', onTikTokWheel, true);
      clearInterval(ttSkipTimer);
      ttSkipTimer = 0;
      cancelAnimationFrame(ttFastScanTimer);
      ttFastScanTimer = 0;
      ttSkipping = false;
      for (const el of document.querySelectorAll('[' + TT_MARK + ']')) {
        el.removeAttribute(TT_MARK);
      }
      for (const el of document.querySelectorAll('[' + TT_SKIPPED + ']')) {
        el.removeAttribute(TT_SKIPPED);
      }
    }
    for (const el of document.querySelectorAll('[' + MARK + ']')) {
      el.removeAttribute(MARK);
      el.style.removeProperty('display');
    }
  };

  // Cắm style ngay, đừng chờ service worker trả lời. Trang trong danh sách bỏ
  // qua sẽ được gỡ ở lượt onChange đầu tiên.
  addStyle();

  // Gói tin feed tới trước lúc bài được vẽ, nên thường chưa có gì trong DOM để
  // ẩn; fbLive sẽ bắt bài ngay khi nó vào. Lượt quét ở đây chỉ lo trường hợp
  // ngược lại: bài đã nằm sẵn mà gói tin về sau.
  CS.onAds((list) => {
    const before = feedAds.size;
    for (const who of list) {
      if (who.id) feedAds.add(String(who.id).toLowerCase());
      if (who.name) feedAds.add(String(who.name).toLowerCase());
      // Gói tin nói thẳng đây là nhà quảng cáo, không cần suy từ nhãn trên bài
      // nữa. Đây cũng là nguồn tên đầy đủ nhất cho phần chặn thật ở
      // src/ba_fbhide.js.
      rememberPoster(who);
    }
    if (feedAds.size !== before) schedule();
  });

  CS.onChange((active, opts) => {
    banners = opts.banners !== false;
    blockPosters = !!CS.block;
    setBlocked(CS.posters);
    if (active && opts.cosmetic !== false) start();
    else stop();
    if (on) schedule();
  });

  CS.cosmetic = { scan: sweep };
})();
