// ===================== Lớp 3: đóng quảng cáo chèn ngang =====================
// Loại quảng cáo phủ kín màn hình, khoá cuộn trang và bắt bấm nút X mới đi.
// Kèm theo là hộp thoại "hãy tắt trình chặn quảng cáo" dựng lên khi lớp 1 và
// lớp 2 đã làm xong việc.
//
// Quy tắc: chỉ đụng vào thứ có BẰNG CHỨNG là quảng cáo — bên trong có khung
// của máy chủ quảng cáo, hoặc chữ đòi tắt trình chặn. Cứ thấy lớp phủ là gỡ
// thì sẽ gỡ luôn hộp đăng nhập, hộp xác nhận tuổi và giỏ hàng.
//
// Popunder (cửa sổ bật phía sau) không xử ở đây. Chúng đến từ một nhúm máy chủ
// cố định và đã bị rules/ads.json chặn từ tầng mạng — diệt ở gốc rẻ hơn nhiều
// so với việc canh window.open.

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
    // Hộp thoại chặn xem của chính YouTube
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
    '.dismiss,[class*="dismiss" i],button.btn-close';

  const MARK = 'data-bab-killed';

  let observer = null;
  let scheduled = 0;
  let on = false;
  let queue = [];

  const text = (el) => (el.innerText || el.textContent || '').toLowerCase();

  const looksAntiAdblock = (el) => {
    // Hộp thoại đòi tắt trình chặn luôn ngắn. Giới hạn độ dài để không quét cả
    // một bài báo viết về chủ đề chặn quảng cáo rồi xoá mất bài.
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

  // Bấm nút đóng của chính quảng cáo trước khi gỡ tay. Nhiều mạng quảng cáo
  // dựng lại lớp phủ ngay khi thấy nút của mình biến mất mà chưa được bấm;
  // bấm đúng nút thì chúng coi như đã xong lượt hiển thị và thôi.
  const clickClose = (el) => {
    const buttons = el.querySelectorAll(CLOSE_BUTTON);
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 120 || rect.height > 120) continue;
      try {
        btn.click();
        return true;
      } catch (e) {}
    }
    return false;
  };

  // Lớp phủ đi rồi mà trang vẫn không cuộn được: mã của quảng cáo khoá cuộn
  // rồi chết giữa chừng, không kịp mở lại.
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

    if (!clickClose(el)) {
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
    return 1;
  };

  const check = (el) => {
    if (!el || el.nodeType !== 1 || el.hasAttribute(MARK)) return 0;
    if (el === document.body || el === document.documentElement) return 0;
    if (!isOverlay(el)) return 0;
    if (!el.querySelector(AD_INSIDE) && !looksAntiAdblock(el)) return 0;
    return kill(el);
  };

  const sweep = () => {
    scheduled = 0;
    if (!on) return;

    const batch = queue;
    queue = [];
    let n = 0;

    try {
      for (const el of batch) n += check(el);
      // Lớp phủ hay được gắn thẳng vào body, và có khi đã nằm sẵn trong HTML
      // trước lúc bộ theo dõi kịp chạy.
      if (document.body) {
        for (const el of document.body.children) n += check(el);
      }
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
    if (active && opts.popup !== false) start();
    else stop();
  });

  CS.popup = { scan: sweep, unlockScroll };
})();
