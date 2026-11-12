# Vercel Services Config — the fact base behind `vercel.json`

> Main-runner round r97 (2026-09-30 / 10-01). This file is the labeling the
> JSON itself cannot carry: JSON has no comments, and the published Vercel
> schema (`additionalProperties: false`) forbids a `_comment`-style key.
> Every claim below states how it was verified. Nothing here was deployed —
> this box has no Vercel CLI, no `.vercel/`, and no token (and the estate
> rule stands: tokens are never pasted into chat).

## 1. How each fact was verified

| Source | Method | Date (UTC) |
|---|---|---|
| Repo paths | `ls -la` of `mini-services/safegrid/`, `src/hbk/`, `src/ive/`, `src/proofbridge/` — the exact precondition block from the operator's relayed message | 2026-09-30 16:36 |
| Call edges | `grep` over `src/` and `mini-services/` for `XTransformPort`, `*_URL`, `localhost:30xx`, `SAFEGRID_VVU_BASE`, socket wiring | 2026-09-30 16:40 |
| Vercel schema | `curl https://openapi.vercel.sh/vercel.json` → 450,843 bytes, exit 0; parsed with Python | 2026-09-30 16:36 |
| Vercel docs | `curl` of `/docs/services` (951,775 B), `/docs/services/routing` (939,610 B), `/docs/services/service-bindings` (264,960 B), text-extracted | 2026-09-30 16:45 |

## 2. The schema question (item d) — RESOLVED, and the earlier claim is stale

The relayed message's central worry was: *"`services` is not in the schema
yet … a vercel.json containing a `services` key would fail schema
validation against this URL."*

**That is no longer true of the live schema.** The snapshot fetched fresh
this round (2026-09-30 16:36 UTC) is still draft-04 with
`additionalProperties: false` at the top level, and its allowed top-level
key list **includes** `services` (plus `experimentalServices`,
`experimentalServicesV2`, `experimentalServiceGroups`). `bindings` is
defined **per-service**, inside `services.*.bindings`, as caller-side
bindings. The rewrites `destination` accepts the object form
`{ "service": …, "path"?: …, "type"?: "service" }`, and rewrite items
support `has` / `missing` conditions including `type: "query"`.

