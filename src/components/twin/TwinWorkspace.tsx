'use client';

// src/components/twin/TwinWorkspace.tsx — ROUND 34 · fifteenth projection
// #/twin — TWIN · MUNICIPAL SCENARIO (the first scenario surface).
//
// The operator delivered cape_town_wildfire.html as a single standalone file:
// golden-hour sky, Table Mountain silhouette, active burn polygon, smoke
// plume, SE wind vectors, evacuation zones + flowing routes, 214 pulsing
// mesh dots, municipal asset pins, layer toggles, WORM ticker. Zero deps,
// zero API calls, runs offline. This projection frames it exactly as a
// browser tab would — served byte-for-byte from vvu-trust/surfaces/twin/
// scenarios/ via /api/vvu/twin-scenario (the repo file IS the source; this
// view does not fork it, does not restyle it, does not inject into it).
//
//   · header band   — scenario identity + form-factor chips
//   · viewport      — the scenario itself (iframe, wheel zoom works inside)
//   · provenance rail — disk-canonical path + bytes, the SEED DATA · NOT
//     LIVE honesty chip (mesh positions are seeded — the live wiring to the
//     pipeline engine is the named next artifact), the WORM LEDGER PIN
//     (Option 1: runtime toggle of the artifact's own #hud-bottom via
//     contentDocument — the artifact bytes stay untouched), OPEN STANDALONE
//     (the drop-it-in-a-browser path, WORM-logged)
//
// Every view entry and every standalone open is WORM-logged (ledger →
// audit table) like every other projection. The rail also lifts the
// scenario's own WORM bar clear of the lime workspace toggle.

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, FileCode2, Flame } from 'lucide-react';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { WormLedgerPin } from './components/WormLedgerPin';
import './components/WormLedgerPin.css';

const SCENARIO_ID = 'cape_town_wildfire';
const SCENARIO_URL = `/api/vvu/twin-scenario?scenario=${SCENARIO_ID}`;

type ScenarioMeta = {
  id: string;
  path: string;
  bytes: number;
  title: string;
  mtime: string;
  // Task 48 merge — the route also returns md5 (disk-computed integrity
  // fact, carried by the pre-recovery TwinFrame rail); typed + rendered
  // here so the recovery loses nothing.
  md5: string;
};

