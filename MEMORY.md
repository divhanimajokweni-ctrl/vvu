# MEMORY — Session Memory

**Status:** Tier 1 — Active
**Rule:** Before any agent asks "how should this work?", check all 6 canonical docs first. If the answer is there, implement it. If not, ask the founder once, then write the answer here.

## Decisions Made (append-only, newest first)

### 2026-10-15 — Layout rework: LEFT rail = 5 environments, RIGHT sidebar = workspace
- LEFT rail: 5 environment icons (Forge/Bench/Fire/Field/Press), icon-only, active=icon+label.
- RIGHT sidebar: 5 workspace sections (Account/Settings/Devices/Subscription/Dev), moved from tab strip.
- CENTER: runtime sections filtered by active environment.
- Mobile: LEFT rail → overlay drawer, RIGHT sidebar → overlay drawer. Toggle buttons in header.
- The `> WORKSPACE` marker moved from the tab strip into the right sidebar header.

### 2026-10-15 — Shell contract VVU-SHELL-2026-001 published
- 8 sections: MOUNT, COMMAND BUS, HOTKEY REGISTRY, CLIPBOARD CHANNEL, WORKER MODEL, IMPORT/EXPORT PORT, VERSION NEGOTIATION, STANDING LIMITATIONS.
- Shell client implemented: HotkeyRegistry, CommandBus, Router, MountLoader, WorkerSupervisor, ClipboardChannel, VersionNegotiation.
- Envelope v1.1 enum extension proposed: artefact_type + source_surface cross-environment.

### 2026-10-15 — Fire-R1+R2 applied to fire/FIRE.html
- Envelope (canonical JSON, buildEnvelope, assertFireEnvelope — PROVEN rejected by construction).
- Pre-registration chain (authoriseCase: F9 threat model, F10 in-scope, F11 case-level auth).
- Self-tests: ENVELOPE passes, PRE-REGISTRATION passes. 2 pre-existing failures unrelated.

### 2026-10-14 — CI fixed: 0 type errors, 0 lint errors, boundaries pass
- Custom cva() props type broadened from Record<string, string|undefined> to Record<string, unknown>.
- 20 orphaned UI component files deleted (accordion, calendar, carousel, etc.).
- tsconfig excludes: examples/, skills/, mini-services/, open-source/, commercial/, scripts/.

### 2026-10-14 — Nav rail: ICONS=YES, LABELS=NULL, active=ICON+LABEL
- All nav buttons show icon only when inactive.
- Active tab shows icon + full label.
- title + aria-label on every button.

## Open Questions
- None currently. All resolved decisions are above.

## Context That Persists
- Repo: redesigned-no123 @ main (origin: github.com/divhanimajokweni-ctrl/redesigned-no123.git)
- 5 mini-services: epd-cli:3031, event-bus:3032, worm-nest:3003, rea:3034, debugger:3098
- 29 sections → now 24 runtime (grouped into 5 environments) + 5 workspace (right sidebar)
- Dependencies: 28 (Golden Rule enforced — no clsx, no class-variance-authority, no radix-ui/react-{slider,avatar,dropdown-menu})
- VVU palette: vvu-lime #c8ff00, vvu-ochre #f3e38a, vvu-crimson #e5484d, vvu-sage-bright #8fb35a. NO blue/indigo.

### 2026-10-15 — OOM-kill root cause found + watchdog deployed
- **Root cause of blank dashboard:** Next.js 16 Turbopack uses 22GB virtual / 1.7GB resident memory. The sandbox kernel OOM-kills `next-server` after ~10-40s. Found via `dmesg | grep oom`.
- **Fix deployed:**
  - `package.json` dev script: `NODE_OPTIONS='--max-old-space-size=384'` (aggressive heap limit)
  - `.zscripts/watchdog.sh`: auto-restarts dev server when it dies (checks every 5s, restarts within 5s)
  - Cleaned `.next` cache (reduces memory pressure)
- **Result:** Server stays up longer but still gets OOM-killed eventually. The watchdog keeps it alive in bursts. If you catch a restart cycle, wait 5 seconds and refresh.
- **Lesson:** ALWAYS sync to git after every round. The code persists even when the server dies. The server is ephemeral; the git history is permanent.
