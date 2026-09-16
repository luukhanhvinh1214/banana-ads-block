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

const OPTS = ["cosmetic", "banners", "popup", "popunder", "video", "trackers"];

let host = "";
let siteAllowed = false;

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

const renderStats = (stats, tabHits) => {
  $("stat-network").textContent = stats.network || 0;
  $("stat-cosmetic").textContent = stats.cosmetic || 0;
  $("stat-popup").textContent = stats.popup || 0;
  $("stat-video").textContent = stats.video || 0;
  $("tab-hits").textContent = "Tab này: " + (tabHits || 0);
};

const load = async () => {
  const state = await send({ op: "state" });
  if (!state) return;
  host = state.host || "";
  siteAllowed = !!state.siteAllowed;
  renderPower(state.enabled);
  renderSite();
  renderStats(state.stats || {}, state.tabHits);
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

for (const name of OPTS) {
  $("opt-" + name).addEventListener("change", (event) => {
    send({ op: "setOpt", name, value: event.target.checked });
  });
}

$("reset-stats").addEventListener("click", async () => {
  const res = await send({ op: "resetStats" });
  if (res && res.ok) renderStats(res.stats, 0);
});

load();
