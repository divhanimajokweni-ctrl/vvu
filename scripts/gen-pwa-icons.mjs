// scripts/gen-pwa-icons.mjs — R54 PWA install path.
//
// Regenerates every raster PWA icon from the two SVG sources in
// public/icons/ (source.svg = colour hex mark; source-monochrome.svg =
// white-on-transparent themed-icon variant). Run from the repo root:
//
//   node scripts/gen-pwa-icons.mjs
//
// Uses the project's own `sharp` (no new dependency). Fail-closed: the
// script re-reads every output PNG and verifies format + dimensions before
// exiting 0. Safe-zone note: all glyphs sit within 178.9px of centre —
// inside the 204.8px (40%) maskable safe circle — so icon-512 doubles as
// the maskable raster with no padding art needed.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ICONS = join(ROOT, 'public', 'icons');

const TARGETS = [
  // [source svg, output png, width, height, expectsAlpha]
  ['source.svg', 'icon-192.png', 192, 192, false],
  ['source.svg', 'icon-512.png', 512, 512, false],
  ['source.svg', 'maskable-512.png', 512, 512, false],
  ['source.svg', 'apple-touch-icon.png', 180, 180, false],
  ['source-monochrome.svg', 'monochrome-512.png', 512, 512, true],
];

let failed = false;
for (const [src, out, w, h, alpha] of TARGETS) {
  const svg = join(ICONS, src);
  const png = join(ICONS, out);
  try {
    await sharp(svg).resize(w, h).png().toFile(png);
    const meta = await sharp(png).metadata();
    const ok = meta.format === 'png' && meta.width === w && meta.height === h;
    const alphaOk = alpha ? meta.hasAlpha === true : true;
    if (!ok || !alphaOk) throw new Error(`verify failed: ${meta.format} ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`);
    console.log(`ok  ${out}  ${w}x${h}  alpha=${Boolean(meta.hasAlpha)}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${out}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
