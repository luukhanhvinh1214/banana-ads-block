// Lớp chặn thật phía Facebook.
//
// Menu ba chấm của bài quảng cáo KHÔNG có lựa chọn chặn nào: Facebook chỉ cho
// "Quan tâm", "Không quan tâm" và "Tại sao tôi thấy quảng cáo này". Chỗ duy
// nhất chặn được nằm ở Trung tâm tài khoản, mục "Nhà quảng cáo mà bạn đã từng
// xem quảng cáo", nút "Ẩn quảng cáo". Đó là cài đặt thật trên tài khoản, bỏ
// được bằng nút "Bỏ ẩn" ngay cạnh.
//
// File này chỉ chạy khi người dùng đang mở đúng trang đó và đã bật nút trong
// popup. Extension không tự mở tab: tự điều hướng trình duyệt sang trang cài
// đặt rồi bấm nút ở đó là việc người dùng không bảo làm.

(() => {
  const CS = window.__BAB_CS__;
  if (!CS || CS.fbhide) return;
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return;
  if (!/^\/ads\/advertisers/.test(location.pathname)) return;

  const HIDE = /^ẩn quảng cáo$/i;
  const DONE = /bạn đã ẩn quảng cáo của họ|you hid their ads/i;
  const HIDE_EN = /^hide ads$/i;

  // Giãn nhịp giữa hai lần bấm. Bấm liên tục thì Facebook coi là máy và chặn
  // luôn thao tác, hỏng đúng thứ đang cần làm.
  const GAP_MS = 2500;

  // Trần cho một lượt ghé trang. Danh sách nhà quảng cáo dài dần theo thời gian
  // dùng; làm hết trong một hơi thì trang treo và Facebook chặn thao tác.
  const PER_VISIT = 25;

  let running = false;
  const done = new Set();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const wanted = () => {
    const set = new Set();
    for (const p of CS.posters || []) {
      if (p && p.name) set.add(clean(p.name).toLowerCase());
    }
    return set;
  };

  // Tên nhà quảng cáo nằm ở thẻ lá đầu tiên của hàng; phần chữ còn lại là dòng
  // trạng thái "Bạn đã ẩn quảng cáo của họ".
  const rowName = (row) => {
    for (const el of row.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = clean(el.textContent);
      if (t) return t;
    }
    return '';
  };

  const hideButton = () => {
    for (const b of document.querySelectorAll('[role="button"]')) {
      const t = clean(b.innerText);
      if (HIDE.test(t) || HIDE_EN.test(t)) return b;
    }
    return null;
  };

  // Bảng chi tiết đổi nội dung chậm hơn cú bấm. Bấm "Ẩn quảng cáo" lúc bảng còn
  // hiện nhà quảng cáo trước là ẩn nhầm một bên vô can, mà đây là cài đặt thật
  // trên tài khoản người dùng. Đợi tiêu đề đúng tên rồi mới bấm.
  const panelReady = async (name) => {
    for (let i = 0; i < 12; i++) {
      for (const h of document.querySelectorAll('h2')) {
        if (clean(h.textContent).toLowerCase() === name) return true;
      }
      await wait(250);
    }
    return false;
  };

  const sweep = async () => {
    if (running || !CS.block) return;
    running = true;
    try {
      const names = wanted();
      if (!names.size) return;

      // Một hàng bấm mãi không mở được sẽ ăn hết hạn mức của cả lượt và chặn
      // đường những nhà quảng cáo phía sau, nên bỏ qua sau vài lần thử.
      const tries = new Map();

      for (let pass = 0; pass < PER_VISIT; pass++) {
        const row = [...document.querySelectorAll('[role="listitem"]')].find((r) => {
          if (DONE.test(r.innerText || '')) return false;
          const name = rowName(r).toLowerCase();
          if (!name || done.has(name) || !names.has(name)) return false;
          return (tries.get(name) || 0) < 2;
        });
        if (!row) break;

        const name = rowName(row).toLowerCase();
        tries.set(name, (tries.get(name) || 0) + 1);

        const open = row.querySelector('[role="button"]') || row;
        // Danh sách chỉ dựng phần đang nhìn thấy; hàng nằm ngoài tầm thì cú bấm
        // rơi vào một thẻ sắp bị thay.
        try {
          open.scrollIntoView({ block: 'center' });
        } catch (e) {}
        await wait(400);
        open.click();

        // Chỉ ghi "đã xong" khi thật sự bấm được. Ghi trước rồi hụt một nhịp là
        // nhà quảng cáo đó không bao giờ được thử lại nữa.
        if (!(await panelReady(name))) continue;
        const btn = hideButton();
        if (!btn) continue;
        btn.click();
        done.add(name);
        await wait(GAP_MS);
      }

      // Trả trang về danh sách, đừng để người dùng quay lại thấy một bảng chi
      // tiết tự mở ra mà họ không bấm.
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })
      );
    } finally {
      running = false;
    }
  };

  // Danh sách dựng sau khi trang tải xong và dài thêm khi người dùng cuộn, nên
  // chạy lại mỗi lần DOM đổi thay vì chỉ một lượt lúc vào trang.
  let timer = 0;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      sweep();
    }, 1500);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  CS.onChange(() => {
    if (CS.block) schedule();
  });

  CS.fbhide = { sweep };
})();
