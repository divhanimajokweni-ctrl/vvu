# Task 8-B — full-stack-developer (verification trio)

## What I did
Overwrote three dashboard section stubs for the Epistemic Runtime:
- `src/components/epistemic/mmr-proofs.tsx` → `MmrProofsSection()`
- `src/components/epistemic/invariant-miner.tsx` → `InvariantMinerSection()`
- `src/components/epistemic/cli-terminal.tsx` → `CliTerminalSection()`

## Key decisions
- **Broken GET /api/miner**: the route 500s (Prisma `include: { policy }` on `MinedInvariant` which has no `policy` relation). Per the "only overwrite three files" rule I could NOT fix the route. `invariant-miner.tsx` catches the error, keeps the existing list, surfaces a subtle notice, and repopulates from the working POST `/api/miner/mine` response. PATCH `/api/miner` works fine for accept/reject.
- **POST /api/proofs response** omits `policy` and `verified` — `mmr-proofs.tsx` synthesizes both client-side from the local policy map when prepending a minted proof.
- **POST /api/miner/mine response** `mined[]` records omit `policy` — resolved client-side via `policyMap[c.policyId] ?? "global"`.
- **ANSI rendering**: `renderAnsi()` in cli-terminal splits on `/\x1b\[(\d+(?:;\d+)*)m/` and maps SGR codes to Tailwind classes. Code 34 (blue) → `text-chart-2` (teal) to honor the no-blue design rule. Handles combined codes like `\x1b[1;36m`.
- **Gateway compliance**: every epd-cli fetch uses `?XTransformPort=3031` via a `CLI_BASE()` helper. No absolute `http://localhost:3031` URLs.
- **Repair command**: uses a fixed safe baseline (`SAFE_CURRENT_STATE`) as `current` and the textarea state as `proposed`.

## Verification
- `bun run lint` → exit 0 (0 errors, 0 warnings)
- `curl http://localhost:3000/` → HTTP 200
- `/api/proofs`, `/api/stats`, `/api/policies` → all 200
- POST /api/proofs, POST /api/miner/mine, PATCH /api/miner → all confirmed working via curl
- epd-cli :3031 health/samples/run all reachable
- dev.log: zero compile errors from the three new files (only pre-existing /api/miner GET 500 noise, handled gracefully)

## Files touched (only these three)
- `/home/z/my-project/src/components/epistemic/mmr-proofs.tsx`
- `/home/z/my-project/src/components/epistemic/invariant-miner.tsx`
- `/home/z/my-project/src/components/epistemic/cli-terminal.tsx`
