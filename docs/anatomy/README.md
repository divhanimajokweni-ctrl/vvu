# Anatomy × VVU / ProofBridge — Integration Starter

This package is a practical integration blueprint built around the supplied Anatomy repository. It keeps Anatomy as a rendering/authoring capability and keeps VVU·IVE / ProofBridge authoritative for application state, evidence, verification and release decisions.

## Start here (no terminal required)

1. Unzip this folder.
2. Open `examples/evidence-instrument/index.html` in a browser.
3. Use the state buttons to see how an evidence instrument should reflect changes in application state. This is a lightweight integration-contract prototype, not a production verification engine and not yet rendered with Anatomy geometry.
4. Open `vendor/anatomy/examples/dial-indicator/dial-indicator.html` (or another built HTML example) to inspect a real Anatomy figure from the supplied repository.
5. Read `docs/INTEGRATION_PLAN.md` before asking a coding agent to connect the two.

## Intended architecture

- **VVU·IVE / ProofBridge:** authoritative state, evidence, provenance, verification rules and release decisions.
- **State adapter:** converts the authoritative state into a small, typed visual state contract.
- **Anatomy figure:** renders the state and emits user interaction events. It must not make verification decisions.
- **Dashboard shell:** owns routes, auth, tenant boundaries, navigation and evidence-record links.

## What's included

- `vendor/anatomy/`: the complete supplied Anatomy repository, including its licence, skill, kit, examples and tests.
- `examples/evidence-instrument/`: a browser-openable interactive contract demo with clearly labelled illustrative data.
- `src/contracts/visual-state.ts`: proposed TypeScript contract.
- `src/adapters/map-verification-state.ts`: pure mapping example from authoritative status to display state.
- `src/components/AnatomyFigureHost.tsx`: framework-neutral-in-intent React host scaffold. The Anatomy figure itself is deliberately a placeholder until one specific Anatomy example is selected and adapted.
- `docs/INTEGRATION_PLAN.md`: recommended integration sequence and architecture boundaries.
- `docs/ACCEPTANCE_TESTS.md`: checks for state fidelity, accessibility, provenance, and performance.
- `docs/PROJECT_MAP.md`: how the same adapter pattern can serve Spatial Intelligence, Evidence Runtime, ProofBridge, and agriculture.

## Important status labels

This is an **integration starter**, not a claim that Anatomy has already been wired into VVU·IVE, ProofBridge, a spatial engine, sensors, or a production dashboard. All sample values are fictional. No verification result is computed here.

## Runtime notes

The Anatomy README specifies Node.js >=20.10 for its tooling and describes the core kit as using Node built-ins without runtime dependencies. React/Next.js integration uses the source modules under `vendor/anatomy/kit/react/` and `vendor/anatomy/kit/`; validate the exact imports/build process against your app's versions before adopting them. Do not copy the entire vendor repository into every product. Keep one tracked source or versioned internal package and consume only the components needed by each app.
