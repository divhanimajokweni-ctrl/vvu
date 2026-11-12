// qr.ts — zero-dependency QR encoder for the mesh-demo rail.
// Byte mode · error-correction level M · versions 1–10 · mask penalty eval.
// Renders LOCALLY (SVG string / terminal ASCII). Per §8 of
// ProofBridge/TEMPLATE_QR_BRIDGE.md: the render call must never leak the
// reference to a third party — no CDN, no api.qrserver.com, no npm at runtime.
// Correctness is proven by tests/crosscheck.ts (jsqr round-trip decode,
// devDependency only — the shipped runtime needs nothing but Bun).

const CAPACITY_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]; // byte capacity, EC-M, V1..V10
// [dataCodewordsTotal, ecPerBlock, blocks] — EC level M, V1..V10
// (verified against the QR spec table: V4=2×(32+18), V5=2×(43+24), V6=4×(27+16),
// V7=4×(31+18), V8=4×(38..39+22), V9=5×(36..37+22), V10=5×(43..44+26);
// unequal data blocks where dataTotal % blocks ≠ 0 — first blocks get +1)
const EC_M: ReadonlyArray<readonly [number, number, number]> = [
  [16, 10, 1],
  [28, 16, 1],
  [44, 26, 1],
  [64, 18, 2],
  [86, 24, 2],
  [108, 16, 4],
  [124, 18, 4],
  [154, 22, 4],
  [182, 22, 5],
  [216, 26, 5],
];
// Alignment pattern centre coordinates, V2..V10 (V1 has none)
const ALIGN: ReadonlyArray<ReadonlyArray<number> | null> = [
  null,
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// ── GF(256), primitive polynomial 0x11D ─────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
function gmul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial G(x) = ∏(x + α^i), LSB-first coefficients, length r+1. */
function generatorPoly(r: number): number[] {
  let coef: number[] = [1];
  for (let i = 0; i < r; i++) {
    const next = new Array<number>(coef.length + 1).fill(0);
    for (let k = 0; k < coef.length; k++) {
      if (coef[k] === 0) continue;
      next[k + 1] ^= coef[k]; // × x
      next[k] ^= gmul(coef[k], EXP[i]); // × α^i
    }
    coef = next;
  }
  return coef;
}

/** Remainder of D(x)·x^r mod G(x) — LFSR division, LSB-first register. */
function rsRemainderLsb(data: number[], r: number, gen: number[]): number[] {
  const rem = new Array<number>(r).fill(0);
  for (const d of data) {
    const factor = d ^ rem[r - 1];
    for (let k = r - 1; k > 0; k--) rem[k] = rem[k - 1];
    rem[0] = 0;
    if (factor !== 0) {
      for (let k = 0; k < r; k++) {
        if (gen[k]) rem[k] ^= gmul(gen[k], factor);
      }
    }
  }
  return rem; // rem[k] = coefficient of x^k
}

// ── Format / version BCH ────────────────────────────────────────────────────
function formatBits(mask: number): number {
  // EC level M = 0b00 → 5 data bits = mask (3 bits)
  const data = mask & 0x07;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}
function versionBits(v: number): number {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return ((v << 12) | rem) & 0x3ffff;
}

const MASK_FN: ReadonlyArray<(y: number, x: number) => boolean> = [
  (y, x) => (y + x) % 2 === 0,
  (y) => y % 2 === 0,
  (_y, x) => x % 3 === 0,
  (y, x) => (y + x) % 3 === 0,
  (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (y, x) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (y, x) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
];

export function qrEncode(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = -1;
  for (let v = 1; v <= 10; v++) {
    if (bytes.length <= CAPACITY_M[v - 1]) {
      version = v;
      break;
    }
  }
  if (version < 0) throw new Error(`QR: payload ${bytes.length}B exceeds V10-M capacity (213B)`);

  // ── bit stream: mode + count + data + terminator + pad ──
  const bits: boolean[] = [];
  const pushBits = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push(((val >>> i) & 1) === 1);
  };
  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const [dataTotal, ecPerBlock, blocks] = EC_M[version - 1];
  const capacityBits = dataTotal * 8;
  pushBits(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(false);
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) if (bits[i + j]) b |= 1 << (7 - j);
    dataBytes.push(b);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; dataBytes.length < dataTotal; i++) dataBytes.push(PAD[i % 2]);

  // ── Reed–Solomon per block + interleave ──
  const gen = generatorPoly(ecPerBlock);
  const baseLen = Math.floor(dataTotal / blocks);
  const extra = dataTotal % blocks; // last `extra` blocks carry one more data codeword
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let off = 0;
  for (let b = 0; b < blocks; b++) {
    const len = baseLen + (b >= blocks - extra ? 1 : 0); // spec: shorter group-1 blocks first, +1 goes to the last blocks
    const blk = dataBytes.slice(off, off + len);
    off += len;
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainderLsb(blk, ecPerBlock, gen).reverse()); // MSB-first EC
  }
  const codewords: number[] = [];
  const maxLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const blk of dataBlocks) if (i < blk.length) codewords.push(blk[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) codewords.push(blk[i]);
  }

  // ── matrix + function patterns ──
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (y: number, x: number, dark: boolean) => {
    if (y < 0 || y >= size || x < 0 || x >= size) return;
    modules[y][x] = dark;
    isFunc[y][x] = true;
  };

  const drawFinder = (cr: number, cc: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dy), Math.abs(dx));
        set(cr + dy, cc + dx, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(3, size - 4);
  drawFinder(size - 4, 3);

  for (let i = 8; i <= size - 9; i++) {
    set(6, i, i % 2 === 0); // timing row
    set(i, 6, i % 2 === 0); // timing column
  }

  const centers = ALIGN[version - 1];
  if (centers) {
    const last = centers[centers.length - 1];
    for (const r of centers) {
      for (const c of centers) {
        if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const d = Math.max(Math.abs(dy), Math.abs(dx));
            set(r + dy, c + dx, d !== 1);
          }
        }
      }
    }
  }

  // version info (V7+)
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vb >>> i) & 1) === 1;
      const col = size - 11 + (i % 3);
      const row = Math.floor(i / 3);
      set(row, col, bit);
      set(col, row, bit);
    }
  }

  // format info (drawn twice: reserve now with mask 0, redraw with final mask)
  const drawFormat = (mask: number) => {
    const f = formatBits(mask);
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(i, 8, bit(i));
    set(7, 8, bit(6));
    set(8, 8, bit(7));
    set(8, 7, bit(8));
    for (let i = 9; i <= 14; i++) set(8, 14 - i, bit(i));
    for (let i = 0; i <= 7; i++) set(8, size - 1 - i, bit(i));
    for (let i = 8; i <= 14; i++) set(size - 15 + i, 8, bit(i));
    set(size - 8, 8, true); // dark module
  };
  drawFormat(0);

  // ── data placement (zigzag, skipping function modules) ──
  const bitAt = (idx: number): boolean => {
    if (idx >= codewords.length * 8) return false; // remainder bits are 0
    return ((codewords[idx >> 3] >>> (7 - (idx & 7))) & 1) === 1;
  };
  {
    let i = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip vertical timing column
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const y = upward ? size - 1 - vert : vert;
          const x = right - j;
          if (isFunc[y][x]) continue;
          modules[y][x] = bitAt(i);
          i++;
        }
      }
      upward = !upward;
    }
  }

  // ── mask selection ──
  const applyMask = (mask: number): boolean[][] =>
    modules.map((row, y) =>
      row.map((v, x) => (isFunc[y][x] ? v : MASK_FN[mask](y, x) ? !v : v))
    );

  const penalty = (m: boolean[][]): number => {
    const n = m.length;
    let score = 0;
    const at = (y: number, x: number) => (y >= 0 && y < n && x >= 0 && x < n ? m[y][x] : null);
    // N1: runs ≥ 5 (rows & cols)
    for (let y = 0; y < n; y++) {
      let run = 1;
      for (let x = 1; x < n; x++) {
        if (m[y][x] === m[y][x - 1]) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (let x = 0; x < n; x++) {
      let run = 1;
      for (let y = 1; y < n; y++) {
        if (m[y][x] === m[y - 1][x]) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    // N2: 2×2 same-colour blocks
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const v = m[y][x];
        if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) score += 3;
      }
    }
    // N3: finder-like 1-0-1-1-1-0-1 with 4 light on one side (rows & cols)
    const line = (get: (i: number) => boolean | null, len: number) => {
      let s = 0;
      for (let i = 0; i + 6 < len + 8; i++) {
        const seg = [0, 1, 2, 3, 4, 5, 6].map((k) => get(i + k));
        if (seg.some((v) => v === null)) continue;
        if (seg[0] && !seg[1] && seg[2] && seg[3] && seg[4] && !seg[5] && seg[6]) {
          let before = true;
          for (let k = 1; k <= 4; k++) if (get(i - k) !== false) before = false;
          let after = true;
          for (let k = 7; k <= 10; k++) if (get(i + k) !== false) after = false;
          if (before || after) s += 40;
        }
      }
      return s;
    };
    for (let y = 0; y < n; y++) score += line((i) => at(y, i), n);
    for (let x = 0; x < n; x++) score += line((i) => at(i, x), n);
    // N4: dark proportion
    let dark = 0;
    for (const row of m) for (const v of row) if (v) dark++;
    const percent = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix: boolean[][] | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(mask);
    const s = penalty(masked);
    if (s < bestScore) {
      bestScore = s;
      bestMask = mask;
      bestMatrix = masked;
    }
  }
  const result = bestMatrix!;
  // redraw format info on the final matrix with the chosen mask
  {
    const m = result;
    const f = formatBits(bestMask);
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    const put = (y: number, x: number, dark: boolean) => {
      m[y][x] = dark;
    };
    for (let i = 0; i <= 5; i++) put(i, 8, bit(i));
    put(7, 8, bit(6));
    put(8, 8, bit(7));
    put(8, 7, bit(8));
    for (let i = 9; i <= 14; i++) put(8, 14 - i, bit(i));
    for (let i = 0; i <= 7; i++) put(8, size - 1 - i, bit(i));
    for (let i = 8; i <= 14; i++) put(size - 15 + i, 8, bit(i));
    put(size - 8, 8, true);
  }
  return result;
}

/** Crisp SVG — the authoritative scannable render (white background, 4-module quiet zone). */
export function qrSvg(text: string, opts?: { px?: number; border?: number }): string {
  const m = qrEncode(text);
  const n = m.length;
  const border = opts?.border ?? 4;
  const total = n + border * 2;
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) parts.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${total * 8}" height="${total * 8}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="QR code (rendered locally)">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<path d="${parts.join('')}" fill="#000000"/></svg>`
  );
}

/** Terminal half-block render (server startup banner). Best on a light terminal. */
export function qrAscii(text: string, border = 2): string {
  const m = qrEncode(text);
  const n = m.length;
  const total = n + border * 2;
  const at = (y: number, x: number) =>
    y >= border && y < border + n && x >= border && x < border + n ? m[y - border][x - border] : false;
  const lines: string[] = [];
  for (let y = 0; y < total; y += 2) {
    let line = '';
    for (let x = 0; x < total; x++) {
      const top = at(y, x);
      const bot = y + 1 < total ? at(y + 1, x) : false;
      line += top && bot ? '██' : top ? '▀▀' : bot ? '▄▄' : '  ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
