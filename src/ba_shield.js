// Lớp khiên: che dấu vết để trang không nhận ra đang bị chặn, và chặn popunder.
//
// Chạy ở MAIN world vì phải đặt biến vào đúng window mà trang nhìn thấy.

(() => {
  const NS = window.__BAB__;
  if (!NS || NS.shieldOn) return;
  NS.shieldOn = true;
  NS.shielded = [];

  // Chỉ đặt khi trang CHƯA có. Ghi đè giá trị sẵn có là đổi hành vi của trang ở
  // chỗ không liên quan gì tới quảng cáo.
  const provide = (name, value) => {
    try {
      if (window[name] !== undefined) return;
      Object.defineProperty(window, name, {
        configurable: true,
        writable: true,
        enumerable: false,
        value,
      });
      NS.shielded.push(name);
    } catch (e) {}
  };

  // Trang đặt các biến này trong một tệp quảng cáo rồi kiểm tra chúng undefined
  // để kết luận tệp đã bị chặn.
  provide("canRunAds", true);
  provide("canRunAdsTest", true);
  provide("isAdBlockActive", false);
  provide("google_ad_status", 1);

  // FuckAdBlock và bản nhái BlockAdBlock: đăng ký hai hàm gọi lại rồi chạy
  // check(). Bản giả này luôn gọi nhánh "không phát hiện".
  const makeDetector = () => {
    function Detector() {
      this._notDetected = [];
    }
    Detector.prototype.setOption = function () {
      return this;
    };
    Detector.prototype.onDetected = function () {
      return this;
    };
    Detector.prototype.onNotDetected = function (fn) {
      if (typeof fn === "function") this._notDetected.push(fn);
      return this;
    };
    Detector.prototype.on = function (detected, fn) {
      if (!detected) this.onNotDetected(fn);
      return this;
    };
    Detector.prototype.emitEvent = function () {
      for (const fn of this._notDetected) {
        try {
          fn();
        } catch (e) {}
      }
      return this;
    };
    Detector.prototype.clearEvent = function () {
      this._notDetected = [];
      return this;
    };
    Detector.prototype.check = function () {
      setTimeout(() => this.emitEvent(), 1);
      return true;
    };
    return Detector;
  };

  const Detector = makeDetector();
  provide("FuckAdBlock", Detector);
  provide("BlockAdBlock", Detector);
  provide("fuckAdBlock", new Detector());
  provide("blockAdBlock", new Detector());

  let lastClick = 0;
  let clickedLinkHost = "";

  const noteClick = (event) => {
    lastClick = Date.now();
    clickedLinkHost = "";
    const t = event && event.target;
    const link = t && t.closest ? t.closest("a[href]") : null;
    if (!link) return;
    try {
      const u = new URL(link.href, location.href);
      if (u.protocol === "http:" || u.protocol === "https:") clickedLinkHost = u.hostname;
    } catch (e) {}
  };

  // Pha capture để thấy trước mã của trang, và bắt cả pointerdown vì nhiều bộ
  // popunder nổ ngay từ đó chứ không chờ click.
  for (const type of ["pointerdown", "mousedown", "click", "auxclick"]) {
    try {
      document.addEventListener(type, noteClick, true);
    } catch (e) {}
  }

  // Popup đăng nhập và thanh toán mở ra từ một nút không có href, đúng hình
  // dạng của popunder. Loại khai báo kích thước cửa sổ đã được vế features cho
  // qua; danh sách này vớt nốt số mở bằng tab thường.
  const TRUSTED = [
    "accounts.google.com",
    "appleid.apple.com",
    "facebook.com",
    "login.microsoftonline.com",
    "login.live.com",
    "github.com",
    "paypal.com",
    "checkout.stripe.com",
    "id.zalo.me",
    "oauth.zaloapp.com",
  ];

  // Chặn window.open không điều kiện là hỏng đăng nhập bằng Google, hỏng nút
  // chia sẻ, hỏng cổng thanh toán. Nên phải có đường cho những thứ đó đi.
  //
  // Miễn trừ theo LOẠI phần tử vừa bấm thì không dùng được: popunder phổ biến
  // nhất hiện nay gắn một handler lên mọi phần tử của trang, và giao diện trình
  // phát video thì gần như toàn là <button>. Chỉ còn ĐÍCH ĐẾN để phân biệt.
  const shouldBlock = (url, features) => {
    if (!NS.enabled || NS.opts.popunder === false) return false;
    // Cửa sổ khai báo kích thước là cửa sổ trang cố ý dựng cho người dùng nhìn.
    if (features && String(features).trim()) return false;
    if (Date.now() - lastClick > 1500) return false;

    if (!url) return true;
    let target;
    try {
      target = new URL(String(url), location.href);
    } catch (e) {
      return false;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") return false;

    const host = target.hostname;
    if (NS.sameSite(host)) return false;
    // Vừa bấm đúng một liên kết dẫn tới đó thì mở tab là ý người dùng. Popunder
    // thì mở một địa chỉ chẳng dính gì tới chỗ vừa bấm.
    if (clickedLinkHost && NS.sameSite(host, clickedLinkHost)) return false;
    return !TRUSTED.some((h) => host === h || host.endsWith("." + h));
  };

  const harden = (win) => {
    if (!win) return;
    try {
      if (win.__babHardened) return;
      const original = win.open;
      if (typeof original !== "function") return;
      win.__babHardened = true;
      win.open = function (url, name, features) {
        if (shouldBlock(url, features)) {
          NS.popBlocked++;
          NS.post("popunder", 1);
          NS.log("chặn popunder:", String(url).slice(0, 120));
          return null;
        }
        return original.apply(this, arguments);
      };
    } catch (e) {
      // iframe khác tên miền thì không đụng vào được, và cũng không cần.
    }
  };

  NS.popBlocked = 0;
  harden(window);

  // Vá window.open của realm hiện tại là CHƯA ĐỦ. Cách né phổ biến là tạo một
  // iframe rỗng rồi lấy window.open nguyên bản từ realm của iframe đó, vốn
  // không dính bản vá của realm cha. Nên phải vá ngay lúc trang với tay tới
  // contentWindow.
  const patchAccessor = (proto, prop) => {
    try {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.get) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get() {
          const value = desc.get.call(this);
          if (!value) return value;
          harden(prop === "contentDocument" ? value.defaultView : value);
          return value;
        },
      });
      NS.shielded.push(prop);
    } catch (e) {}
  };

  if (window.HTMLIFrameElement) {
    patchAccessor(HTMLIFrameElement.prototype, "contentWindow");
    patchAccessor(HTMLIFrameElement.prototype, "contentDocument");
  }
  if (window.HTMLObjectElement) {
    patchAccessor(HTMLObjectElement.prototype, "contentWindow");
  }

  NS.log("khiên đã đặt:", NS.shielded.join(", "));
})();