async function fetchScenarioMeta(): Promise<ScenarioMeta> {
  const res = await fetch(`${SCENARIO_URL}&meta=1`);
  if (!res.ok) throw new Error(`scenario meta HTTP ${res.status}`);
  return res.json() as Promise<ScenarioMeta>;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

// ─── The workspace ──────────────────────────────────────────────────────────

export function TwinWorkspace() {
  const sendWormLog = useSendWormLog();
  const [loaded, setLoaded] = useState(false);
  // The WORM pin reaches into the same-origin iframe via contentDocument —
  // the frame needs a stable ref for that (and for re-application on load).
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // View entry is WORM-logged like every projection (append-only, no silent views).
  useEffect(() => {
    sendWormLog(
      'VIEW_MODE',
      'TWIN',
      `#/twin opened — ${SCENARIO_ID} scenario rendering byte-for-byte from disk`
    );
  }, [sendWormLog]);

  const meta = useQuery({
    queryKey: ['twin-scenario-meta', SCENARIO_ID],
    queryFn: fetchScenarioMeta,
    staleTime: 30_000,
    retry: 1,
  });

  const openStandalone = () => {
    // The operator's own framing: "drop it in a browser. It renders
    // standalone." This is that path — new tab, raw document, zero app
    // chrome. WORM receipt first, then the tab.
    sendWormLog(
      'SCENARIO_STANDALONE_OPEN',
      'OPERATOR',
      `${SCENARIO_ID} opened standalone (raw document, new tab)`
    );
    fetch('/api/vvu/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: 'OPERATOR',
        action: 'SCENARIO_STANDALONE_OPEN',
        fromState: 'TWIN_VIEW',
        toState: 'TWIN_VIEW',
        symbol: 'OPEN',
        reason: `${SCENARIO_ID} opened standalone from #/twin`,
      }),
    }).catch(() => {
      /* offline — audit is best-effort */
    });
    toast.success('SCENARIO · STANDALONE TAB', {
      description: 'WORM SCENARIO_STANDALONE_OPEN appended to ledger',
    });
    window.open(SCENARIO_URL, '_blank', 'noopener');
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a0e17] text-[#e0e6ed]">
      {/* ── header band — scenario identity ── */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] px-3">
        <Flame className="h-3.5 w-3.5 shrink-0 text-[#ff5a3d]" aria-hidden="true" />
        <span className="vvu-label truncate text-[10px] font-bold text-[#f2b84b]">
          TWIN · MUNICIPAL SCENARIO
        </span>
        <span className="vvu-label hidden truncate text-[8px] text-[#7f95a5] md:inline">
          CAPE TOWN WILDFIRE · DEVILS PEAK · SE SLOPE · WARD 62
        </span>
        <div className="flex-1" />
        <span className="vvu-label hidden rounded-sm border border-[#1f3a4a] px-2 py-1 text-[8px] text-[#58a6ff] sm:inline">
          SINGLE FILE · ZERO DEPS
        </span>
        <span className="vvu-label hidden rounded-sm border border-[#1f3a4a] px-2 py-1 text-[8px] text-[#52b788] lg:inline">
          OFFLINE · NOTHING LEAVES THE PAGE
        </span>
        {meta.data && (
          <span className="vvu-label rounded-sm border border-[#1f3a4a] px-2 py-1 text-[8px] text-[#7f95a5]">
            CANVAS 2D · {formatBytes(meta.data.bytes)}
          </span>
        )}
      </div>

      {/* ── the scenario itself — rendered exactly as a browser tab would ── */}
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          src={SCENARIO_URL}
          title="Cape Town Wildfire — Municipal Twin"
          className="absolute inset-0 h-full w-full border-0"
          onLoad={() => setLoaded(true)}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e17]">
            <div className="text-center">
              <div className="vvu-label text-2xl font-bold tracking-[0.3em] text-[#f2b84b]">
                TWIN
              </div>
              <div className="vvu-label mt-3 animate-pulse text-[9px] text-[#7f95a5]">
                LOADING SCENARIO FROM DISK…
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── provenance rail — disk-canonical, seed-data honest ── */}
      <div className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] px-3 py-2.5">
        <span className="vvu-label inline-flex items-center gap-1.5 text-[8px] text-[#7f95a5]">
          <FileCode2 className="h-3 w-3 shrink-0 text-[#58a6ff]" aria-hidden="true" />
          {meta.data ? (
            <>
              DISK-CANONICAL · {meta.data.path} · {meta.data.bytes.toLocaleString('en-ZA')} B · md5{' '}
              {meta.data.md5.slice(0, 8)}…
            </>
          ) : (
            <>DISK-CANONICAL · vvu-trust/surfaces/twin/scenarios/…</>
          )}
        </span>
        <span
          className="vvu-label rounded-sm border border-[rgba(242,184,75,0.4)] bg-[rgba(242,184,75,0.07)] px-2 py-1 text-[8px] text-[#f2b84b]"
          title="The mesh dots are seeded positions, not live member devices — the operator's own note. The live wiring (pipeline engine → real member devices) is the named next artifact."
        >
          SEED DATA · NOT LIVE — LIVE WIRING IS THE NEXT ARTIFACT
        </span>
        <span className="vvu-label hidden text-[8px] text-[#7f95a5] sm:inline">
          LAYERS 7 · TOGGLE INSIDE THE FRAME · MOUSE WHEEL ZOOMS
        </span>
        <div className="ml-auto mr-40 flex items-center gap-2 sm:mr-[13rem]">
          {/* mr-40 / sm:mr-[13rem] — reserves the lime workspace toggle's
              fixed footprint (bottom-right, z-60, widest label
              "◂ MAP_TWIN : OPERATOR" ≈ 190px + margin) so this interactive
              control is never covered by it. Measured, not guessed. */}
          {/* the pin sits LEFT of OPEN STANDALONE (8px = the cluster's
              gap-2) — never near the lime toggle (201px already reserved) */}
          <WormLedgerPin iframeRef={iframeRef} />
          <button
            type="button"
            onClick={openStandalone}
            aria-label="Open the scenario standalone in a new tab"
            className="vvu-label inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-[#1f3a4a] bg-[rgba(88,166,255,0.06)] px-3 text-[9px] text-[#58a6ff] transition-all select-none hover:border-[#58a6ff] hover:bg-[rgba(88,166,255,0.12)] active:scale-[0.97]"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            OPEN STANDALONE
          </button>
        </div>
      </div>
    </div>
  );
}
