// Bản thế thân cho pagead2.googlesyndication.com/pagead/js/adsbygoogle.js
//
// Chặn thẳng tệp này thì yêu cầu hỏng, thẻ script bắn onerror, và biến
// window.adsbygoogle không bao giờ ra đời. Cả hai đều là dấu hiệu mà trang
// dùng để kết luận có trình chặn quảng cáo.
//
// Bản này dựng đúng bộ khung mà trang trông đợi rồi không làm gì thêm: không
// tải quảng cáo, không gọi ra ngoài. Với trang thì mọi thứ đã chạy xong bình
// thường và chẳng có ô nào được lấp.

(() => {
  if (window.adsbygoogle && window.adsbygoogle.loaded) return;

  const queue = Array.isArray(window.adsbygoogle) ? window.adsbygoogle : [];

  // AdSense đánh dấu thẻ <ins> đã xử lý bằng thuộc tính này. Trang nào tự soi
  // lại thuộc tính đó để biết quảng cáo có hiện hay không sẽ thấy "done".
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
      // Cấu hình trang (enable_page_level_ads, pauseAdRequests...) chỉ cần
      // nuốt. Mỗi lần push một ô quảng cáo thì đánh dấu là đã xử lý.
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
