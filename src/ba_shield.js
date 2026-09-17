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

  const NEW_TAB = /^_(blank|new)$/i;

  // Chrome cho phép mở cửa sổ trong khoảng 5 giây kể từ một thao tác thật. Hẹp
  // hơn con số đó là chừa sẵn một khe cho bộ popunder chỉ cần chờ thêm một nhịp.
  const GESTURE_MS = 5000;

  let lastClick = 0;
  let clickedLinkHost = "";
  let armed = null;

  const linkOf = (node) => (node && node.closest ? node.closest("a[href]") : null);

  const hostOf = (url) => {
    if (!url) return "";
    try {
      const u = new URL(String(url), location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.hostname;
    } catch (e) {
      return "";
    }
  };

  // Đích đến mà người dùng không hề bảo mở.
  const foreign = (url) => {
    const host = hostOf(url);
    if (!host || NS.sameSite(host)) return false;
    return !TRUSTED.some((h) => host === h || host.endsWith("." + h));
  };

  // Như trên, nhưng tha cho đúng chỗ người dùng vừa bấm vào: bấm một liên kết
  // rồi thấy nó mở ra thì đó là ý của họ, không phải popunder.
  const unwanted = (url) => {
    const host = hostOf(url);
    if (host && clickedLinkHost && NS.sameSite(host, clickedLinkHost)) return false;
    return foreign(url);
  };

  const noteBlocked = (url) => {
    NS.popBlocked++;
    NS.post("popunder", 1);
    NS.log("chặn popunder:", String(url).slice(0, 120));
  };

  const guarding = () => NS.enabled && NS.opts.popunder !== false;

  // Chặn window.open không điều kiện là hỏng đăng nhập bằng Google, hỏng nút
  // chia sẻ, hỏng cổng thanh toán. Nên phải có đường cho những thứ đó đi.
  //
  // Miễn trừ theo LOẠI phần tử vừa bấm thì không dùng được: popunder phổ biến
  // nhất hiện nay gắn một handler lên mọi phần tử của trang, và giao diện trình
  // phát video thì gần như toàn là <button>. Chỉ còn ĐÍCH ĐẾN để phân biệt.
  const shouldBlock = (url, features) => {
    if (!guarding()) return false;
    // Cửa sổ khai báo kích thước là cửa sổ trang cố ý dựng cho người dùng nhìn.
    if (features && String(features).trim()) return false;
    if (Date.now() - lastClick > GESTURE_MS) return false;
    if (!url) return true;
    return unwanted(url);
  };

  // Một thẻ <a target="_blank"> bị mã bấm hộ. Người dùng không mở tab bằng
  // đường này bao giờ, nên chỉ cần đích đến lạ là đủ để chặn.
  const scriptedLinkPop = (el) => {
    if (!guarding()) return null;
    const a = linkOf(el);
    if (!a || a.hasAttribute("download")) return null;
    if (!NEW_TAB.test(a.target || "")) return null;
    return unwanted(a.href) ? a : null;
  };

  const scriptedFormPop = (form) => {
    if (!guarding() || !form) return null;
    if (!NEW_TAB.test(form.target || "")) return null;
    return unwanted(form.action) ? form : null;
  };

  // Tấm bắt click: một thẻ <a target="_blank"> trong suốt phủ gần kín màn hình,
  // bấm chỗ nào cũng trúng. Nhận bằng hình dạng, vì nó không có gì khác để nhận:
  // to bằng màn hình, nổi lên trên, rỗng ruột.
  const isClickCatcher = (a) => {
    if (!a || !NEW_TAB.test(a.target || "") || !foreign(a.href)) return false;
    let style;
    try {
      style = getComputedStyle(a);
    } catch (e) {
      return false;
    }
    if (style.position !== "fixed" && style.position !== "absolute") return false;
    const rect = a.getBoundingClientRect();
    if (rect.width < innerWidth * 0.6 || rect.height < innerHeight * 0.6) return false;
    if ((a.innerText || "").trim()) return false;
    return !a.querySelector("img, picture, video, svg, canvas");
  };

  // Kiểu popunder thứ ba: nghe pointerdown rồi viết lại href của một liên kết
  // thật, để chính cú bấm của người dùng mở sang trang quảng cáo. Chụp lại địa
  // chỉ lúc đặt tay xuống, trả lại lúc nhả ra nếu nó đã bị đánh tráo.
  const arm = (a) => {
    armed = a ? { a, href: a.getAttribute("href"), target: a.getAttribute("target") } : null;
  };

  const restore = (a) => {
    const snap = armed;
    armed = null;
    if (!snap || !a || snap.a !== a || !guarding()) return;
    if (a.getAttribute("href") === snap.href) return;
    // Trang tự đổi liên kết NỘI BỘ để đo lượt bấm là chuyện bình thường.
    if (!foreign(a.href)) return;
    noteBlocked(a.href);
    if (snap.href === null) a.removeAttribute("href");
    else a.setAttribute("href", snap.href);
    if (snap.target === null) a.removeAttribute("target");
    else a.setAttribute("target", snap.target);
  };

  // Pha capture để thấy trước mã của trang, và bắt cả pointerdown vì nhiều bộ
  // popunder nổ ngay từ đó chứ không chờ click.
  const onActivation = (event) => {
    // Sự kiện do mã trang tự bắn ra không phải thao tác của người dùng, và tin
    // vào nó là mở đường cho popunder tự cấp phép cho mình.
    if (!event || event.isTrusted === false) return;
    const a = linkOf(event.target);

    if (event.type === "click" || event.type === "auxclick") {
      restore(a);
      if (isClickCatcher(a)) {
        event.preventDefault();
        noteBlocked(a.href);
      }
    } else {
      arm(a);
    }

    lastClick = Date.now();
    clickedLinkHost = a ? hostOf(a.href) : "";
  };

  for (const type of ["pointerdown", "mousedown", "click", "auxclick"]) {
    try {
      document.addEventListener(type, onActivation, true);
    } catch (e) {}
  }

  // Proxy chứ không phải hàm bọc: Proxy của một hàm vẫn trả "[native code]" khi
  // bị toString, nên mã dò của trang không thấy chỗ nào đã bị thay.
  const wrap = (target, apply) => new Proxy(target, { apply });

  // Vá window.open là chưa đủ. Bộ popunder nào cũng có đường lui: dựng một thẻ
  // <a target="_blank"> rồi tự bấm vào nó, bắn một sự kiện click giả, hoặc gửi
  // một <form target="_blank">. Không đường nào đi qua window.open.
  const hardenActivation = (win) => {
    const El = win.HTMLElement;
    if (El && El.prototype && typeof El.prototype.click === "function") {
      El.prototype.click = wrap(El.prototype.click, (target, thisArg, args) => {
        const a = scriptedLinkPop(thisArg);
        if (!a) return Reflect.apply(target, thisArg, args);
        noteBlocked(a.href);
      });
    }

    const ET = win.EventTarget;
    if (ET && ET.prototype && typeof ET.prototype.dispatchEvent === "function") {
      ET.prototype.dispatchEvent = wrap(ET.prototype.dispatchEvent, (target, thisArg, args) => {
        const type = args[0] && args[0].type;
        if (type === "click" || type === "auxclick") {
          const a = scriptedLinkPop(thisArg);
          if (a) {
            noteBlocked(a.href);
            return false;
          }
        }
        return Reflect.apply(target, thisArg, args);
      });
    }

    const Form = win.HTMLFormElement;
    if (!Form || !Form.prototype) return;
    for (const name of ["submit", "requestSubmit"]) {
      if (typeof Form.prototype[name] !== "function") continue;
      Form.prototype[name] = wrap(Form.prototype[name], (target, thisArg, args) => {
        const f = scriptedFormPop(thisArg);
        if (!f) return Reflect.apply(target, thisArg, args);
        noteBlocked(f.action);
      });
    }
  };

  const harden = (win) => {
    if (!win) return;
    try {
      if (win.__babHardened) return;
      if (typeof win.open !== "function") return;
      win.__babHardened = true;
      win.open = wrap(win.open, (target, thisArg, args) => {
        if (!shouldBlock(args[0], args[2])) return Reflect.apply(target, thisArg, args);
        noteBlocked(args[0]);
        return null;
      });
      hardenActivation(win);
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
