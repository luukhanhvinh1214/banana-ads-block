// Lớp 4: bỏ qua quảng cáo video. Có nút "Bỏ qua" thì bấm, không có thì tắt
// tiếng và tua tới cuối đoạn quảng cáo.

(() => {
  const CS = window.__BAB_CS__;
  if (!CS || CS.watchdog) return;

  const SKIP_BUTTONS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-slot button',
    '.videoAdUiSkipButton',
    '.vjs-ad-skip-button',
    '.jw-ad-skip',
  ].join(',');

  const OVERLAY_CLOSE = [
    '.ytp-ad-overlay-close-button',
    '.ytp-ad-overlay-close-container',
    '.close-padded-button',
  ].join(',');

  // Dấu hiệu trình phát đang chiếu quảng cáo, gom từ YouTube, video.js, JW Player.
  const AD_PLAYING = [
    '.ad-showing',
    '.ad-interrupting',
    '.vjs-ad-playing',
    '.vjs-ad-loading',
    '.jw-flag-ads',
  ].join(',');

  const TICK_MS = 500;

  let timer = 0;
  let on = false;
  let skipped = 0;

  // Giữ tham chiếu tới thẻ video đã mượn, không tìm lại bằng querySelector:
  // trang thay thẻ video giữa chừng thì tiếng tắt trên thẻ cũ không ai gỡ.
  let adActive = false;
  let borrowed = null;
  let savedMuted = null;
  let savedRate = null;

  const visible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const clickAll = (selector) => {
    let hit = 0;
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el)) continue;
      try {
        el.click();
        hit++;
      } catch (e) {}
    }
    return hit;
  };

  const findAdPlayer = () => {
    const marked = document.querySelector(AD_PLAYING);
    if (marked) return marked;
    return null;
  };

  const videoOf = (player) => {
    const inside = player && player.querySelector && player.querySelector('video');
    return inside || document.querySelector('video');
  };

  const borrow = (video) => {
    if (borrowed !== video) {
      giveBack();
      borrowed = video;
    }
    if (savedMuted === null) savedMuted = video.muted;
    if (savedRate === null) savedRate = video.playbackRate;
    video.muted = true;
    // Dự phòng cho trình phát chặn việc tua.
    try {
      video.playbackRate = 16;
    } catch (e) {}
  };

  const giveBack = () => {
    const video = borrowed;
    borrowed = null;
    if (video) {
      if (savedMuted !== null) video.muted = savedMuted;
      if (savedRate !== null) {
        try {
          video.playbackRate = savedRate;
        } catch (e) {}
      }
    }
    savedMuted = savedRate = null;
  };

  const fastForward = (video) => {
    const end = video.duration;
    if (!end || !isFinite(end) || end <= 0) return false;
    if (video.currentTime >= end - 0.15) return false;
    try {
      video.currentTime = end;
      return true;
    } catch (e) {
      return false;
    }
  };

  const tick = () => {
    if (!on) return;

    // Cửa rẻ nhất. Bộ đếm chạy trên mọi tab nên một truy vấn thừa mỗi nửa giây
    // nhân lên theo số tab là thấy ngay.
    if (!document.querySelector('video')) {
      if (adActive) {
        adActive = false;
        giveBack();
      }
      return;
    }

    let n = clickAll(OVERLAY_CLOSE);
    n += clickAll(SKIP_BUTTONS);

    const player = findAdPlayer();

    if (!player) {
      if (adActive) {
        adActive = false;
        giveBack();
      }
      if (n) {
        skipped += n;
        CS.report('video', n);
      }
      return;
    }

    const video = videoOf(player);
    if (video) {
      borrow(video);
      // Mỗi đoạn quảng cáo chỉ tính một lần, dù phải tua vài nhịp mới qua.
      if (fastForward(video) && !adActive) n++;
    }
    adActive = true;

    if (n) {
      skipped += n;
      CS.report('video', n);
    }
  };

  const start = () => {
    if (on) return;
    on = true;
    timer = setInterval(tick, TICK_MS);
  };

  const stop = () => {
    if (!on) return;
    on = false;
    clearInterval(timer);
    timer = 0;
    adActive = false;
    // Không kèm điều kiện: tắt tiện ích giữa lúc đang tua mà quên trả tiếng thì
    // người dùng xem tiếp trong im lặng.
    giveBack();
  };

  CS.onChange((active, opts) => {
    if (active && opts.video !== false) start();
    else stop();
  });

  CS.watchdog = { skipped: () => skipped, tick };
})();
