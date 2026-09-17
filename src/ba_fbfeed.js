// Lớp 6: đọc dữ liệu feed Facebook để biết bài nào là quảng cáo TRƯỚC khi nó
// được vẽ.
//
// Vì sao phải làm ở đây thay vì đọc DOM: Facebook vẽ chữ "Được tài trợ" từ một
// shadow DOM đóng, textContent không thấy. Bản sao đọc được nằm trong một span
// ẩn cuối body, và bài chỉ trỏ tới nó qua aria-labelledby. Đo trên feed thật:
// lúc bài đã hiện trên màn hình, con trỏ đó còn treo, trỏ tới id chưa tồn tại.
// Mọi cách nhận quảng cáo bằng DOM đều chậm hơn mắt người vì lý do đó.
//
// Feed về qua XHR tới /api/graphql/. Mỗi bài quảng cáo mang một nhánh
// "__typename":"SponsoredData". Tên khoá quanh nó bị xáo và đổi luôn, nhưng
// chính tên kiểu này thì mã của Facebook cần nên nó ở lại.

(() => {
  const NS = window.__BAB__;
  if (!NS || NS.fbfeed) return;
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return;

  const MARK = '"__typename":"SponsoredData"';

  // Cửa sổ cắt sau mỗi dấu. Nhà quảng cáo nằm sau dấu vài nghìn ký tự; lấy
  // rộng quá thì vớ sang bài kế tiếp và gán nhầm tên cho một trang vô can.
  const AHEAD = 12000;

  // Đòi đúng hình dạng nút tác giả mà Relay sinh ra: tên đi liền sau kiểu, rồi
  // tới id, đôi khi có "short_name" chen giữa. Bắt "name" rời rạc thì dễ vớ
  // phải tên trong bình luận hay bài kế bên, mà gán nhầm một lần là ẩn sạch mọi
  // bài của một trang vô can. [^}] chặn không cho vắt sang đối tượng khác.
  // Không khớp thì bỏ qua: bốn lớp còn lại vẫn có cơ hội bắt bài này.
  const ACTOR =
    /"__typename":"(?:User|Page)","name":"([^"]{1,80})"[^}]{0,200}?"id":"(\d{5,})"/;

  // Trần cho một phản hồi. Feed trả về vài chục bài một lượt; gặp phản hồi lạ
  // dài bất thường thì dừng sớm còn hơn treo luồng chính.
  const MAX_ADS = 40;

  const seen = new Set();

  const unescapeJson = (s) => {
    try {
      return JSON.parse('"' + s + '"');
    } catch (e) {
      return s;
    }
  };

  const harvest = (text) => {
    if (!text || text.indexOf(MARK) === -1) return;

    const found = [];
    let at = text.indexOf(MARK);
    let n = 0;

    while (at !== -1 && n++ < MAX_ADS) {
      const m = ACTOR.exec(text.slice(at, at + AHEAD));
      if (m) {
        const who = { id: m[2], name: unescapeJson(m[1]) };
        const key = who.id + '|' + who.name;
        if (!seen.has(key)) {
          seen.add(key);
          found.push(who);
        }
      }
      at = text.indexOf(MARK, at + MARK.length);
    }

    if (found.length) NS.post('fbads', found);
  };

  // Chỉ đọc, không sửa phản hồi. Cắt bớt một nhánh trong gói tin sẽ làm hỏng
  // con trỏ phân trang của Relay và feed đứng hẳn.
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      if (/\/api\/graphql/.test(String(url))) {
        this.addEventListener('load', () => {
          try {
            harvest(this.responseText);
          } catch (e) {}
        });
      }
    } catch (e) {}
    return open.call(this, method, url, ...rest);
  };

  const fetch0 = window.fetch;
  if (typeof fetch0 === 'function') {
    window.fetch = function (...args) {
      const out = fetch0.apply(this, args);
      try {
        const url = String((args[0] && args[0].url) || args[0] || '');
        if (/\/api\/graphql/.test(url)) {
          out
            .then((res) => {
              res
                .clone()
                .text()
                .then(harvest)
                .catch(() => {});
            })
            .catch(() => {});
        }
      } catch (e) {}
      return out;
    };
  }

  NS.fbfeed = { harvest };
})();
