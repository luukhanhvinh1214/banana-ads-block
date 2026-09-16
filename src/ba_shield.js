// ===================== Lớp khiên: chống bị dò =====================
// Trang phát hiện có trình chặn quảng cáo bằng ba cách, gần như luôn là ba
// cách này:
//
//   1. Dựng một thẻ div rỗng mang tên quen thuộc ("adsbox", "ad-banner") rồi
//      đo xem nó có bị ẩn không. Đối phó ở src/ba_cosmetic.js — chỉ ẩn phần tử
//      thật sự bọc quảng cáo, nên mồi rỗng không dính.
//
//   2. Nạp một tệp script của mạng quảng cáo rồi bắt sự kiện onerror, hoặc hỏi
//      xem biến toàn cục mà tệp đó lẽ ra phải tạo có tồn tại không. Đối phó ở
//      surrogates/ — chặn xong thì trả về một bản rỗng chạy được, thay vì để
//      yêu cầu hỏng.
//
//   3. Hỏi thẳng vài biến toàn cục quy ước. Đối phó ở ngay file này.
//
// Chạy ở MAIN world vì phải đặt biến vào đúng window mà trang nhìn thấy.
// Content script ISOLATED có window riêng, đặt ở đó thì trang không thấy gì.

(() => {
  const NS = window.__BAB__;
  if (!NS || NS.shieldOn) return;
  NS.shieldOn = true;
  NS.shielded = [];

  // Chỉ đặt khi trang CHƯA có. Ghi đè giá trị sẵn có là đổi hành vi của trang
  // ở chỗ không liên quan gì tới quảng cáo.
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

  // Quy ước cũ nhưng còn dùng nhiều: trang đặt biến này trong một tệp quảng
  // cáo, rồi kiểm tra nó undefined để kết luận tệp đã bị chặn.
  provide("canRunAds", true);
  provide("canRunAdsTest", true);
  provide("isAdBlockActive", false);

  // AdSense đặt biến này thành 1 khi ô quảng cáo hiển thị được. Nhiều trang
  // đọc nó thay cho việc dò trực tiếp.
  provide("google_ad_status", 1);

  // FuckAdBlock và bản nhái BlockAdBlock là thư viện dò phổ biến nhất. Cả hai
  // có cùng hình dạng: đăng ký hai hàm gọi lại rồi chạy check().
  //
  // Bản giả này luôn gọi nhánh "không phát hiện". Chỉ ăn khi tệp thật bị chặn
  // hoặc chưa kịp nạp; tệp thật nạp được thì nó ghi đè lên đây, và lúc đó
  // surrogates/ mới là chỗ đỡ.
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

  // ===================== Chặn popunder =====================
  // Loại quảng cáo mở hẳn một tab mới ngay khi người dùng bấm vào bất cứ đâu
  // trên trang, kể cả chỗ không phải quảng cáo.
  //
  // Đo trên 1phim30.com: bấm vào một thẻ div bình thường thì mở ra 7 tab, đích
  // là 073m.com/afu.php và dy.thecabalante.shop, payload có "pt":"tabup".
  //
  // Điều kiện chặn gồm ba vế, phải đủ cả ba. Chặn window.open không điều kiện
  // là hỏng đăng nhập bằng Google, hỏng nút chia sẻ, hỏng cổng thanh toán:
  //
  //   1. Đang trong một cú bấm mà chỗ bấm KHÔNG phải liên kết. Bấm vào thẻ <a>
  //      là người dùng chủ ý mở, để yên.
  //   2. Không truyền tham số cửa sổ. Hộp thoại thật gần như luôn kèm
  //      "width=...,height=..."; popunder thì chỉ có mỗi "_blank".
  //   3. Đích nằm ở tên miền khác.
  //
  // Ngoài cú bấm thì không cần làm gì: Chrome đã tự chặn window.open không có
  // thao tác người dùng.

  let lastClick = 0;
  let clickOnLink = false;

  const noteClick = (event) => {
    lastClick = Date.now();
    const t = event && event.target;
    clickOnLink = !!(t && t.closest && t.closest("a[href], button, [role='button']"));
  };

  // Bắt ở pha capture để thấy trước mã của trang, và bắt cả pointerdown vì
  // nhiều bộ popunder nổ ngay từ đó chứ không chờ sự kiện click.
  for (const type of ["pointerdown", "mousedown", "click", "auxclick"]) {
    try {
      document.addEventListener(type, noteClick, true);
    } catch (e) {}
  }

  const shouldBlock = (url, features) => {
    if (!NS.enabled || NS.opts.popunder === false) return false;
    if (features && String(features).trim()) return false;
    if (Date.now() - lastClick > 1500) return false;
    if (clickOnLink) return false;

    if (!url) return true;
    try {
      const target = new URL(String(url), location.href);
      if (target.protocol !== "http:" && target.protocol !== "https:") return false;
      return !NS.sameSite(target.hostname);
    } catch (e) {
      return false;
    }
  };

  // Vá window.open của MỘT realm. Tách ra thành hàm riêng vì còn phải vá cho
  // cả realm của iframe, xem ghi chú ở dưới.
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

  // Vá window.open thôi là chưa đủ.
  //
  // Đo trên 1phim30.com: bộ ghi đặt trước mọi script của trang vẫn thấy 0 lần
  // gọi window.open, trong khi tab quảng cáo vẫn mở. Cách chúng né là tạo một
  // iframe rỗng rồi lấy window.open NGUYÊN BẢN từ realm của iframe đó —
  // iframe mới có bộ hàm dựng sẵn riêng, không dính bản vá của realm cha.
  //
  // Nên phải chặn ngay ở cửa: mỗi lần trang với tay tới contentWindow của một
  // iframe, vá realm đó trước khi trả về.
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
