# VVU COLONY SPEC — System Blueprint

**Status:** Tier 1 — Active

## Architecture
5 environments (Forge/Bench/Fire/Field/Press) on a shared artefact-envelope foundation, deployed across 5 asset types (water/phone/vehicle/fleet/SDK), priced inside a fixed band (R9–R9,999).

## Database
- Prisma + SQLite (`prisma/schema.prisma`)
- 19+ models: Policy, Shard, MergeProposal, AncestryProof, InvariantViolation, ShadowEvent, MinedInvariant, Device, EvidenceRecord, Witness, AuditEvent, Subscription, User, UserSettings, UserSession, ApiKey, Invoice, Contribution, ChangelogEntry, RoadmapItem, DocPage, Incident

## API Endpoints
- Core: /api/stats, /api/policies, /api/shards, /api/merges, /api/proofs, /api/violations
- Workspace: /api/account, /api/settings, /api/devices, /api/subscriptions, /api/dev/*
- License: /api/license, /api/license/:orgId/edge, /api/license/:orgId/verify
- REA: /api/rea/* (proxy to :3034)
- Shell: /api/shell/* (planned — mount, command, clipboard)

## Event Types
- Debugger (:3098): http, console, error, span, metric, custom, system
- Event-bus (:3032): transition, violation, merge, shadow, shard
- Worm-nest (:3003): snapshot, evidence, worm, chain-head, eis
- REA (:3034): rea_finding (sealed pointer to debugger)

## Deployment Pipeline
- CI: lint + golden-rule + dashboard-validator + boundaries + type-check
- Deploy: gated on CI passing, `bun run db:push` with prod secret
- Security audit: weekly Monday cron
- License regen: manual workflow_dispatch

## File Structure
```
src/app/          — Next.js 16 App Router (page.tsx + api/)
src/lib/          — crypto, epd, runtime, vvu, shell, interop, hbk, workspace
src/components/   — epistemic, workspace, ui
mini-services/    — epd-cli, event-bus, worm-nest, rea, debugger
shared/license/   — license-schema, validator, rea-gate
fire/             — FIRE.html (adversarial testing environment)
docs/             — architecture, governance, shell contract, plans
policies/         — (planned) verification policy registry
schemas/          — (planned) vvu-envelope.schema.json + artefact schemas
```

## Mini-Services
| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Next.js | Dashboard |
| 3003 | worm-nest | WORM hash-chained evidence stream |
| 3031 | epd-cli | .epd policy DSL validator |
| 3032 | event-bus | Socket.IO real-time events |
| 3034 | rea | Reverse-Engineering Agent (observe-only) |
| 3098 | debugger | Native WORM tracer |
