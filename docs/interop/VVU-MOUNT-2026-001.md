# VVU MOUNT CONTRACT

**Ref:** VVU-MOUNT-2026-001 · **Version:** 1.0 · **Date:** 15 October 2026 · **Status:** Architecture (specified). The dock, mount adapter, worker and service-worker template are implemented in this bundle and tested in jsdom only; no real browser install or orchestrator has exercised them.
**Parent:** VVU-SF-2026-001 · **Vocabulary:** VVU-GLOSS-2026-001
**Scope rule:** this document describes what a **sub-app** promises and what any **host** may rely on. It names no particular host. The main orchestrator was not available while this was written, so nothing here is claimed to match it. Where it differs, the host adapts to this contract or the contract is amended by version; sub-apps do not bend.

## 1. Four promises of a sub-app
1. **Standalone.** One HTML file, opens from `file://`, works offline, needs no host, no network, no other environment (SF §1.2). Hosted mode only adds transport.
2. **Own store.** Native working data stays in the app's own store. Cross-boundary data lives in IndexedDB `vvu.<env>.interop` only (kinds: artefacts, transitions, rejections, outbox, keys, meta). A host never reads either store; it receives bytes the sub-app chooses to send.
3. **Own decisions.** The sub-app runs `receivePackage()` itself. A host cannot make it accept anything and cannot upgrade a status. Transport is not authority (Doctrine, SF §6.3).
4. **Own scope.** Installable by itself at `/<env>/` with its own manifest, service worker and cache namespace `vvu.<env>.shell.<version>`.

## 2. Topology
```
origin
├── /                 host shell (manifest id "/", scope "/")           <- owned by the orchestrator, out of scope here
├── /forge/  /bench/  /fire/  /field/  /press/
│     each: index.html  manifest.webmanifest (id "/<env>/", scope "./")  sw.js (scope "./")  icons  vvu-core.js  vvu-worker.js
└── /<anything>/.vvu/keys.json   optional host-published public-key directory (§5)
```
A service worker with the longer scope controls its own pages, so a root worker never intercepts a sub-app and a sub-app worker never intercepts the root. Each worker deletes only caches starting `vvu.<env>.shell.` and never answers package traffic.

## 3. Mount descriptor
`mount-descriptor.json` is plain data, read by whatever orchestrator exists: per app `id`, `scope`, `start_url`, `manifest`, `service_worker`, `worker`, `interop_store`, `native_store_key`, `bus`, `supported_envelope_versions`, `failure_declaration`. Nothing in a sub-app reads it.

## 4. Bus protocol (BroadcastChannel `vvu.bus.v1`, protocol 1)
Message: `{vvu:1, kind, from:{env,instance_id}, to:null|{env,instance_id}, payload}`. Unknown kinds are ignored.

| kind | direction | payload | rule |
|---|---|---|---|
| `hello` | app → any | `nonce, supported_envelope_versions` | no `hello.ack` within 600 ms ⇒ **standalone**, which is a full mode |
| `hello.ack` | host → app | `nonce` | echoes the nonce; app switches to hosted |
| `package.offer` | app → host | `package_digest, manifest, exported_by` | manifest only; contents never broadcast |
| `package.request` | host → app | `{package_digest}` | app answers with `package.deliver` or stays silent |
| `package.deliver` | either | `{package}` (SF §8) | receiver runs its own full pipeline (SF §4.5) |
| `package.result` | app → sender | `package_digest, summary` | summary is informational; the sender gains no authority |
| `keys.get` / `keys.result` | app ↔ host | `operator_id` / `public_key (base64url) or null` | null or timeout ⇒ unresolved ⇒ `REJECTED_SIGNATURE_UNRESOLVED`, never "valid" |

A host MAY relay `package.deliver` between apps. It MUST NOT modify a package, re-label a status, or synthesise `package.result`.

## 5. Keys
SF §4.3 leaves key publication to each environment. Mount contract: a sub-app that signs exports its **public** key as `{operator_id: base64url(32 bytes)}`; receivers hold a local keyring (`vvu.<env>.keyring`) and MAY also ask a host via `keys.get`. A receiver never trusts a key because a package carried it. Private keys never leave the signing app and never enter a package, a bus message or a descriptor.

## 6. Worker
`vvu-worker.js` runs `verifyPackage`, `receivePackage` and `digest` off the UI thread using the same `vvu-core.js`, so a page, a worker and the CLI return identical answers. It touches no storage. Message shapes are in the file header.

## 7. Conformance of a sub-app to this contract
| ID | Assertion | Executed by |
|---|---|---|
| MT-01 | Opens and completes its primary function from `file://` with no host | NOT RUN (browser) |
| MT-02 | With no `hello.ack` the app reports `standalone` and every feature still works | jsdom: boots; hosted path NOT RUN |
| MT-03 | Imported text is never interpreted as HTML | by construction (`textContent` only); not adversarially tested |
| MT-04 | A package whose manifest was altered is refused before any artefact is read | core CF-27 |
| MT-05 | Unknown `kind`, wrong `vvu` version or foreign `to` is ignored | by code reading; NOT RUN |
| MT-06 | Service worker never deletes or reads another environment's cache | by code reading; NOT RUN |
| MT-07 | A host answering `package.result` cannot change a stored status | core CF-22 (store refuses in-place change) |

Fire is the natural executor of MT-01..07 once a real browser harness exists.
