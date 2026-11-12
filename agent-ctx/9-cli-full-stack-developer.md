# Task 9-cli — full-stack-developer (epd-cli)

## Task
Build the `epd-cli` mini-service at `/home/z/my-project/mini-services/epd-cli/`:
a standalone Bun/TypeScript project that is BOTH a CLI for validating `.epd`
files AND a small HTTP server (port 3031) for the Next.js dashboard to invoke.

## What was built
- `package.json` — name `epd-cli`, type `module`, scripts `dev` (`bun --hot index.ts`),
  `start`/`cli` (`bun index.ts`). Zero runtime deps; only `bun-types` devDep.
- `tsconfig.json` — strict TS, `bun-types`.
- `index.ts` — dual-mode entry:
  - CLI mode: `validate`, `repair`, `list-samples`, `proof`, `--help`, `--json`, `--strict`.
  - HTTP mode (no subcommand): `Bun.serve` on port 3031 with `GET /health`,
    `GET /samples`, `POST /run`, CORS preflight.
  - Shared command-core so CLI and HTTP produce byte-identical output.
  - ANSI-colored text (no chalk), JSON mode for machine consumption.
  - Materializes `SAMPLE_POLICIES` + `BROKEN_POLICY_SOURCE` + sample states to
    `policies/` at startup (idempotent writes to avoid `--hot` reload storms).

## Key decisions / workarounds
- Imported the shared `.epd` lib via `../../src/lib/epd` (did NOT modify `src/`).
- The shared parser/samples have 4 grammar mismatches; added a `normalizeSource`
  shim + `restoreAliases` post-processor (documented in code) so the bundled
  samples validate without touching `src/`:
  1. `shard by <dim> {` → `shard by {`
  2. `strategy locality_preserving` (KEYWORD collision) → alias + AST restore
  3. `preserves <fn>(<arg>)` → `preserves <arg>`
  4. `invariant "name"` (quoted) → `invariant name` (unquoted)
- `grid-state-violating.json` uses `frequency: 50.15` (in-bounds) so only the
  SOFT `thermal_headroom` invariant trips → exit 0 without `--strict`, exit 1
  with `--strict` (matches the spec's soft-violation exit-code check). A
  frequency of 50.6 would trip the hard `freq_bounds` invariant and force
  exit 1 always.

## Sandbox note (background-process persistence)
Plain `nohup ... &` does NOT survive across Bash tool calls in this sandbox
(the spawning shell's process tree is reaped). The robust incantation is a
subshell + `setsid` + full fd redirect, which reparents the service to init
in a new session:

```bash
cd /home/z/my-project/mini-services/epd-cli
( setsid bun run dev >/tmp/epd-cli.log 2>&1 </dev/null & )
```

This keeps the service (port 3031) alive across calls. Verified persistent.

## Verification (all pass)
- `curl -s http://localhost:3031/health` → `{"ok":true,"service":"epd-cli","port":3031,"version":"1.0"}`
- CLI validate (pass): exit 0 · (soft-fail): exit 0 · (soft-fail --strict): exit 1 · broken.epd: exit 1
- CLI proof / repair / list-samples / --help / --json: all exit 0
- HTTP POST /run {validate|repair|proof|list-samples}: all return {ok, exitCode, stdout, stderr, result}
- CORS preflight (OPTIONS /run): HTTP 204 with full CORS headers

## Port
**3031** (hardcoded).
