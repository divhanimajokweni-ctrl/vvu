// demo-agent.ts — QA device simulator for the mesh-demo rail.
// Connects as a WS node (honestly labelled SIM — the dashboard shows the
// SIMULATED badge), streams all five channels for ~10s, then SIMULATES THE
// COVERED-CAMERA BEAT (camera → UNDEFINED/LENS_COVERED for ~6s), then stops
// sharing (node.leave). Run: `bun run demo-agent`.

const URL_ = process.argv[2] ?? 'ws://localhost:3007/ws';
const LABEL = process.argv[3] ?? 'SIM-AGENT-01';

const ws = new WebSocket(URL_);
const t0 = Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const send = (o: unknown) => ws.send(JSON.stringify(o));

ws.onopen = async () => {
  console.log(`[agent] connected ${URL_} as ${LABEL}`);
  send({ type: 'hello', id: `sim-${Math.random().toString(36).slice(2, 8)}`, label: LABEL, sim: true });

  // Phase 1 — live readings, all channels, ~10s
  const iv = setInterval(() => {
    const t = (Date.now() - t0) / 1000;
    send({ type: 'reading', ch: 'camera', state: 'live', value: { luma: +(38 + 20 * Math.sin(t)).toFixed(1), w: 1920, h: 1080 } });
    send({ type: 'reading', ch: 'mic', state: 'live', value: { dbfs: +(-42 + 6 * Math.cos(t * 1.7)).toFixed(1) } });
    send({ type: 'reading', ch: 'gps', state: 'live', value: { lat: -33.92487, lon: 18.42406, acc: 8 } });
    send({ type: 'reading', ch: 'motion', state: 'live', value: { ax: 0.12, ay: 0.34, az: 9.71, ra: 3, rb: -1, rg: 2 } });
    send({ type: 'reading', ch: 'battery', state: 'live', value: { level: 87, charging: false } });
  }, 1000);

  await sleep(10000);
  clearInterval(iv);

  // Phase 2 — the covered-camera beat: UNDEFINED, never a guess
  console.log('[agent] covering camera (LENS_COVERED)…');
  const iv2 = setInterval(() => {
    send({ type: 'reading', ch: 'camera', state: 'undefined', value: { luma: 0.4 }, reason: 'LENS_COVERED' });
    send({ type: 'reading', ch: 'mic', state: 'live', value: { dbfs: -58.2 } });
    send({ type: 'reading', ch: 'gps', state: 'live', value: { lat: -33.92487, lon: 18.42406, acc: 8 } });
    send({ type: 'reading', ch: 'motion', state: 'live', value: { ax: 0.1, ay: 0.31, az: 9.7, ra: 2, rb: 0, rg: 1 } });
    send({ type: 'reading', ch: 'battery', state: 'live', value: { level: 86, charging: false } });
  }, 1000);

  await sleep(6000);
  clearInterval(iv2);

  // Phase 3 — stop sharing
  console.log('[agent] stop sharing → node.leave');
  send({ type: 'unshare' });
  await sleep(800);
  ws.close();
  console.log('[agent] done');
  process.exit(0);
};

ws.onerror = (e) => {
  console.error('[agent] WS error — is the service running? (bun run dev)', e.message ?? '');
  process.exit(1);
};
