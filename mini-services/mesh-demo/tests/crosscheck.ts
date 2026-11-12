// tests/crosscheck.ts — adversarial self-check for the zero-dep QR encoder.
// Renders our matrix to RGBA pixels and decodes it with jsQR (devDependency —
// NOT used by the shipped runtime). If jsQR reads the payload back, a phone
// scanner will too. Covers V1..V10 (EC-M) incl. exact-capacity edge cases.

import jsQR from 'jsqr';
import { qrEncode } from '../qr';

const CAP = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]; // byte capacity EC-M V1..V10
const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~:/?#[]@!$&()*+,;=%';

function rasterize(m: boolean[][], border = 6): { data: Uint8ClampedArray; width: number; height: number } {
  const n = m.length;
  const size = n + border * 2;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y][x]) continue;
      for (const [dy, dx] of [[0, 0]] as const) {
        const py = (y + border) * size + (x + border);
        data[py * 4] = 0;
        data[py * 4 + 1] = 0;
        data[py * 4 + 2] = 0;
        data[py * 4 + 3] = 255;
      }
    }
  }
  return { data, width: size, height: size };
}

let pass = 0;
let fail = 0;
const cases: string[] = [];
// boundary + typical payloads
cases.push('HELLO');
cases.push('https://192.168.1.20:3007/join');
cases.push('https://preview-7f3a2b.example.space-z.ai/mesh-demo/join?XTransformPort=3007');
for (const cap of CAP) {
  let s = '';
  for (let i = 0; i < cap; i++) s += ALPHA[i % ALPHA.length];
  cases.push(s); // exact capacity
  cases.push(s.slice(0, -1)); // capacity − 1
}
// capacity overflow must throw
try {
  let s = '';
  for (let i = 0; i < 214; i++) s += 'a';
  qrEncode(s);
  console.error('FAIL overflow: 214B accepted (V10-M max = 213)');
  fail++;
} catch {
  pass++;
}

for (const text of cases) {
  const m = qrEncode(text);
  const img = rasterize(m);
  const res = jsQR(img.data, img.width, img.height);
  if (res && res.data === text) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL decode (${text.length}B, matrix ${m.length}×${m.length}): ${res ? `mismatch → ${JSON.stringify(res.data.slice(0, 40))}` : 'NULL decode'}`);
  }
}
console.log(`CROSSCHECK ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'}`);
if (fail > 0) process.exit(1);
