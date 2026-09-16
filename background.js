// ===================== Service worker =====================
// Giữ trạng thái và làm trọng tài giữa popup, content script và bộ luật mạng.
//
// Service worker của MV3 bị tắt bất cứ lúc nào, nên mọi thứ cần sống lâu phải
// nằm trong chrome.storage. Thứ duy nhất giữ trong bộ nhớ là số đếm cho huy
// hiệu của từng tab — mất thì huy hiệu về 0, không hỏng gì.

const KEY_ENABLED = "bab_enabled";
const KEY_ALLOWLIST = "bab_allowlist";
const KEY_OPTS = "bab_opts";
const KEY_STATS = "bab_stats";

const DEFAULT_OPTS = {
  cosmetic: true,
  popup: true,
  video: true,
  banners: true,
  popunder: true,
  trackers: false,
};
const DEFAULT_STATS = { network: 0, cosmetic: 0, popup: 0, video: 0 };

// Dải id riêng cho luật động, tránh đụng dải của rules/*.json (1000 và 20000).
const ALLOW_RULE_BASE = 900000;

// tabId -> số lần chặn trong lần tải trang hiện tại.
const tabHits = new Map();

// ===== Đọc ghi trạng thái =====

const getState = async () => {
  const res = await chrome.storage.local.get([KEY_ENABLED, KEY_ALLOWLIST, KEY_OPTS, KEY_STATS]);
  return {
    enabled: res[KEY_ENABLED] !== false,
    allowlist: Array.isArray(res[KEY_ALLOWLIST]) ? res[KEY_ALLOWLIST] : [],
    opts: Object.assign({}, DEFAULT_OPTS, res[KEY_OPTS]),
    stats: Object.assign({}, DEFAULT_STATS, res[KEY_STATS]),
  };
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
};

// So khớp cả tên miền con: bỏ qua "vnexpress.net" thì "video.vnexpress.net"
// cũng phải được bỏ qua, nếu không người dùng phải thêm tay từng tên miền con.
const inAllowlist = (host, allowlist) => {
  if (!host) return false;
  for (const entry of allowlist) {
    if (host === entry || host.endsWith("." + entry)) return true;
  }
  return false;
};

// ===== Đồng bộ bộ luật mạng =====

const syncRulesets = async (state) => {
  const want = [];
  if (state.enabled) {
    want.push("ads");
    if (state.opts.trackers) want.push("trackers");
  }

  const current = await chrome.declarativeNetRequest.getEnabledRulesets();
  const enable = want.filter((id) => !current.includes(id));
  const disable = current.filter((id) => !want.includes(id));
  if (!enable.length && !disable.length) return;

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable,
  });
};

