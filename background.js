// Service worker: giữ trạng thái và làm trọng tài giữa popup, content script và
// bộ luật mạng.
//
// Service worker MV3 bị tắt bất cứ lúc nào nên mọi thứ cần sống lâu phải nằm
// trong chrome.storage. Chỉ số đếm huy hiệu của từng tab giữ trong bộ nhớ.

const KEY_ENABLED = "bab_enabled";
const KEY_ALLOWLIST = "bab_allowlist";
const KEY_OPTS = "bab_opts";
const KEY_STATS = "bab_stats";
const KEY_BLOCK = "bab_block";
const KEY_POSTERS = "bab_posters";

// Hai trang có nhãn tài trợ riêng và có tên nhà quảng cáo đọc được, nên chặn
// theo tài khoản mới làm được ở đây. Trang khác không có gì để bám.
const SITES = {
  facebook: /(^|\.)facebook\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
};

const POSTER_MAX = 500;

const siteOf = (host) => {
  if (!host) return "";
  for (const name of Object.keys(SITES)) {
    if (SITES[name].test(host)) return name;
  }
  return "";
};

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

const asMap = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

const getState = async () => {
  const res = await chrome.storage.local.get([
    KEY_ENABLED, KEY_ALLOWLIST, KEY_OPTS, KEY_STATS, KEY_BLOCK, KEY_POSTERS,
  ]);
  return {
    enabled: res[KEY_ENABLED] !== false,
    allowlist: Array.isArray(res[KEY_ALLOWLIST]) ? res[KEY_ALLOWLIST] : [],
    opts: Object.assign({}, DEFAULT_OPTS, res[KEY_OPTS]),
    stats: Object.assign({}, DEFAULT_STATS, res[KEY_STATS]),
    block: asMap(res[KEY_BLOCK]),
    posters: asMap(res[KEY_POSTERS]),
  };
};

const postersOf = (state, site) =>
  site && Array.isArray(state.posters[site]) ? state.posters[site] : [];

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
};

// Khớp cả tên miền con: bỏ qua "example.com" thì "video.example.com" cũng phải
// được bỏ qua.
const inAllowlist = (host, allowlist) => {
  if (!host) return false;
  for (const entry of allowlist) {
    if (host === entry || host.endsWith("." + entry)) return true;
  }
  return false;
};

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

// Trang trong danh sách bỏ qua phải được tha ở CẢ tầng mạng, không chỉ ở content
// script, bằng không quảng cáo vẫn không tải được và trang vẫn thủng.
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

const broadcast = async (state) => {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (e) {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    const host = hostOf(tab.url);
    const active = state.enabled && !inAllowlist(host, state.allowlist);
    const site = siteOf(host);
    chrome.tabs
      .sendMessage(tab.id, {
        op: "active",
        active,
        opts: state.opts,
        site,
        block: !!state.block[site],
        posters: postersOf(state, site),
      })
      .catch(() => {
        // Tab chưa nạp content script (trang chrome://, cửa hàng tiện ích).
      });
  }
};

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

// Chỉ có khi extension nạp ở dạng chưa đóng gói. Bản cài từ cửa hàng không có
// sự kiện này, huy hiệu khi đó chỉ đếm phần content script báo về.
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.request && info.request.tabId;
    if (tabId === undefined || tabId < 0) return;
    addHits(tabId, 1);
    bumpStats({ network: 1 });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.op) return;

  // Trạng thái tính theo tên miền của TAB. Content script trong iframe quảng
  // cáo không tự biết nó đang nằm trên trang nào, chỗ duy nhất biết là đây.
  if (msg.op === "init") {
    const host = hostOf((sender.tab && sender.tab.url) || "");
    // Trang mang nhãn tài trợ tính theo khung GỬI, không theo tab: iframe quảng
    // cáo nhúng trong facebook.com không phải Facebook.
    const site = siteOf(hostOf(sender.url || ""));
    getState().then((state) => {
      sendResponse({
        active: state.enabled && !inAllowlist(host, state.allowlist),
        opts: state.opts,
        host,
        site,
        block: !!state.block[site],
        posters: postersOf(state, site),
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
        const site = siteOf(host);
        sendResponse({
          enabled: state.enabled,
          opts: state.opts,
          stats: state.stats,
          host,
          siteAllowed: inAllowlist(host, state.allowlist),
          tabHits: tab ? tabHits.get(tab.id) || 0 : 0,
          site,
          block: !!state.block[site],
          posters: postersOf(state, site),
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

  if (msg.op === "setBlock") {
    const site = msg.site;
    if (!SITES[site]) return;
    getState().then((state) => {
      const block = Object.assign({}, state.block, { [site]: msg.value !== false });
      chrome.storage.local.set({ [KEY_BLOCK]: block }, () => {
        syncAll().then(() => sendResponse({ ok: true, block: block[site] }));
      });
    });
    return true;
  }

  // Tên nhà quảng cáo do content script gửi lên. Trang gửi tính theo khung gửi,
  // không lấy theo lời khai trong thông điệp.
  if (msg.op === "addPoster") {
    const site = siteOf(hostOf(sender.url || ""));
    const id = String(msg.id || "").slice(0, 120);
    if (!site || !id) return;
    getState().then((state) => {
      if (!state.block[site]) return;
      const list = postersOf(state, site);
      const key = id.toLowerCase();
      if (list.some((p) => String(p.id).toLowerCase() === key)) return;
      const next = list.concat([{ id, name: String(msg.name || id).slice(0, 120) }]);
      // Bỏ mục cũ nhất khi đầy. Danh sách chỉ lớn lên nên phải có trần.
      const posters = Object.assign({}, state.posters, {
        [site]: next.slice(Math.max(0, next.length - POSTER_MAX)),
      });
      chrome.storage.local.set({ [KEY_POSTERS]: posters }, () => {
        getState().then(broadcast);
      });
    });
    return;
  }

  if (msg.op === "clearPosters") {
    const site = msg.site;
    if (!SITES[site]) return;
    getState().then((state) => {
      const posters = Object.assign({}, state.posters, { [site]: [] });
      chrome.storage.local.set({ [KEY_POSTERS]: posters }, () => {
        syncAll().then(() => sendResponse({ ok: true, posters: [] }));
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
