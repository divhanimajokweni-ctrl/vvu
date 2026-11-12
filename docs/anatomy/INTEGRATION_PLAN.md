# Integration Plan: Anatomy with VVU·IVE and ProofBridge

## Recommendation

Start with one visual instrument for the VVU·IVE Evidence Runtime. Do not start by merging Anatomy into the dashboard shell or by building every proposed figure. Prove the state contract with a single figure, then connect real evidence records, and only then generalise the pattern to spatial assets and agriculture.

## Responsibility boundaries

| Concern | Owner | Anatomy's role |
|---|---|---|
| Verification rules and result | VVU·IVE / verification service | Display only |
| Evidence and provenance records | ProofBridge / evidence services | Link to records; never fabricate them |
| Spatial coordinates and map | Spatial application / spatial engine | Show selected asset details; not a replacement map |
| Sensor and device telemetry | Edge/device ingestion service | Display timestamped values with freshness/source indicators |
| Figure geometry and animation | Anatomy figure | Primary responsibility |
| Routes, identity, tenant access | Existing dashboard | Remains unchanged |
| User interaction | Dashboard/application | Figure emits typed intent events; app checks permissions and executes actions |

## Data flow

1. The application fetches an authoritative state snapshot from its existing service.
2. The application passes a minimal, read-only `VisualState` into the adapter.
3. The adapter maps statuses and values; it does not infer missing evidence or recompute proof.
4. The Anatomy figure renders the mapped state.
5. A user selecting a part produces an event such as `open-evidence` or `select-asset`.
6. The application validates the request and opens the relevant record using its normal access-control path.
7. State changes arrive from the service; the visualisation updates from those changes.

Never let a click, animation completion, colour, or local UI toggle change the authoritative verification result.

## Recommended first figure

**Evidence Instrument**: a compact figure that communicates `READY`, `BLOCKED_MISSING_INPUT`, `INCONCLUSIVE`, and `PROVEN` as distinct states. It should expose the reason and evidence references alongside the physical metaphor. Do not encode the whole verification theorem in the renderer; the renderer displays the result produced by the verification service.

## Implementation sequence

### Stage 0 — Inspect and select

- Read `vendor/anatomy/README.md` and `vendor/anatomy/SKILL.md`.
- Open the built `vendor/anatomy/examples/dial-indicator/dial-indicator.html` example.
- Select one figure style as the reference.
- Record upstream commit/hash and retain `vendor/anatomy/LICENSE`.

### Stage 1 — Contract first

- Agree on `VisualState` and event types with the dashboard owner.
- Include `observedAt`, source/freshness status, provenance references, and explicit `simulation` mode where relevant.
- Keep display statuses as a mapping from authoritative statuses, not as independent business logic.
- Build a fixture for every state, including missing/contradictory evidence.

### Stage 2 — One real figure

- Adapt or rebuild the selected Anatomy figure as a component in a small isolated route/panel.
- Reuse the Anatomy kit's geometry/rendering approach; do not rewrite the application shell.
- Use the same data model for readouts and moving parts.
- Make reduced-motion and keyboard interaction work.
- Provide a non-animated textual status that remains available if SVG/WebGL fails.

### Stage 3 — Connect records

- Map evidence IDs and provenance IDs through the service's existing API.
- Render links as references only; enforce access checks in the application/backend.
- Show stale, absent, simulated, and live values differently.
- Preserve the raw authoritative status and reason in an accessible text panel.

### Stage 4 — Reuse

Once the first figure passes the acceptance tests, reuse the host/adapter for:
- Spatial Intelligence: selected map asset → detailed asset figure.
- ProofBridge: pipeline stages → provenance and verification instrument.
- Agriculture: node/equipment → telemetry-driven component view.
- Micro-City: educational/simulated model, clearly separated from production state.

## Repository strategy

Do not vendor the entire Anatomy repository into every project. Keep the upstream source in one place (this starter's `vendor/anatomy/` is a reference copy), record the upstream commit, and either:

- consume only the required modules from a pinned copy/submodule, or
- create a small internal package after confirming licensing, exports, build requirements, and API stability.

Keep VVU-specific adapters and figures outside the upstream directory so upgrades do not overwrite your work.

## Suggested future structure

```text
apps/
  ive-dashboard/
  proof-spatial/
  agri-console/
packages/
  anatomy-renderer/       # only approved/pinned upstream modules
  vvu-visual-contract/    # VisualState + typed interaction events
  vvu-visual-adapters/    # authoritative-state -> visual-state mappings
  vvu-figures/            # EvidenceInstrument, SpatialAsset, EdgeNode
```

This is a target structure, not an assertion about the current repository layout.

## Integration risks to resolve before production

- Confirm actual source module exports and CSS assumptions for the selected figure.
- Confirm SSR/client boundaries if using Next.js; interactive browser APIs must run client-side.
- Test SVG/WebGL fallback on mobile and low-power devices.
- Confirm tenant isolation for every evidence link and event handler.
- Do not render sensitive evidence payloads inside figure attributes or logs.
- Ensure visual state cannot disagree silently with the underlying record; display freshness and last-updated time.
- Treat Anatomy geometric audits as rendering checks, not evidence integrity or physical-model validation.
