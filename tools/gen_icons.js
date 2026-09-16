// Sinh icons/icon*.png. Chạy tay khi đổi hình:
//
//   node tools/gen_icons.js
//
// Vẽ bằng công thức thay vì kèm sẵn file ảnh, để hình còn sửa được và không
// phải commit một khối nhị phân không ai đọc nổi. Chỉ dùng zlib có sẵn của
// Node, không thư viện ngoài.
//
// Hình: nền vàng bo góc, quả chuối màu nâu ở giữa, một vạch đỏ chéo qua.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZES = [16, 24, 32, 48, 128];
const SS = 4; // lấy mẫu gấp 4 rồi thu nhỏ, để mép không răng cưa

const BG = [240, 196, 25];
const PEEL = [255, 226, 122];
const FRUIT = [92, 64, 18];
const SLASH = [214, 40, 40];

const mix = (dst, src, a) => {
  dst[0] += (src[0] - dst[0]) * a;
  dst[1] += (src[1] - dst[1]) * a;
  dst[2] += (src[2] - dst[2]) * a;
};

// Quả chuối = phần nằm trong cung tròn lớn nhưng ngoài cung tròn nhỏ, tức hình
// lưỡi liềm. Hai tâm đặt lệch nhau 0.10 nên bề dày còn khoảng 0.13 — ở cỡ 16px
// vẫn còn đúng hai điểm ảnh, mỏng hơn nữa là mất hẳn.
// Toạ độ tính theo tỉ lệ 0..1 để mọi cỡ ảnh dùng chung một công thức.
const inBanana = (x, y) => {
  const outer = Math.hypot(x - 0.5, y - 0.42);
  const inner = Math.hypot(x - 0.5, y - 0.32);
  return outer < 0.34 && inner > 0.31;
};

const inSlash = (x, y) => {
  // Vạch chéo từ trái trên xuống phải dưới, đo bằng khoảng cách tới đường y=x
  const d = Math.abs(x - y) * Math.SQRT1_2;
  return d < 0.05 && x > 0.12 && x < 0.88;
};

const inRounded = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r + 1e-9;
};

const render = (size) => {
  const n = size * SS;
  const acc = new Float64Array(size * size * 4);

  for (let py = 0; py < n; py++) {
    const y = (py + 0.5) / n;
    for (let px = 0; px < n; px++) {
      const x = (px + 0.5) / n;

      let rgb = null;
      let alpha = 0;

      if (inRounded(x, y, 0.2)) {
        rgb = [BG[0], BG[1], BG[2]];
        alpha = 1;
        if (inBanana(x, y)) {
          // Vỏ sáng viền ngoài, ruột sẫm ở trong: ở cỡ 16px chỉ còn thấy một
          // vệt cong, nhưng vẫn tách khỏi nền.
          mix(rgb, PEEL, 1);
          if (inBanana(x, y + 0.035)) mix(rgb, FRUIT, 1);
        }
        if (inSlash(x, y)) mix(rgb, SLASH, 1);
      }

      const oy = (py / SS) | 0;
      const ox = (px / SS) | 0;
      const i = (oy * size + ox) * 4;
      if (alpha > 0) {
        acc[i] += rgb[0];
        acc[i + 1] += rgb[1];
        acc[i + 2] += rgb[2];
        acc[i + 3] += 255;
      }
    }
  }

  const per = SS * SS;
  // PNG dùng màu không nhân alpha, nên phải chia lại cho phần diện tích thật
  // sự có màu; chia cho cả ô thì mép bo góc bị xỉn đi.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const a = acc[i + 3] / per;
      const cover = a / 255;
      const div = cover > 0 ? per * cover : 1;
      raw[p++] = Math.round(acc[i] / div);
      raw[p++] = Math.round(acc[i + 1] / div);
      raw[p++] = Math.round(acc[i + 2] / div);
      raw[p++] = Math.round(a);
    }
  }
  return raw;
};

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const png = (size, raw) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, png(size, render(size)));
  console.log(`icon${size}.png`);
}