// Trang trong danh sách bỏ qua cần được tha ở CẢ tầng mạng, không chỉ ở content
// script — bằng không thì quảng cáo vẫn không tải được và trang vẫn thủng.
// allowAllRequests trên main_frame tha luôn mọi yêu cầu con của tài liệu đó.
const syncAllowRules = async (state) => {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = old
    .filter((r) => r.id >= ALLOW_RULE_BASE)
    .map((r) => r.id);

  const addRules = state.allowlist.map((host, i) => ({
    id: ALLOW_RULE_BASE + i,
    // Phải cao hơn priority 1 của các luật chặn, nếu không luật chặn thắng.
    priority: 1000,
    action: { type: "allowAllRequests" },
    condition: {
      requestDomains: [host],
      resourceTypes: ["main_frame", "sub_frame"],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
};

const syncAll = async () => {
  const state = await getState();
  await syncRulesets(state);
  await syncAllowRules(state);
  await broadcast(state);
  return state;
};

// ===== Báo trạng thái xuống các tab đang mở =====

const broadcast = async (state) => {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (e) {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    const active = state.enabled && !inAllowlist(hostOf(tab.url), state.allowlist);
    chrome.tabs
      .sendMessage(tab.id, { op: "active", active, opts: state.opts })
      .catch(() => {
        // Tab chưa nạp content script (trang chrome://, cửa hàng tiện ích).
      });
  }
};

// ===== Huy hiệu =====

const paintBadge = (tabId) => {
  const n = tabHits.get(tabId) || 0;
  const text = n === 0 ? "" : n > 999 ? "999+" : String(n);
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
};

chrome.action.setBadgeBackgroundColor({ color: "#e0a800" }).catch(() => {});

const addHits = (tabId, n) => {
  if (!tabId || !n) return;
  tabHits.set(tabId, (tabHits.get(tabId) || 0) + n);
  paintBadge(tabId);
};

const bumpStats = async (counts) => {
  const res = await chrome.storage.local.get([KEY_STATS]);
  const stats = Object.assign({}, DEFAULT_STATS, res[KEY_STATS]);
  for (const kind of Object.keys(counts)) {
    if (stats[kind] === undefined) continue;
    stats[kind] += counts[kind];
  }
  await chrome.storage.local.set({ [KEY_STATS]: stats });
};

// ===== Vòng đời =====

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([KEY_ENABLED, KEY_OPTS], (res) => {
    const patch = {};
    if (res[KEY_ENABLED] === undefined) patch[KEY_ENABLED] = true;
    if (res[KEY_OPTS] === undefined) patch[KEY_OPTS] = DEFAULT_OPTS;
    if (Object.keys(patch).length) chrome.storage.local.set(patch);
    syncAll();
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncAll();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  tabHits.delete(tabId);
  paintBadge(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHits.delete(tabId);
});

// Chỉ chạy khi extension được nạp ở dạng chưa đóng gói. Bản cài từ cửa hàng sẽ
// không có sự kiện này, khi đó huy hiệu chỉ đếm phần content script báo về.
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.request && info.request.tabId;
    if (tabId === undefined || tabId < 0) return;
    addHits(tabId, 1);
    bumpStats({ network: 1 });
  });
}

// ===== Thông điệp =====

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.op) return;

  // Trạng thái tính theo tên miền của TAB. Content script trong iframe quảng
  // cáo không tự biết nó đang nằm trên trang nào, chỗ duy nhất biết là đây.
  if (msg.op === "init") {
    const host = hostOf((sender.tab && sender.tab.url) || "");
    getState().then((state) => {
      sendResponse({
        active: state.enabled && !inAllowlist(host, state.allowlist),
        opts: state.opts,
        host,
      });
    });
    return true;
  }

  if (msg.op === "hit") {
    const tabId = sender.tab && sender.tab.id;
    let total = 0;
    for (const kind of Object.keys(msg.counts || {})) total += msg.counts[kind];
    addHits(tabId, total);
    bumpStats(msg.counts || {});
    return;
  }

  if (msg.op === "state") {
    Promise.all([getState(), chrome.tabs.query({ active: true, currentWindow: true })]).then(
      ([state, tabs]) => {
        const tab = tabs[0];
        const host = hostOf((tab && tab.url) || "");
        sendResponse({
          enabled: state.enabled,
          opts: state.opts,
          stats: state.stats,
          host,
          siteAllowed: inAllowlist(host, state.allowlist),
          tabHits: tab ? tabHits.get(tab.id) || 0 : 0,
        });
      }
    );
    return true;
  }

  if (msg.op === "setEnabled") {
    chrome.storage.local.set({ [KEY_ENABLED]: msg.value !== false }, () => {
      syncAll().then(() => sendResponse({ ok: true }));
    });
    return true;
  }

  if (msg.op === "setOpt") {
    getState().then((state) => {
      const opts = Object.assign({}, state.opts, { [msg.name]: msg.value !== false });
      chrome.storage.local.set({ [KEY_OPTS]: opts }, () => {
        syncAll().then(() => sendResponse({ ok: true, opts }));
      });
    });
    return true;
  }

  if (msg.op === "toggleSite") {
    getState().then((state) => {
      const host = msg.host;
      if (!host) {
        sendResponse({ ok: false });
        return;
      }
      const list = state.allowlist.filter((h) => h !== host);
      if (list.length === state.allowlist.length) list.push(host);
      chrome.storage.local.set({ [KEY_ALLOWLIST]: list }, () => {
        syncAll().then(() => sendResponse({ ok: true, siteAllowed: list.includes(host) }));
      });
    });
    return true;
  }

  if (msg.op === "resetStats") {
    chrome.storage.local.set({ [KEY_STATS]: DEFAULT_STATS }, () => {
      tabHits.clear();
      sendResponse({ ok: true, stats: DEFAULT_STATS });
    });
    return true;
  }
});
