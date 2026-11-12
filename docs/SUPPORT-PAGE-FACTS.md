# VVU SUPPORT PAGE — FACTS (system facts, measured)

r32 (operator deliverable 4). Every number below is MEASURED on this box
(2026-09-30, worklog r28/r30/r32) or names its source. Nothing here is a
claim of compliance or certification. The BUSINESS facts (funding target,
gateway, entity details) live in SUPPORT-PAGE.md and remain TO_BE_FILLED
until the operator fills them — this file does not guess them.

## System requirements (measured basis)

- **RAM:** 4 GB is the floor this estate runs on today (MemTotal
  4,138,564 kB ≈ 3.95 GiB, measured r30/r32). HONEST FINDING (r30/r32):
  the box is measured oversubscribed — two Next.js dev servers (main
  ~1.47 GiB idle + IVE ~0.62 GiB), a platform runtime (~0.5 GiB), and six
  mini-services leave ~0.5–0.8 GiB headroom, while build/scan peaks need
  ~0.8 GiB → deficit at peaks; the kernel OOM-killed the main server 12+
  times before the guardian was armed (r28/r30, dmesg-proven). For this
  workload shape: **8 GB recommended**, 4 GB minimum (at 4 GB the
  guardian converts memory spikes into controlled ~15 s bounces —
  measured r30).
- **CPU:** 2 cores (measured, `nproc`).
- **Disk:** ~10 GB volume, ~6 GB free at measure time (2026-09-30).

## Known issues (honest, current)

- **OOM deaths (main dev server):** under build/scan memory peaks the
  kernel OOM-killer has killed the main next-server (12+ deaths,
  dmesg-evidenced, r24–r30). MITIGATION ARMED r30: the estate guardian
  (memory rails + controlled bounce, downtime ~15 s measured) and a
  30 s death-watcher that captures evidence
  (~/vvu/logs/server-deaths/) and auto-restarts. The structural fix
  (one server off-box, or more RAM) is PENDING OPERATOR DECISION (A/B/C,
  worklog r32).
- **Round-lock holder race (historical):** nohup lock holders were
  killed by the session reaper, producing dead-pid locks with no mutual
  exclusion. AMENDED r32 (RULINGS.md §4): holders now run via
  daemonize.py (double-fork) — verified alive across rounds.

## Contact

- Operator: [TO_BE_FILLED — operator-only field, not guessed]
- Repository (designated remote per RUNNER-SCOPE.md):
  github.com/divhanimajokweni-ctrl/main — push NOT yet wired (openssh
  absent from this box; SSH deploy key not generated; local-commits-only
  until the operator installs openssh-client and registers the key).

## Provenance

- Measurements: worklog r28 (dmesg OOM proof), r30 (memory budget,
  guardian armament, bounce downtimes), r32 (2 CPU / 4 GB / disk free,
  195 MB available in a quiet window, convergence re-arm).
- This file lists FACTS for the future support page; it is not the
  support page itself (SUPPORT-PAGE.md is the spec — do not build ahead
  of it).
