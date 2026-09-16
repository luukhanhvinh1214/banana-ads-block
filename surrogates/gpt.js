// Bản thế thân cho Google Publisher Tag (gpt.js)
//
// Nhiều trang tin xếp cả việc dựng bố cục vào googletag.cmd. Chặn tệp thật mà
// không thế chỗ thì hàng đợi đó không ai chạy: chỗ để quảng cáo vẫn trống,
// nhưng phần nội dung lẽ ra hiện sau đó cũng đứng im luôn. Đó là kiểu "chặn
// quảng cáo làm vỡ trang" khó lần ra nhất.
//
// Bản này chạy hết hàng đợi và trả về các đối tượng rỗng đủ hình dạng để
// chuỗi gọi nối đuôi của GPT không ném lỗi.

(() => {
  if (window.googletag && window.googletag.apiReady) return;

  const noopFn = () => {};
  // Trả về chính nó để những chuỗi gọi kiểu .addService().setTargeting() chạy
  // được tới cuối mà không cần biết từng hàm làm gì.
  const chain = () => proxy;

  const proxy = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === Symbol.toPrimitive) return () => "";
        if (prop === "then") return undefined; // đừng để bị tưởng là Promise
        if (prop in target) return target[prop];
        return chain;
      },
      set() {
        return true;
      },
    }
  );

  const slots = [];

  const pubads = {
    addEventListener: chain,
    removeEventListener: chain,
    collapseEmptyDivs: noopFn,
    disableInitialLoad: noopFn,
    enableSingleRequest: noopFn,
    enableLazyLoad: noopFn,
    refresh: noopFn,
    clear: noopFn,
    setTargeting: chain,
    clearTargeting: chain,
    setRequestNonPersonalizedAds: chain,
    setPrivacySettings: chain,
    setCentering: noopFn,
    updateCorrelator: noopFn,
    getSlots: () => slots.slice(),
    isInitialLoadDisabled: () => false,
    display: noopFn,
  };

  const makeSlot = (path, sizes, div) => {
    const slot = {
      addService: () => slot,
      defineSizeMapping: () => slot,
      setTargeting: () => slot,
      clearTargeting: () => slot,
      setCollapseEmptyDiv: () => slot,
      setForceSafeFrame: () => slot,
      set: () => slot,
      get: () => null,
      getAdUnitPath: () => path || "",
      getSlotElementId: () => div || "",
      getDomId: () => div || "",
      getSizes: () => sizes || [],
      getTargeting: () => [],
      getTargetingKeys: () => [],
      getResponseInformation: () => null,
      getOutOfPage: () => false,
    };
    slots.push(slot);
    return slot;
  };

  const googletag = {
    apiReady: true,
    // pubadsReady để false: trang nào chờ cờ này mới gọi refresh() thì thôi
    // không gọi, đỡ được một vòng chờ vô ích.
    pubadsReady: true,
    cmd: [],
    defineSlot: (path, sizes, div) => makeSlot(path, sizes, div),
    defineOutOfPageSlot: (path, div) => makeSlot(path, [], div),
    defineUnit: (path, sizes, div) => makeSlot(path, sizes, div),
    destroySlots: () => {
      slots.length = 0;
      return true;
    },
    display: noopFn,
    enableServices: noopFn,
    disablePublisherConsole: noopFn,
    pubads: () => pubads,
    companionAds: () => proxy,
    content: () => proxy,
    sizeMapping: () => ({
      addSize: function () {
        return this;
      },
      build: () => [],
    }),
    setAdIframeTitle: noopFn,
    getVersion: () => "0",
    secureSignalProviders: [],
  };

  // Hàng đợi có thể đã đầy trước khi tệp này về. Sau khi chạy hết, thay push
  // bằng bản chạy ngay để những lệnh đến sau không nằm chờ mãi.
  const pending = (window.googletag && window.googletag.cmd) || [];

  googletag.cmd.push = function (fn) {
    if (typeof fn !== "function") return 1;
    try {
      fn();
    } catch (e) {}
    return 1;
  };

  window.googletag = googletag;

  for (const fn of pending) {
    try {
      if (typeof fn === "function") fn();
    } catch (e) {}
  }
})();
