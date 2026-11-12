# HOMEPAGE VISION — Product Direction

**Status:** Tier 1 — Active

## What Users See
A 3-column control-plane dashboard:
- **LEFT rail**: 5 environment icons (Forge, Bench, Fire, Field, Press) — the Five Environments from VVU-ENV-BLUEPRINT-2026-001. Icon-only; active shows icon+label.
- **CENTER**: runtime sections filtered by the active environment. Tab strip with icon-only inactive tabs, icon+label active tab.
- **RIGHT sidebar**: WORKSPACE panel (Account, Settings, Devices, Subscription, Dev). Collapsible; on mobile becomes an overlay drawer.

## UX Commitments
- Mobile-first: everything works at 360px, no keyboard-only interactions.
- Nav rail: ICONS=YES, LABELS=NULL; only the ACTIVE tab renders icon+label.
- Every button carries `title` + `aria-label`.
- Sticky footer (mt-auto on flex-col).
- NO blue/indigo colors — use the VVU palette (lime/ochre/crimson/sage).
- Loading states on every async operation.
- Toast notifications for user actions.

## Public Promises
- 100% Founder-Owned.
- Constitutional: every claim carries a tier tag. Every tier advance requires a signed artefact.
- Fire never emits PROVEN.
- The chain detects tampering; it does not prove truth (the Oracle Boundary).
