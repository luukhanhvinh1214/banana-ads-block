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

  NS.log("khiên đã đặt:", NS.shielded.join(", "));
})();
