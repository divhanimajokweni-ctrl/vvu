"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { VerdictBadge } from "./primitives";
import { shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type ChainEvent = {
  seq: number;
  eventType: string;
  payload: string;
  sourceHash: string;
  chainHash: string;
};

type Verdict =
  | { valid: true; root: string }
  | { valid: false; brokenAt: number; reason: string };

const EVENT_TONE: Record<string, string> = {
  TWIN_BUILT: "text-amber-brand",
  TWIN_SHARED: "text-amber-brand",
  SHARE_VIEWED: "text-emerald-brand",
  SHARE_REVOKED: "text-clay-brand",
  SHARE_EXPIRED: "text-clay-brand",
  SHARE_EXHAUSTED: "text-clay-brand",
  TWIN_EXPORTED: "text-emerald-brand",
  TWIN_DELETED: "text-muted-foreground",
  COMMERCIAL_LICENCE_ISSUED: "text-emerald-brand",
};

export function ChainPanel({
  buildId,
  refreshKey,
}: {
  buildId: string | null;
  refreshKey: number;
}) {
  const [events, setEvents] = React.useState<ChainEvent[]>([]);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!buildId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chain/${buildId}`, { cache: "no-store" });
      const data = (await res.json()) as {
        events: ChainEvent[];
        verdict: Verdict;
      };
      setEvents(data.events ?? []);
      setVerdict(data.verdict ?? null);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  React.useEffect(() => {
    load();
    if (!buildId) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [buildId, refreshKey]);

  if (!buildId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        No build yet. The chain appears here as events are appended.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="rule-top h-px w-full" />
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            WORM chain
          </span>
          {verdict && <VerdictBadge valid={verdict.valid} />}
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          recompute
        </button>
      </div>

      {verdict && (
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">root</span>
            <span className="hash text-foreground">
              {verdict.valid
                ? shortHash(verdict.root, 18, 12)
                : `BROKEN @ ${verdict.brokenAt} · ${verdict.reason}`}
            </span>
          </div>
        </div>
      )}

      <div className="scroll-fine max-h-[28rem] overflow-y-auto">
        {events.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Awaiting first event…
          </div>
        )}
        <ol className="divide-y divide-border/50">
          {events.map((e) => (
            <li key={e.seq} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="hash text-[10px] text-muted-foreground">
                  [{String(e.seq).padStart(3, "0")}]
                </span>
                <span
                  className={cn(
                    "hash text-[11px] font-semibold",
                    EVENT_TONE[e.eventType] ?? "text-foreground"
                  )}
                >
                  {e.eventType}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-muted-foreground">source</span>
                <span className="hash text-foreground/80">
                  {shortHash(e.sourceHash, 14, 8)}
                </span>
                <span className="text-muted-foreground">chain</span>
                <span className="hash text-foreground/80">
                  {shortHash(e.chainHash, 14, 8)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        SHA-256 · RFC-8785 JCS · Ed25519-signed tokens · offline-verifiable
      </div>
    </div>
  );
}
