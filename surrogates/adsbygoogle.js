// Bản thế thân cho adsbygoogle.js.
//
// Chặn thẳng tệp này thì thẻ script bắn onerror và window.adsbygoogle không ra
// đời — cả hai đều là dấu hiệu để trang kết luận có trình chặn quảng cáo. Bản
// này dựng đúng bộ khung trang trông đợi rồi không làm gì thêm.

(() => {
  if (window.adsbygoogle && window.adsbygoogle.loaded) return;

  const queue = Array.isArray(window.adsbygoogle) ? window.adsbygoogle : [];

  // Trang tự soi thuộc tính này để biết quảng cáo có hiện hay không.
  const markSlots = () => {
    for (const ins of document.querySelectorAll("ins.adsbygoogle")) {
      if (!ins.getAttribute("data-adsbygoogle-status")) {
        ins.setAttribute("data-adsbygoogle-status", "done");
      }
    }
  };

  const adsbygoogle = {
    loaded: true,
    push(item) {
      markSlots();
      if (item && typeof item === "object" && typeof item.google_ad_client === "string") {
        window.google_ad_client = item.google_ad_client;
      }
      return 1;
    },
    // Vài trang gọi thẳng như với mảng thật.
    length: 0,
    pauseAdRequests: 0,
    onload: null,
  };

  window.adsbygoogle = adsbygoogle;
  window.google_ad_status = 1;

  // Chạy nốt những gì trang đã xếp hàng trước khi tệp này về.
  for (const item of queue) {
    try {
      adsbygoogle.push(item);
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markSlots, { once: true });
  } else {
    markSlots();
  }
})();
