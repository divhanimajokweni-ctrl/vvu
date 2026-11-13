# ProofBridge Deployment Contract

> Ratified playbook (user-relayed, corrected edition — the Disallow/noindex
> contradiction was caught and fixed before adoption). Recorded verbatim in
> structure; this file is the workspace's authoritative copy for every
> future deploy decision. Workspace Task 27.

## 1. The Distinction

One public identity, multiple infrastructure origins.

Not four websites pretending to be one through canonical tags. The canonical
tag is a hint, not an identity-control mechanism. Hosting identity is
controlled by the domain, the sitemap, and the Search Console property — not
by a `<link>` tag.

## 2. The Architecture

```
https://proofbridge.space-z.ai/           ← canonical, search-facing
   │
   ├── metro/                             ← GitHub Pages
   ├── city-twin/                         ← Netlify
   └── /edge/                             ← Vercel
```

The sub-paths are the contract. Underneath each sub-path, the actual serving
origin is whichever infrastructure provider hosts that project. From the
outside, there is one property.

## 3. Crawler Control — The Correct Hierarchy

**Canonical domain (proofbridge.space-z.ai)** — robots.txt:

```
User-agent: *
Allow: /
Sitemap: https://proofbridge.space-z.ai/sitemap.xml
```

Every HTML page:

```html
<link rel="canonical" href="https://proofbridge.space-z.ai/metro/" />
```

No noindex. This is the only property allowed into the index.

**Clone hosts (GitHub Pages, Netlify, Vercel)** — every HTML page:

```html
<link rel="canonical" href="https://proofbridge.space-z.ai/metro/" />
<meta name="robots" content="noindex, nofollow" />
```

No robots.txt. Or if a robots.txt exists, it must allow crawling of the pages
carrying the noindex. **This is the fix** — the crawler must be able to reach
the page in order to read the directive that keeps it out.

If a clone must be completely crawler-inaccessible (internal staging), then
`Disallow: /` is appropriate — but that is a different mechanism with a
different outcome: the clone becomes invisible to Google entirely, not
redirected to the canonical. Use only when the clone URLs are never intended
to appear anywhere.

> ⚠ The earlier draft's `Disallow: /` + noindex combination was a
> contradiction: a crawler blocked at the robots.txt layer never reaches the
> page, so the noindex is never processed — the clone stays in unmanaged
> limbo, reachable via backlinks or direct submission. Rejected before
> adoption.

## 4. Locked Invariants

| Layer | Value |
|---|---|
| Canonical property | proofbridge.space-z.ai |
| Search Console | proofbridge.space-z.ai only |
| Sitemap | https://proofbridge.space-z.ai/sitemap.xml |
| Search-indexable pages | space-z.ai only |
| Clone SEO directive | noindex, nofollow |
| Clone canonical target | Equivalent space-z.ai path |
| Clone robots.txt | Omitted, or Allow (never Disallow if noindex is the goal) |
| Infrastructure | GitHub Pages / Netlify / Vercel permitted |
| Public navigation | Prefer space-z.ai URLs |
| Search authority | Consolidated around space-z.ai |
| Backlinks from clones | rel="nofollow" to space-z.ai |

## 5. Proxy Architecture — Correction

Sub-path proxying (e.g. vercel.json rewrites) is conceptually valid but NOT
production-ready until tested per route. Known failure modes when a site is
mounted under a sub-path:

- **Asset paths** — `/assets/main.js` resolves to the domain root, not the
  sub-path, unless the site is rebuilt with a base/publicPath for `/metro/`.
- **SPA routing** — routers assuming `/` break under `/metro/`.
- **Redirects** — a 302 from the underlying host can bounce the user out of
  the sub-path.
- **Headers** — CORS/CSP/cache headers on the origin can conflict with the
  proxy host.
- **Relative URLs in HTML** — every `href="/…"` and `src="/…"` points at the
  wrong root.

Until every route passes end-to-end, use **subdomains**:

```
metro.proofbridge.space-z.ai
city-twin.proofbridge.space-z.ai
edge.proofbridge.space-z.ai
```

Subdomains avoid the base-path problem entirely; slightly less consolidated
SEO weight than sub-paths, but the correct intermediate step — and they
still satisfy "one public identity" via canonical tags + sitemap pointing at
proofbridge.space-z.ai.

## 6. Order of Operations (agent-ready)

1. Register proofbridge.space-z.ai. Point DNS at the primary host.
2. Deploy each project to its infrastructure origin.
3. Add canonical + noindex, nofollow to every HTML page on each clone.
4. Remove any `Disallow: /` robots.txt from clones — or leave the file absent.
5. Publish robots.txt and sitemap.xml on the canonical domain only.
6. Register proofbridge.space-z.ai in Search Console. Do not register clones.
7. Submit the sitemap. Wait for the first crawl pass.
8. Verify in Search Console that only canonical URLs appear in the index.
9. If using sub-path proxies: test every route, every asset, every internal
   link before shipping.
10. If proxies fail: switch to subdomains. Re-test. Re-verify.

## 7. What "Correct" Looks Like After Two Weeks

- space-z.ai appears in search results.
- The clones do not appear in search results.
- The clones do not harm the canonical property's ranking.
- Search Console confirms the canonical tags were processed.
- No "Duplicate, submitted URL not selected as canonical" warnings.

If the last two fail, the crawler could not see the directive — the
deployment contract has been violated.

## 8. The Invariant Behind All of This

Search authority consolidates around one property at a time. You can move
that property — github.io → space-z.ai → elsewhere — but you cannot split it
across two. The moment two properties compete, both lose.

**One public identity. Multiple infrastructure origins. One owner of the
index.**

---

## Workspace implementation notes (not part of the ratified contract)

- **Current state (Task 27): pre-step-1.** The domain is not registered; no
  canonical tags have been added to any workspace artifact (a canonical
  pointing at a non-existent domain would be worse than none). The contract
  is recorded now so the tags land correctly the moment the domain exists.
- **Deployable artifacts in this workspace**: `public/Vvu-Trust-Sphere.html`
  (live-wired standalone dashboard), `public/pinned-rail.html` (telemetry
  rail component). Both are served at their paths from the dev origin and
  are git-tracked. When deployed as clones they get the §3 clone treatment.
- **Credentials rule (user-ratified, standing)**: no tokens in chat —
  exposed means revoked/rotated. Deploys to GitHub Pages happen user-side
  (browser upload or a credential provisioned on the pushing machine).
- **SEO meta tags are NOT added yet** to the workspace statics — see the
  current-state note above; do it at step 3 of the order of operations.