So: **vercel.json at the repo root is the right place**, per both the
current schema and the docs quick start ("Define services in vercel.json
using the `services` key"). The config in this repo was mechanically
validated against the fetched schema with `jsonschema` 4.26.0
(Draft-04 validator) — see §6.

What remains unverifiable on this box: deploy-time behavior (no CLI). The
first operator-side `vercel deploy` is the final fact. `vercel dev -L`
runs all services locally without cloud auth — the recommended first
check on a machine that has the CLI.

## 3. The corrected roster (item a) — seven services, not five

The five-name list in the relayed task (`app, safegrid, hbk, ive,
proofbridge`) was a prior inference, and the repo corrects it:

| Name in config | Root (ls-verified) | What it actually is | In config? |
|---|---|---|---|
| `app` | `.` | Next.js Studio, port 3000, `output: "standalone"` (`next.config.ts`) | **Yes** |
| `safegrid` | `mini-services/safegrid` | Bun + Express 5 + Drizzle over `bun:sqlite`, port 3008 (README + package.json) | **Yes** |
| `telemetry-service` | `mini-services/telemetry-service` | `node:http` + socket.io, port 3003 | **Yes** |
| `vault-bridge` | `mini-services/vault-bridge` | `node:http` + socket.io, port 3004 | **Yes** |
| `vvu-field-onboard` | `mini-services/vvu-field-onboard` | `node:http` + socket.io, port 3005 | **Yes** |
| `wildfire-mesh` | `mini-services/wildfire-mesh` | `node:http` + socket.io, port 3006 | **Yes** |
| `mesh-demo` | `mini-services/mesh-demo` | Bun-native (`Bun.serve` + native WebSocket), zero deps, port 3007 | **Yes** |
| `hbk` | `src/hbk` | **Rust computation crate — no HTTP server.** Deps: serde/serde_json/thiserror only; `main.rs` prints a health JSON and exits. Nothing in the repo calls it over HTTP. | **No** (§5) |
| `ive` | `src/ive` | Second Next.js app — **a server since r25** (`output:'export'` retired; `next.config.mjs` comment: the final card syncs same-origin at `location.origin + '/api/vvu/captures/sync'`). Its README's "static export" line is stale. | **No** (§5) |
| `proofbridge` | `src/proofbridge` | **Rust safety-kernel crate — no HTTP server.** Deps: ed25519-dalek/sha2/serde; `cargo run` prints a health JSON. No caller anywhere in the repo. | **No** (§5) |

The port map (3003–3008) is not a guess — it is hardcoded in each
service's `index.ts` with comments saying the gateway and dashboards
depend on the defaults, and mirrored client-side in
`src/lib/rails-sampler.ts` `RAILS`.

## 4. Routing (item b) — gateway parity, query-conditioned

The sandbox gateway (`Caddyfile`, port 81) has exactly two rules:

1. any request carrying `?XTransformPort=<port>` → `reverse_proxy` to that
   localhost port (service sees its own path);
2. everything else → `localhost:3000`.

The `rewrites` array in `vercel.json` replicates both rules, using the
docs-confirmed mechanism ("A service rewrite accepts the same `has` and
`missing` conditions as an ordinary rewrite"):

- six query-conditioned rules, one per port, **before** the catch-all
  (rewrites evaluate in order, first match wins);
- the catch-all `/(.*) → app` (the public Studio surface — same shape as
  the docs quick start);
- "The service receives the original request path" — same semantics as
  the Caddy `reverse_proxy`, so no app code changes are needed for the
  browser-side calls.

Public/internal posture (item b, answered from the repo): the Studio
(`app`) is the only unconditioned public surface, exactly as on the
sandbox. The six rails are reachable only through the same
`?XTransformPort=` convention the sandbox gateway already exposes —
parity, not new exposure. IVE keeps its own origin (§5).
`proofbridge.venturevisionubuntu.co.za` is the **proofbridge-liner**
workstream's domain — a separate repo/box (see
`download/liner-boundary/NOT_CLAIMED.md` + `PROVENANCE.md`); this config
does not touch it.

## 5. Named exclusions, with reasons

- **`hbk` / `proofbridge` (Rust crates)** — a Vercel service must be a
  runnable, listening process. Both crates are libraries plus a one-shot
  CLI (`main.rs` prints health JSON and exits; no HTTP dependency exists
  in either `Cargo.toml`). The schema's alternative — the `daemon`
  variant — requires a Dockerfile/Containerfile, which neither has, and
  is ingress-less anyway. To ship either as a service, someone must first
  write an HTTP server (or a container) for it. That is a build decision,
  not a config line — named, not guessed.
- **`ive`** — excluded from this project's services by its own final
  contract: the card is final (operator ruling, trace 1a0efd24754be67d,
  recorded in `src/ive/next.config.mjs`), and it syncs to
  `location.origin + '/api/vvu/captures/sync'`. Mounting IVE under a
  sub-path of this project would change its origin and break that
  same-origin sync. IVE deploys as its own project (it has its own
  `package.json`, `next.config.mjs`, `tsconfig.json`), on its own domain
  (venturevisionubuntu.co.za per its README).
- **`mesh-demo` posture flag** — its README calls it a local-only room
  demo ("Nothing leaves the room"), yet the sandbox gateway already
  exposes it publicly at `?XTransformPort=3007`, and the Studio's mesh
  workspace uses it through that gateway. The config ships **parity**
  (exposed). If the operator rules the demo should not be
  internet-reachable, delete its rewrite — it becomes unroutable, and the
  app's mesh workspace will show the rail as down.

## 6. Field-by-field labeling

**Confirmed (ls/grep/schema/docs, this box):**

- every `root` path exists;
- every `entrypoint` file exists (`index.ts` × 5, `src/index.ts` for
  safegrid);
- port→service mapping (hardcoded defaults in each service + mirrored in
  `rails-sampler.ts` and the app's workspaces);
- the one real binding edge: **safegrid → app**, because
  `mini-services/safegrid/src/index.ts` reads
  `process.env.SAFEGRID_VVU_BASE ?? 'http://127.0.0.1:3000'` and POSTs
  `${vvuBase}/api/safegrid/inbox` (relay) + probes
  `${vvuBase}/api/safegrid/health` — the binding env name matches the
  code verbatim, so **zero code change** is needed for the binding;
- the whole config validates against the fetched schema (Draft-04,
  `jsonschema` 4.26.0, validated r97 — see the r97 worklog entry for the
  command and result).

**Inferred (named):**

- `"framework": "nextjs"` on `app` — the documented slug; explicit
  because the repo root also contains other Next-shaped trees
  (`src/ive`, `reference/…`) that could confuse auto-detection;
- omitting `runtime` on the minis — left to deploy-time auto-detection.

**Unverified on this box (deploy-time facts, honestly open):**

1. **WebSocket through service rewrites** — 5 of 6 rails are
   WS-dependent (four socket.io servers + mesh-demo's native Bun WS).
   The fetched routing docs make **no WebSocket statement**. If WS
   upgrades do not traverse service rewrites, the live panels degrade to
   their HTTP fallbacks. First deploy answers it.
2. **Bun runtime support for services** — `safegrid` needs `bun:sqlite`,
   `mesh-demo` needs `Bun.serve`. Whether Vercel Services run Bun is not
   verifiable from here. The documented fallback is container images
   (`"runtime": "container"` + a Dockerfile per service).
3. **Binding URL shape** — whether the injected `SAFEGRID_VVU_BASE`
   carries a trailing slash is unstated in the docs text fetched. If it
   does, `${vvuBase}/api/…` double-slashes; the fix is a one-line strip
   at the use site in `relay.ts` / `vvu-health.ts` (a follow-up commit,
   not this one — the estate's zero-TS-delta discipline holds while the
   memory wall stands).
4. **Server-side loopback probes** — `src/lib/rails-sampler.ts` probes
   `http://127.0.0.1:{port}` directly, which works on this sandbox's
   shared loopback but not across separate Vercel services. On Vercel the
   rails panel would report down until the probe map is adapted (env- or
   binding-based). Named follow-up, same TS-delta gate.

## 7. Operator runbook (from any machine with the Vercel CLI)

```bash
cd /path/to/proofbridge-vvu-checkout
vercel dev -L        # local run of all services, no cloud auth;
                     # binding envs are injected locally too
vercel deploy        # first real deploy — resolves open items 1–3 in §6
```

Watch on first deploy: a socket.io rail handshake
(`/?XTransformPort=3003` from a browser console), the SafeGrid relay
(`/v1/admin/vvu-health` on the :3008-equivalent route), and the Studio's
rails panel. No tokens belong in chat — set any needed env in the
dashboard or via `vercel env`.

## 8. What this config does NOT change

- Nothing on this box: `vercel.json` is inert to `next dev`, the Caddy
  gateway, the six mini-services, and `tsc` (JSON is not TS — the
  measured-141 baseline is untouched).
- No app code was modified in r97. The task's "update the application
  code" part resolves to: **not needed for the binding** (the env read
  already exists verbatim), and **named-but-gated** for the
  rails-sampler adaptation (§6.4).
- The proofbridge-liner domain, the two-ledger boundary, and every
  shared authority (`docs/data/*`) are untouched.
