// tests/diffqr.ts — local debug: diff our matrix vs the `qrcode` npm encoder.
import QR from 'qrcode';
import { qrEncode } from '../qr';

const text = process.argv[2] ?? 'https://192.168.1.20:3007/join';
const mine = qrEncode(text);
const ref = QR.create(text, { errorCorrectionLevel: 'M' });
const n = ref.modules.size;
console.log(`payload=${text.length}B mine=${mine.length} ref=${n}`);
if (mine.length !== n) {
  console.log('SIZE MISMATCH — version selection differs');
  process.exit(1);
}
let diffs = 0;
const seen = new Set<string>();
for (let y = 0; y < n; y++) {
  for (let x = 0; x < n; x++) {
    const r = !!ref.modules.get(y, x); // qrcode returns 0/1 — coerce
    if (!!mine[y][x] !== r) {
      diffs++;
      if (seen.size < 30) {
        const tag =
          (y === 6 || x === 6) ? 'TIMING' :
          (y < 9 && x < 9) || (y < 9 && x >= n - 8) || (y >= n - 8 && x < 9) ? 'FINDER/FMT' :
          (y >= n - 9 && y <= n - 5 && x >= n - 9 && x <= n - 5) ? 'ALIGN-BR' :
          (y <= 6 && x >= n - 11 && x <= n - 5) || (x <= 6 && y >= n - 11 && y <= n - 5) ? 'VERSION' :
          'DATA';
        seen.add(`${y},${x} ${tag} mine=${mine[y][x] ? 1 : 0} ref=${r ? 1 : 0}`);
      }
    }
  }
}
console.log(`diffs=${diffs}/${n * n}`);
for (const s of seen) console.log('  ' + s);
