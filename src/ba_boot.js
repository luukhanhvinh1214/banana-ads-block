// ===================== Khởi động MAIN world =====================
// Nhận trạng thái bật/tắt từ ISOLATED world và mở một cửa nhỏ cho Console.

(() => {
  const NS = window.__BAB__;
  if (!NS || window.BAB) return;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__bab !== true || d.from !== "cs") return;

    if (d.op === "enabled") {
      NS.enabled = d.data !== false;
      NS.log("trạng thái:", NS.enabled ? "bật" : "tắt");
    }
  });

  // Hỏi ngay, vì ISOLATED world có thể đã đọc xong storage trước khi file này
  // kịp gắn listener ở trên.
  NS.post("hello", null);

  window.BAB = {
    version: NS.VERSION,
    stats: () => ({ pruned: NS.pruned, enabled: NS.enabled }),
    hooked: () => NS.hooked.slice(),
    debug: (on) => {
      NS.debug = on !== false;
      return NS.debug;
    },
  };
})();
