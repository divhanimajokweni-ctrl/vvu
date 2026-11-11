"use client";

import { Kicker, SectionHeading, VerdictBadge } from "./primitives";

const RECEIPTS = [
  {
    tier: "FREE_BUILD",
    accent: "amber",
    json: {
      tier: "FREE_BUILD",
      export_licence: "MIT (single-use)",
      persistence: "24h",
      share_lifetime: "168h",
      viewer_limit: 25,
      commercial_use: "prohibited",
      mode: "SIM",
      chain_verdict: "VERIFIED",
      event_count: 4,
    },
  },
  {
    tier: "FREE_DAILY",
    accent: "muted",
    json: {
      tier: "FREE_DAILY",
      export_licence: "not available",
      persistence: "24h",
      share_lifetime: "24h",
      viewer_limit: 3,
      commercial_use: "prohibited",
      watermark: true,
      mode: "SIM",
      chain_verdict: "VERIFIED",
      event_count: 2,
    },
  },
  {
    tier: "COMMERCIAL",
    accent: "emerald",
    json: {
      tier: "COMMERCIAL_LICENCE",
      licence_id: "Vvu-CL-7a3f9c2b",
      payment_rail: "STITCH",
      persistence: "configurable",
      export_licence: "MIT (unrestricted)",
      viewer_limit: "unlimited",
      commercial_use: "permitted",
      chain_verdict: "VERIFIED",
      event_count: 9,
    },
  },
] as const;

const accentBorder: Record<string, string> = {
  amber: "border-amber-brand/40",
  muted: "border-border",
  emerald: "border-emerald-brand/40",
};

export function Receipts() {
  return (
    <section id="receipts" className="scroll-mt-20 border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Kicker>Receipts</Kicker>
        <SectionHeading className="mt-4 max-w-3xl">
          Every receipt states the tier. The chain proves the receipt.
        </SectionHeading>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          A commercial customer shows this to their auditor as proof of legal
          commercial deployment. Every receipt carries the tier, the licence,
          the persistence, and the chain verdict — recomputable from seq 0,
          offline, no API key.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {RECEIPTS.map((r) => (
            <div
              key={r.tier}
              className={
                "overflow-hidden rounded-xl border bg-card " + accentBorder[r.accent]
              }
            >
              <div className="rule-top h-px w-full" />
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-display text-sm font-medium tracking-tight">
                  {r.tier.replace(/_/g, " ")}
                </span>
                <VerdictBadge valid={true} />
              </div>
              <div className="p-4">
                <pre className="scroll-fine overflow-x-auto text-[11px] leading-relaxed text-foreground/80">
                  <code>{JSON.stringify(r.json, null, 2)}</code>
                </pre>
              </div>
              <div className="border-t border-border/60 bg-muted/20 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                GET /api/receipt/&lt;buildId&gt;
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-medium">Independent verification</div>
              <p className="mt-1 text-sm text-muted-foreground">
                The receipt&apos;s <code className="hash text-amber-brand">chain_root</code>{" "}
                is a Merkle-style hash over every event. Anyone with the chain
                JSON can recompute it with{" "}
                <code className="hash text-foreground">sha256</code> + RFC-8785
                JCS — no server, no API key, no trust required.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                recompute
              </div>
              <div className="hash text-xs text-emerald-brand">
                GET /api/chain/&lt;buildId&gt;
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
