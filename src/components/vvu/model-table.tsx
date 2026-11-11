"use client";

import { Check, Minus, Sparkles } from "lucide-react";
import { Kicker, SectionHeading } from "./primitives";

type Row = {
  label: string;
  freeBuild: string;
  freeDaily: string;
  commercial: string;
};

const ROWS: Row[] = [
  { label: "Builds", freeBuild: "1, first ever", freeDaily: "1 / day", commercial: "Unlimited" },
  { label: "Share lifetime", freeBuild: "7 days", freeDaily: "24 hours", commercial: "Min 30 days, configurable" },
  { label: "Max viewers", freeBuild: "25", freeDaily: "3", commercial: "Unlimited" },
  { label: "Simultaneous links", freeBuild: "1", freeDaily: "1", commercial: "Unlimited" },
  { label: "Obsidian export", freeBuild: "MIT, once", freeDaily: "Not available", commercial: "Unrestricted" },
  { label: "Raw twin storage", freeBuild: "24 h TTL", freeDaily: "24 h TTL", commercial: "Configurable" },
  { label: "Watermark", freeBuild: "No", freeDaily: "Yes", commercial: "No" },
  { label: "Commercial use", freeBuild: "Prohibited", freeDaily: "Prohibited", commercial: "Licensed" },
  { label: "Compute", freeBuild: "Puter.js", freeDaily: "Puter.js", commercial: "HostAfrica → bare metal" },
];

const CARDS = [
  {
    tier: "FREE_BUILD",
    name: "Free — first build",
    tagline: "The one you keep.",
    accent: "amber",
    price: "R0",
    blurb:
      "One build, ever. Share it to 25 people for 7 days. Export to Obsidian under MIT — yours forever.",
    footnote: "No card, no signup. The freedom guarantee.",
  },
  {
    tier: "FREE_DAILY",
    name: "Free — daily",
    tagline: "The habit loop.",
    accent: "muted",
    price: "R0",
    blurb:
      "After the first build, one per day. 24-hour share, 3 viewers, no export. Resets at midnight.",
    footnote: "Value is felt when you hit the wall.",
  },
  {
    tier: "COMMERCIAL",
    name: "Commercial licence",
    tagline: "Where money starts.",
    accent: "emerald",
    price: "from R490",
    blurb:
      "Commercial use, persistent deployment, unrestricted export, configurable shares. Stitch or Paystack.",
    footnote: "The receipt your auditor accepts.",
  },
] as const;

const accentMap: Record<string, string> = {
  amber: "border-amber-brand/40 text-amber-brand",
  muted: "border-border text-muted-foreground",
  emerald: "border-emerald-brand/40 text-emerald-brand",
};

export function ModelTable() {
  return (
    <section id="model" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Kicker>The one-page model</Kicker>
        <SectionHeading className="mt-4 max-w-3xl">
          Free build, daily builds, commercial gate.
        </SectionHeading>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          The free build is a product, not a trial. It has real value — publish a
          twin, extract to Obsidian — and deliberate limits. You hit the wall
          of the free product; that&apos;s when you pay. Not because we asked.
        </p>

        {/* tier cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CARDS.map((c) => (
            <div
              key={c.tier}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider " +
                    accentMap[c.accent]
                  }
                >
                  {c.tier === "COMMERCIAL" && <Sparkles className="size-3" />}
                  {c.name}
                </span>
                <span className="font-display text-sm text-muted-foreground">
                  {c.price}
                </span>
              </div>
              <div className="mt-4 font-display text-lg font-medium tracking-tight">
                {c.tagline}
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {c.blurb}
              </p>
              <div className="mt-4 border-t border-dashed border-border pt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                {c.footnote}
              </div>
            </div>
          ))}
        </div>

        {/* comparison table */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pr-4 font-medium text-muted-foreground">
                  Limit
                </th>
                <th className="px-4 py-3 font-medium text-amber-brand">
                  Free first build
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Free daily
                </th>
                <th className="px-4 py-3 font-medium text-emerald-brand">
                  Commercial
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr
                  key={r.label}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-3 pr-4 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.freeBuild}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.freeDaily}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.commercial}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* the one-sentence band */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="rule-top h-px w-full" />
          <div className="flex items-start gap-4 p-6 sm:items-center">
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-amber-brand/40 bg-amber-brand/10 sm:flex">
              <Check className="size-5 text-amber-brand" />
            </div>
            <p className="font-display text-lg font-light leading-snug tracking-tight sm:text-xl">
              One free build, shareable to 25 people for 7 days, exportable to
              Obsidian under MIT forever. After that, daily builds reset every
              24 hours. Commercial use pays. Every receipt proves which of those
              you&apos;re on, and the chain proves the receipt.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Minus className="size-3" />
          No persistent storage on free tiers. Raw twins are deleted per TTL —
          the Obsidian export is the only permanent artefact.
        </div>
      </div>
    </section>
  );
}
