# AGENTS — Operating Rules

**Status:** Tier 1 — Active

## How Agents Collaborate
1. **Search all 6 canonical docs** (VVU_COLONY_SPEC, ENGINEERING_CONSTITUTION, HOMEPAGE_VISION, AGENTS, MEMORY, active/PLAN) before asking "how should this work?"
2. **Found?** → Implement it. Don't improvise, don't "improve".
3. **Not found?** → Ask the founder (Divhani Majokweni) exactly once, then write the answer in MEMORY.md.
4. **One round per response** unless told otherwise. Do not stack rounds.
5. **Do not start a later phase to "save time."** A phase that skips its gate gets reverted.

## CI Gates (must stay green after every push)
- Enforce boundaries (4 checks): `bash scripts/enforce-boundaries.sh`
- Deploy/Gate Boundaries: auto-fixes when boundaries passes
- TypeScript type-check: `bunx tsc --noEmit` (0 errors required)
- Lint: `bun run lint` (0 errors required)

## Branch Policy
- Target: `origin/main` on `redesigned-no123`.
- Print `git rev-parse --abbrev-ref HEAD` and `git remote -v` before any push.
- Never push to a branch you have not confirmed by name.

## Deployment Locks
- Do NOT use `bun run build` — that is a founder-only manual step.
- Do NOT delete files without checking import count first.
- Do NOT run `mkdir` under `sh` (no brace expansion). Use `bash` or explicit paths.

## Phased Rollout
- Phase 1: Integration & CI Green (current)
- Phase 2: Browser PWA
- Phase 3: Windows Desktop (Tauri)
- Phase 4: Android + iOS
- Phase 5: Huawei HarmonyOS + Honor MagicOS
- Phase 6: macOS (Tauri)
- Phase 7: Smartwatch (Wear OS / watchOS)
- **DO NOT PROCEED TO NEXT PHASE UNTIL PREVIOUS PHASE IS GREEN.**
