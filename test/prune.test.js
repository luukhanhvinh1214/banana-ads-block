// Smoke test cho lớp cắt dữ liệu quảng cáo:
//
//   node test/prune.test.js
//
// Lớp này là thứ duy nhất diệt được quảng cáo chèn giữa video, và cũng là thứ
// hỏng lặng lẽ nhất: cắt hụt thì quảng cáo quay lại, cắt quá tay thì trình phát
// đứng ở vòng quay chờ mà không báo lỗi gì. Cả hai đều chỉ lộ ra khi mở
// YouTube lên xem, nên cần kiểm ở đây trước.
//
// Chạy src/ba_core.js và src/ba_prune.js trong một vm context riêng: context đó
// có JSON, Proxy, Reflect của chính nó, nên việc hook JSON.parse không đụng tới
// JSON.parse của tiến trình test.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

let failed = 0;

const check = (name, cond) => {
  console.log((cond ? "ok   " : "FAIL ") + name);
  if (!cond) failed++;
};

const same = (name, actual, expected) =>
  check(name + " (= " + JSON.stringify(expected) + ")", actual === expected);

// ===== Dựng môi trường =====

const makeContext = () => {
  const ctx = vm.createContext({ console });
  vm.runInContext("var window = globalThis;", ctx);
  for (const file of ["src/ba_core.js", "src/ba_prune.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  return ctx;
};

const run = (ctx, code) => vm.runInContext(code, ctx);

// ===== Dữ liệu mẫu =====

const playerResponse = {
  adPlacements: [{ adPlacementRenderer: {} }],
  playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
  adSlots: [{ adSlotRenderer: {} }],
  adBreakHeartbeatParams: "xyz",
  streamingData: { formats: [{ itag: 18 }] },
  videoDetails: { videoId: "abc", title: "Bài hát" },
};

const feed = {
  contents: {
    items: [
      { richItemRenderer: { content: { videoRenderer: { videoId: "one" } } } },
      { adSlotRenderer: { adSlotMetadata: {} } },
      { richItemRenderer: { content: { videoRenderer: { videoId: "two" } } } },
      { promotedVideoRenderer: { videoId: "ad" } },
    ],
  },
};

// ===== 1. Cắt lịch quảng cáo trong phản hồi trình phát =====
{
  const ctx = makeContext();
  ctx.raw = JSON.stringify(playerResponse);
  const out = run(ctx, "JSON.parse(globalThis.raw)");

  check("player: xoá adPlacements", out.adPlacements === undefined);
  check("player: xoá playerAds", out.playerAds === undefined);
  check("player: xoá adSlots", out.adSlots === undefined);
  check("player: xoá adBreakHeartbeatParams", out.adBreakHeartbeatParams === undefined);
  check("player: giữ streamingData", !!out.streamingData && out.streamingData.formats.length === 1);
  same("player: giữ videoDetails.title", out.videoDetails.title, "Bài hát");
  same("player: đếm đúng 4 nhánh", run(ctx, "window.__BAB__.pruned"), 4);
}

// ===== 2. Phản hồi lồng { playerResponse: {...} } =====
{
  const ctx = makeContext();
  ctx.raw = JSON.stringify({ playerResponse });
  const out = run(ctx, "JSON.parse(globalThis.raw)");
  check("lồng: xoá adPlacements bên trong", out.playerResponse.adPlacements === undefined);
  check("lồng: giữ streamingData bên trong", !!out.playerResponse.streamingData);
}

// ===== 3. Gỡ thẻ quảng cáo khỏi danh sách gợi ý =====
{
  const ctx = makeContext();
  ctx.raw = JSON.stringify(feed);
  const out = run(ctx, "JSON.parse(globalThis.raw)");
  const items = out.contents.items;

  same("feed: còn 2 mục", items.length, 2);
  check("feed: giữ đúng video thật", items.every((i) => i.richItemRenderer));
  same("feed: video đầu", items[0].richItemRenderer.content.videoRenderer.videoId, "one");
  same("feed: video sau", items[1].richItemRenderer.content.videoRenderer.videoId, "two");
  same("feed: đếm đúng 2 thẻ", run(ctx, "window.__BAB__.pruned"), 2);
}

// ===== 4. Dữ liệu bình thường không bị đụng tới =====
{
  const ctx = makeContext();
  const clean = {
    contents: { items: [{ richItemRenderer: { content: {} } }] },
    responseContext: { visitorData: "abc" },
    text: "quảng cáo trên truyền hình",
  };
  ctx.raw = JSON.stringify(clean);
  const out = run(ctx, "JSON.parse(globalThis.raw)");

  check("sạch: giữ nguyên toàn bộ", JSON.stringify(out) === JSON.stringify(clean));
  same("sạch: không đếm nhầm", run(ctx, "window.__BAB__.pruned"), 0);
}

// ===== 5. JSON.parse vẫn là JSON.parse =====
{
  const ctx = makeContext();
  same("parse: số", run(ctx, 'JSON.parse("42")'), 42);
  same("parse: null", run(ctx, 'JSON.parse("null")'), null);
  same("parse: chuỗi", run(ctx, 'JSON.parse(\'"xin chào"\')'), "xin chào");
  same(
    "parse: reviver vẫn chạy",
    run(ctx, 'JSON.parse(\'{"a":1}\', (k, v) => (typeof v === "number" ? v + 1 : v)).a'),
    2
  );
  check(
    "parse: ném lỗi khi cú pháp sai",
    run(ctx, '(() => { try { JSON.parse("{"); return false; } catch (e) { return true; } })()')
  );
  // Proxy phải che được dấu vết, nếu không mã dò của trang nhận ra ngay.
  check(
    "parse: toString vẫn báo native code",
    /\[native code\]/.test(run(ctx, "JSON.parse.toString()"))
  );
}

// ===== 6. Bắt dữ liệu nhúng thẳng trong HTML =====
{
  const ctx = makeContext();
  check(
    "setter: đã hook ytInitialPlayerResponse",
    run(ctx, 'window.__BAB__.hooked.includes("ytInitialPlayerResponse")')
  );

  ctx.payload = JSON.parse(JSON.stringify(playerResponse));
  run(ctx, "window.ytInitialPlayerResponse = globalThis.payload;");
  const out = run(ctx, "window.ytInitialPlayerResponse");
  check("setter: xoá adPlacements", out.adPlacements === undefined);
  check("setter: giữ streamingData", !!out.streamingData);

  ctx.feedPayload = JSON.parse(JSON.stringify(feed));
  run(ctx, "window.ytInitialData = globalThis.feedPayload;");
  same("setter: ytInitialData còn 2 mục", run(ctx, "window.ytInitialData.contents.items.length"), 2);
}

// ===== 7. Vòng lặp trong dữ liệu không được treo =====
{
  const ctx = makeContext();
  run(
    ctx,
    "globalThis.cyc = { contents: { items: [{ adSlotRenderer: {} }] } }; globalThis.cyc.self = globalThis.cyc;"
  );
  run(ctx, "window.ytInitialData = globalThis.cyc;");
  same("vòng lặp: vẫn gỡ được thẻ quảng cáo", run(ctx, "window.ytInitialData.contents.items.length"), 0);
}

// ===== 8. Tắt tiện ích thì không đụng vào gì =====
{
  const ctx = makeContext();
  run(ctx, "window.__BAB__.enabled = false;");
  ctx.raw = JSON.stringify(playerResponse);
  const out = run(ctx, "JSON.parse(globalThis.raw)");
  check("tắt: giữ nguyên adPlacements", Array.isArray(out.adPlacements));
  same("tắt: không đếm", run(ctx, "window.__BAB__.pruned"), 0);
}

console.log(failed ? `\n${failed} test hỏng` : "\nTất cả test đều qua");
process.exit(failed ? 1 : 0);
