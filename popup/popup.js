// Popup không đụng thẳng vào chrome.storage hay bộ luật mạng. Mọi thay đổi đi
// qua service worker, vì bật/tắt một lớp còn kéo theo việc đổi bộ luật đang
// hiệu lực và báo xuống các tab đang mở — gom một chỗ thì không lệch trạng thái.

const send = (msg) =>
  new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        void chrome.runtime.lastError;
        resolve(res || null);
      });
    } catch (e) {
      resolve(null);
    }
  });

const $ = (id) => document.getElementById(id);

const powerWrap = $("power");
const powerBtn = $("power-toggle");
const powerState = $("power-state");
const siteWrap = $("site");
const siteHost = $("site-host");
const siteBtn = $("site-toggle");
const blockWrap = $("block");
const blockBtn = $("block-toggle");
const blockState = $("block-state");
const blockCount = $("block-count");
const blockClear = $("block-clear");

const OPTS = ["cosmetic", "banners", "popup", "popunder", "video", "trackers"];

const SITE_NAMES = { facebook: "Facebook", tiktok: "TikTok" };

let host = "";
let siteAllowed = false;
let site = "";
let blockOn = false;
let posters = [];

const renderPower = (on) => {
  powerBtn.setAttribute("aria-checked", on ? "true" : "false");
  powerWrap.classList.toggle("off", !on);
  powerState.textContent = on
    ? "Đang bật — quảng cáo bị chặn trên mọi trang, trừ những trang bạn đã bỏ qua"
    : "Đã tắt — mọi lớp chặn ngừng hoạt động, trang hiển thị như khi không có tiện ích";
};

const renderSite = () => {
  siteHost.textContent = host || "không áp dụng cho trang này";
  siteBtn.disabled = !host;
  siteWrap.classList.toggle("allowed", siteAllowed);
  siteBtn.textContent = siteAllowed ? "Bật lại cho trang này" : "Bỏ qua trang này";
};

// Nút này chỉ có nghĩa ở nơi đọc được tên nhà quảng cáo, nên trang khác thì
// giấu hẳn thay vì hiện ra rồi khoá lại.
const renderBlock = () => {
  blockWrap.hidden = !site;
  if (!site) return;
  const where = SITE_NAMES[site] || site;
  blockWrap.classList.toggle("on", blockOn);
  blockBtn.setAttribute("aria-checked", blockOn ? "true" : "false");
  blockState.textContent = blockOn
    ? "Thấy ai đăng quảng cáo trên " + where + " là ẩn luôn mọi bài sau của họ"
    : "Đang tắt — chỉ ẩn bài quảng cáo, không đụng tới người đăng";
  blockCount.textContent = posters.length
    ? "Đã chặn " + posters.length + " tài khoản"
    : "Chưa chặn ai";
  blockClear.hidden = !posters.length;
};

const load = async () => {
  const state = await send({ op: "state" });
  if (!state) return;
  host = state.host || "";
  siteAllowed = !!state.siteAllowed;
  site = state.site || "";
  blockOn = !!state.block;
  posters = Array.isArray(state.posters) ? state.posters : [];
  renderPower(state.enabled);
  renderSite();
  renderBlock();
  for (const name of OPTS) {
    $("opt-" + name).checked = state.opts[name] !== false;
  }
  // Tắt toàn bộ thì các ô chọn lớp không còn ý nghĩa.
  for (const name of OPTS) {
    $("opt-" + name).disabled = !state.enabled;
  }
};

powerBtn.addEventListener("click", async () => {
  const next = powerBtn.getAttribute("aria-checked") !== "true";
  renderPower(next);
  await send({ op: "setEnabled", value: next });
  load();
});

siteBtn.addEventListener("click", async () => {
  if (!host) return;
  const res = await send({ op: "toggleSite", host });
  if (!res || !res.ok) return;
  siteAllowed = res.siteAllowed;
  renderSite();
});

blockBtn.addEventListener("click", async () => {
  if (!site) return;
  blockOn = !blockOn;
  renderBlock();
  await send({ op: "setBlock", site, value: blockOn });
  load();
});

blockClear.addEventListener("click", async () => {
  if (!site) return;
  const res = await send({ op: "clearPosters", site });
  if (!res || !res.ok) return;
  posters = [];
  renderBlock();
});

for (const name of OPTS) {
  $("opt-" + name).addEventListener("change", (event) => {
    send({ op: "setOpt", name, value: event.target.checked });
  });
}

load();
