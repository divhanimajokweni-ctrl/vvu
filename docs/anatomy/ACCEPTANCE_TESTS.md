# Acceptance Tests Before Production

## State fidelity

- [ ] Each authoritative status maps to exactly one defined display state.
- [ ] `BLOCKED_MISSING_INPUT` never appears as `PROVEN`.
- [ ] `INCONCLUSIVE` remains distinct from failure and success.
- [ ] A render error does not alter the authoritative state.
- [ ] The displayed status and text readout use the same state snapshot.
- [ ] The UI shows when values are simulated, stale, missing, or live.

## Evidence and provenance

- [ ] Every evidence link uses an ID supplied by the authoritative service.
- [ ] The app/backend authorises access to the record when opened.
- [ ] Missing provenance is shown as missing; the renderer does not fill gaps.
- [ ] Timestamps and units are shown for telemetry values.
- [ ] The figure does not claim cryptographic verification unless the service's verified record supports that claim.

## Interaction and accessibility

- [ ] All actionable components can be reached by keyboard or have equivalent controls.
- [ ] State is not communicated by colour alone.
- [ ] A readable text summary exists without animation or WebGL.
- [ ] `prefers-reduced-motion` is respected.
- [ ] Mobile layout remains usable at narrow widths.

## Performance and resilience

- [ ] Measure initial render and update cost on a representative mobile device.
- [ ] Static geometry is not needlessly rebuilt for every telemetry update.
- [ ] Frequent updates are throttled/coalesced where appropriate without losing evidence records.
- [ ] Missing data and network failure produce explicit UI states.
- [ ] WebGL failure degrades gracefully if WebGL is used.

## Release controls

- [ ] Figure interactions cannot trigger release or mutate verification state directly.
- [ ] Tenant/role checks remain in the existing application/backend.
- [ ] No secret or sensitive evidence payload is embedded in client-visible markup.
- [ ] Upstream Anatomy licence and notices are retained.
- [ ] The exact upstream revision and local modifications are documented.
