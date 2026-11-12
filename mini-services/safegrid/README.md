# SafeGrid API Server (port 3008)

The **producer** side of the SafeGrid → VVU transactional-outbox pipeline (Round 57).

- **Stack**: Bun + Express 5 + Drizzle ORM over `bun:sqlite` (WAL). The spec names Postgres; this sandbox has none — mapping disclosed in `src/db/schema.ts` and worklog R57.
- **Port**: `3008` (default; `SAFEGRID_PORT` override for the test harness).
- **DB**: `data/safegrid.db` (`SAFEGRID_DB_PATH` override). Idempotent migrations in `src/db/migrations/` run at boot.
- **Pipeline**: `POST /v1/alerts` → §4 policy decision (fail-closed) → ONE transaction `{safegrid_decision + integration_outbox}` → relay worker claims (atomic single-statement lease, `FOR UPDATE SKIP LOCKED` semantics on SQLite) → POST to VVU `/api/safegrid/inbox` → idempotent seal on the VVU WORM chain.
- **Ordering contract**: the WORM chain's append order is the authoritative stream order. The payload carries **no `sequence` field**; `local_decision_id` is local insertion order, diagnostic only. No timestamp establishes order anywhere.
- **Admin/test hooks** (disclosed, used by the acceptance suite + QA demo): `/v1/admin/policy`, `/v1/admin/consent`, `/v1/admin/vvu-health`, `/v1/admin/relay`, `/v1/outbox/relay/tick`, `/v1/outbox/failed/requeue`.

Run: `bun run dev` (auto-restart on change via `bun --hot`).
