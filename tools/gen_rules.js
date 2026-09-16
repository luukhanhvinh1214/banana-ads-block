// Sinh rules/*.json từ rules/*.txt. Chạy tay sau mỗi lần sửa danh sách:
//
//   node tools/gen_rules.js
//
// Không có bước build khi cài extension — file JSON được commit sẵn. Script
// này chỉ tồn tại để danh sách tên miền còn đọc và sửa được như văn bản thường.

const fs = require("fs");
const path = require("path");

const RULES_DIR = path.join(__dirname, "..", "rules");

// Dải id riêng cho từng bộ. declarativeNetRequest chỉ đòi id duy nhất trong
// cùng một ruleset, nhưng tách dải ra thì log "rule 1042 đã chặn" còn chỉ được
// về đúng file nguồn.
const SETS = [
  { name: "ads", idBase: 1000 },
  { name: "trackers", idBase: 20000 },
];

const parse = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

let failed = false;

for (const set of SETS) {
  const src = path.join(RULES_DIR, `${set.name}.txt`);
  const out = path.join(RULES_DIR, `${set.name}.json`);
  const filters = parse(fs.readFileSync(src, "utf8"));

  const seen = new Set();
  const rules = [];

  for (const urlFilter of filters) {
    if (seen.has(urlFilter)) {
      console.error(`${set.name}.txt: trùng "${urlFilter}"`);
      failed = true;
      continue;
    }
    seen.add(urlFilter);

    // Bỏ trống resourceTypes là cố ý: mặc định của Chrome khi ấy là "mọi loại
    // trừ main_frame". Thêm main_frame vào sẽ biến việc bấm nhầm một đường dẫn
    // quảng cáo thành trang lỗi thay vì chỉ là một yêu cầu bị bỏ qua.
    rules.push({
      id: set.idBase + rules.length,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter },
    });
  }

  fs.writeFileSync(out, JSON.stringify(rules, null, 2) + "\n");
  console.log(`${set.name}.json: ${rules.length} luật`);
}

process.exit(failed ? 1 : 0);
