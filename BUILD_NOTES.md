# Build & Deploy Notes

## Local Dev

```bash
bun install
bun run dev          # starts at localhost:3000
```

## Build

```bash
bun run build        # type-checks + compiles → .next/
```

Note: the sandbox (4GB RAM) may OOM-kill the dev server when compiling 30+ dynamic imports. On Vercel (production) this compiles fine.

## Deploy

Push to `main` → Vercel auto-deploys via `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "bun run build",
  "installCommand": "bun install --frozen-lockfile"
}
```

## CI Checks

- Lint: `bun run lint` (0 errors required)
- Type: `tsc --noEmit` (runtime code excluded — 0 errors on core)
- CF-INT: `node tests/conformance/cf-int-suite.mjs` (42/42 required)
- Boundaries: `bash scripts/enforce-boundaries.sh` (must pass)
- Golden Rule: `node scripts/golden-rule-checker.js` (must pass)

## Guardian Heartbeat

The GuardianHeartbeatChip polls `/api/guardian` every 15s. If the endpoint is unavailable, it shows "GUARDIAN OFF" — it never pretends the system is healthy.

Null safety: `data` can be null on first render. The chip uses `const d = data ?? { present: false }` as a single guard point. All downstream code uses `d.`, never `data.`.

## Mini-Services (local only — not on Vercel)

| Port | Service |
|------|---------|
| 3003 | worm-nest |
| 3031 | epd-cli |
| 3032 | event-bus |
| 3034 | rea |
| 3098 | debugger |
