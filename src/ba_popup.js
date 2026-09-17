// Lớp 3: đóng quảng cáo chèn ngang và hộp thoại đòi tắt trình chặn.
//
// Chỉ đụng vào thứ có bằng chứng là quảng cáo. Cứ thấy lớp phủ là gỡ thì sẽ gỡ
// luôn hộp đăng nhập, hộp xác nhận tuổi và giỏ hàng.

(() => {
  const CS = window.__BAB_CS__;
  if (!CS || CS.popup) return;

  const AD_INSIDE = [
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'iframe[src*="adnxs.com"]',
    'iframe[src*="adsterra"]',
    'iframe[src*="exoclick"]',
    'iframe[src*="popads"]',
    'iframe[src*="admicro"]',
    'ins.adsbygoogle',
    '[id^="google_ads_"]',
    '[id^="div-gpt-ad"]',
    '[data-ad-slot]',
  ].join(',');

  const ANTI_ADBLOCK = [
    'tắt trình chặn quảng cáo',
    'tat trinh chan quang cao',
    'vui lòng tắt adblock',
    'tắt adblock',
    'chặn quảng cáo để tiếp tục',
    'trình chặn quảng cáo trên youtube',
    'ad blockers are not allowed',
    'ad blocker detected',
    'adblock detected',
    'adblocker detected',
    'disable your ad blocker',
    'disable your adblocker',
    'turn off your ad blocker',
    'please disable adblock',
    'whitelist us',
    'using an ad blocker',
  ];

  const CLOSE_BUTTON =
    '[class*="close" i],[id*="close" i],[aria-label*="close" i],' +
    '[aria-label*="đóng" i],[title*="close" i],[title*="đóng" i],' +
    '.dismiss,[class*="dismiss" i],button.btn-close,' +
    '[class*="hide" i],[id*="hide" i],a[href^="javascript:"]';

  // Lọc thêm bằng chữ vì các selector trên, nhất là a[href^="javascript:"],
  // bắt cả liên kết bình thường của trang.
  const CLOSE_TEXT = /^(x|×|✕|✖|❌|close|đóng|tắt|bỏ qua|skip)$/i;

  const MARK = 'data-bab-killed';

  let observer = null;
  let scheduled = 0;
  let on = false;
  let banners = true;
  let queue = [];

  const text = (el) => (el.innerText || el.textContent || '').toLowerCase();

  const trimText = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  const looksAntiAdblock = (el) => {
    // Giới hạn độ dài để không xoá nhầm một bài báo viết về chủ đề chặn quảng cáo.
    const t = text(el);
    if (t.length > 600) return false;
    for (const phrase of ANTI_ADBLOCK) {
      if (t.indexOf(phrase) !== -1) return true;
    }
    return false;
  };

  const isOverlay = (el) => {
    let style;
    try {
      style = getComputedStyle(el);
    } catch (e) {
      return false;
    }
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.position !== 'fixed' && style.position !== 'sticky' && style.position !== 'absolute') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 200 || rect.height < 100) return false;

    const coversViewport =
      rect.width >= innerWidth * 0.6 && rect.height >= innerHeight * 0.5;
    const floatsHigh = (parseInt(style.zIndex, 10) || 0) >= 100;

    return coversViewport || floatsHigh;
  };

  // Dải dính màn hình do trang tự phục vụ ảnh: không có gì để chặn ở tầng mạng
  // và tên lớp thì riêng. Nhận theo hình dạng, và chỗ "không có chữ" là thứ
  // tách nó khỏi băng cookie với hộp đăng nhập.
  const MAX_AD_TEXT = 120;

  const isAdBanner = (el) => {
    if (el.querySelector('input, textarea, select, form')) return false;

    const body = trimText(el);
    if (body.length > MAX_AD_TEXT) return false;

    const images = el.querySelectorAll('img, picture, video');
    if (!images.length) return false;

    const links = el.querySelectorAll('a[href]');
    if (!links.length) return false;

    let external = 0;
    for (const a of links) {
      let host = '';
      try {
        const url = new URL(a.href, location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
        host = url.hostname;
      } catch (e) {
        continue;
      }
      if (host && !CS.sameSite(host)) external++;
    }

    return external > 0;
  };

  // Lớp phủ khuyến mãi do CHÍNH trang phục vụ, mọi liên kết đều cùng tên miền
  // nên isAdBanner bỏ lọt hết. Ba điều kiện tách nó khỏi lớp phủ thật:
  //   - hộp đăng nhập và băng cookie luôn có ô nhập hoặc chữ thật trong DOM
  //   - khung xem ảnh phóng to cũng là ảnh lớn không chữ, nhưng ảnh của nó
  //     KHÔNG bọc trong <a href>; ảnh quảng cáo thì luôn bọc
  //   - phải nổi lên trên nội dung, không phải khối absolute trong dòng chảy
  const MAX_SPLASH_TEXT = 24;
  const MIN_SPLASH_SIDE = 150;
  const MIN_SPLASH_AREA = 60000;

  // Không đo bằng hộp của chính thẻ <a>: thẻ <a> là inline nên bọc quanh <img>
  // block thì hộp xẹp còn đúng chiều cao dòng chữ.
  const mediaBox = (a) => {
    let best = null;
    let area = 0;
    for (const m of a.querySelectorAll('img, picture, video')) {
      const r = m.getBoundingClientRect();
      if (r.width * r.height > area) {
        best = r;
        area = r.width * r.height;
      }
    }
    return best;
  };

  const isImageSplash = (el) => {
    let style;
    try {
      style = getComputedStyle(el);
    } catch (e) {
      return false;
    }
    if (style.position !== 'fixed' && (parseInt(style.zIndex, 10) || 0) < 100) return false;
    if (el.querySelector('input, textarea, select, form')) return false;
    if (trimText(el).length > MAX_SPLASH_TEXT) return false;

    for (const a of el.querySelectorAll('a[href]')) {
      if (trimText(a).length > 3) continue;
      const box = mediaBox(a);
      if (!box) continue;
      if (box.width < MIN_SPLASH_SIDE || box.height < MIN_SPLASH_SIDE) continue;
      if (box.width * box.height >= MIN_SPLASH_AREA) return true;
    }
    return false;
  };

  // Bấm nút đóng của chính quảng cáo trước khi gỡ tay: nhiều mạng dựng lại lớp
  // phủ khi thấy nút của mình biến mất mà chưa được bấm.
  const clickClose = (el) => {
    const buttons = el.querySelectorAll(CLOSE_BUTTON);
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 120 || rect.height > 120) continue;
      const label = trimText(btn);
      // Liên kết có chữ dài là liên kết thật của quảng cáo, bấm vào là mở đúng
      // trang đang cố tránh.
      if (label.length > 8 && !CLOSE_TEXT.test(label)) continue;
      try {
        btn.click();
        return true;
      } catch (e) {}
    }
    return false;
  };

  // Có nơi dùng một <div> tên lớp ngẫu nhiên bọc <svg> vẽ hai nét chéo, không
  // nhãn, không chữ. Chỉ còn hình dạng để khớp.
  const clickGlyphClose = (el) => {
    for (const svg of el.querySelectorAll('svg')) {
      const host = svg.parentElement;
      if (!host || host.closest('a[href]')) continue;
      const rect = host.getBoundingClientRect();
      if (rect.width < 8 || rect.width > 60 || rect.height < 8 || rect.height > 60) continue;
      if (trimText(host).length) continue;
      try {
        host.click();
        return true;
      } catch (e) {}
    }
    return false;
  };

  const unlockScroll = () => {
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      let style;
      try {
        style = getComputedStyle(el);
      } catch (e) {
        continue;
      }
      if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
        el.style.setProperty('overflow', 'auto', 'important');
      }
      if (style.position === 'fixed') {
        el.style.setProperty('position', 'static', 'important');
      }
    }
  };

  const kill = (el) => {
    if (el.hasAttribute(MARK)) return 0;
    el.setAttribute(MARK, '1');

    if (!clickClose(el) && !clickGlyphClose(el)) {
      el.style.setProperty('display', 'none', 'important');
    } else {
      // Bấm xong vẫn còn đó nghĩa là nút kia không phải nút đóng thật.
      setTimeout(() => {
        try {
          if (el.isConnected && el.getBoundingClientRect().height > 0) {
            el.style.setProperty('display', 'none', 'important');
          }
        } catch (e) {}
      }, 400);
    }

    unlockScroll();
    // Lượt thứ hai vì có trang khoá cuộn ở nhịp render SAU lúc lớp phủ vào DOM.
    setTimeout(unlockScroll, 500);
    return 1;
  };

  const check = (el) => {
    if (!el || el.nodeType !== 1 || el.hasAttribute(MARK)) return 0;
    if (el === document.body || el === document.documentElement) return 0;
    if (!isOverlay(el)) return 0;

    // Bốn đường nhận diện, chỉ cần một đường ăn. Không đường nào ăn thì để yên.
    const evidence =
      el.querySelector(AD_INSIDE) ||
      looksAntiAdblock(el) ||
      isAdBanner(el) ||
      (banners && isImageSplash(el));
    if (!evidence) return 0;

    return kill(el);
  };

  const checkWithChildren = (el) => {
    let n = check(el);
    if (el && el.nodeType === 1 && el.children) {
      for (const child of el.children) n += check(child);
    }
    return n;
  };

  const topOfViewport = () => {
    try {
      return document.elementsFromPoint(innerWidth / 2, innerHeight / 2);
    } catch (e) {
      return [];
    }
  };

  const sweep = () => {
    scheduled = 0;
    if (!on) return;

    const batch = queue;
    queue = [];
    let n = 0;

    // Ba đường quét vì lớp phủ có thể nằm ngoài tầm của bộ theo dõi: đã có sẵn
    // trong HTML, hoặc chèn sâu trong cây. Thứ chắn đường người dùng thì phải
    // nằm giữa màn hình, và hỏi một điểm rẻ hơn nhiều so với duyệt cả cây.
    try {
      for (const el of batch) n += checkWithChildren(el);
      if (document.body) {
        for (const el of document.body.children) n += check(el);
      }
      for (const el of topOfViewport()) n += check(el);
    } catch (e) {}

    CS.report('popup', n);
  };

  const schedule = () => {
    if (scheduled || !on) return;
    scheduled = setTimeout(sweep, 400);
  };

  const start = () => {
    if (on) return;
    on = true;
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType === 1) queue.push(node);
        }
      }
      schedule();
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    schedule();
  };

  const stop = () => {
    on = false;
    queue = [];
    if (observer) observer.disconnect();
    observer = null;
    for (const el of document.querySelectorAll('[' + MARK + ']')) {
      el.removeAttribute(MARK);
      el.style.removeProperty('display');
    }
  };

  CS.onChange((active, opts) => {
    banners = opts.banners !== false;
    if (active && opts.popup !== false) start();
    else stop();
  });

  CS.popup = { scan: sweep, unlockScroll };
})();
