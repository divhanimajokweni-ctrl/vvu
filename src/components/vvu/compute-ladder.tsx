"use client";

import { Cpu, Server, HardDrive, TrendingUp } from "lucide-react";
import { Kicker, SectionHeading } from "./primitives";

const STAGES = [
  {
    n: "01",
    name: "Puter.js",
    role: "Client-side compute",
    infra: "The browser does the work",
    rev: "R0 marginal cost",
    grad: "Day 1 — every free build runs here",
    icon: Cpu,
    tone: "amber",
    current: true,
  },
  {
    n: "02",
    name: "HostAfrica affiliate",
    role: "Heavy compute via affiliate link",
    infra: "HostAfrica deployments, rev share to you",
    rev: "5–20% rev share",
    grad: "Until 20 paying customers",
    icon: TrendingUp,
    tone: "amber",
    current: false,
  },
  {
    n: "03",
    name: "Reseller",
    role: "Resell HostAfrica at markup",
    infra: "Negotiated reseller pricing",
    rev: "20–30% margin",
    grad: "Until 100 customers, or R5,000/mo projects",
    icon: Server,
    tone: "emerald",
    current: false,
  },
  {
    n: "04",
    name: "Own bare metal",
    role: "Colocate with HostAfrica",
    infra: "You own the hardware",
    rev: "Full margin",
    grad: "When hosting > R15,000/mo for 3 months",
    icon: HardDrive,
    tone: "emerald",
    current: false,
  },
] as const;

const COST = [
  { c: "Puter.js compute (client-side)", v: "R0", note: "their browser" },
  { c: "Storage (24h TTL, ~100MB)", v: "~R0.50/mo", note: "amortized" },
  { c: "DNS on *.vvu.co.za", v: "R0", note: "wildcard" },
  { c: "Email (verification, deletion)", v: "~R2/mo", note: "" },
];

const toneMap: Record<string, string> = {
  amber: "border-amber-brand/40",
  emerald: "border-emerald-brand/40",
};

export function ComputeLadder() {
  return (
    <section id="compute" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Kicker>Compute ladder</Kicker>
        <SectionHeading className="mt-4 max-w-3xl">
          Puter.js first. HostAfrica affiliate → reseller → bare metal.
        </SectionHeading>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          The free tier runs on client-side compute — near-zero marginal cost to
          us. Heavy projects route through HostAfrica where we earn rev share.
          Bare metal is a Stage 3 conversation, not Stage 1: “I&apos;m already
          generating R15k/mo of HostAfrica revenue — here&apos;s what a direct
          deal looks like.”
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className={
                  "relative flex flex-col rounded-xl border bg-card p-5 " +
                  toneMap[s.tone]
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-light text-muted-foreground">
                    {s.n}
                  </span>
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="mt-3 font-display text-lg font-medium tracking-tight">
                  {s.name}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.role}
                </div>
                <dl className="mt-4 flex-1 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Infra</dt>
                    <dd className="text-right">{s.infra}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Revenue</dt>
                    <dd className="text-right">{s.rev}</dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
                  Graduate when: {s.grad}
                </div>
                {s.current && (
                  <span className="absolute -right-2 -top-2 rounded-full border border-amber-brand/40 bg-amber-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-brand">
                    now
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* free-tier cost model */}
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Free-tier cost per user
            </div>
            <table className="w-full text-sm">
              <tbody>
                {COST.map((c) => (
                  <tr key={c.c} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{c.c}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{c.v}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">
                      {c.note}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30">
                  <td className="px-4 py-3 font-semibold">Total / user / month</td>
                  <td className="px-4 py-3 text-right font-display text-base text-amber-brand">
                    ~R3
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-muted-foreground">
                    self-limiting via TTL
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Breakeven
            </div>
            <div className="mt-3 font-display text-4xl font-light tracking-tight text-emerald-brand">
              ~2%
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              commercial conversion covers the free tier. At 1,000 free users
              that&apos;s ~R3,000/mo — funded by commercial licence revenue.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-border bg-muted/30 px-2 py-2">
                <div className="text-emerald-brand">{"< 1%"}</div>
                <div className="text-[10px] text-muted-foreground">tighten limits</div>
              </div>
              <div className="rounded-md border border-emerald-brand/40 bg-emerald-brand/10 px-2 py-2">
                <div className="text-emerald-brand">~2%</div>
                <div className="text-[10px] text-muted-foreground">breakeven</div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-2 py-2">
                <div className="text-amber-brand">{"> 5%"}</div>
                <div className="text-[10px] text-muted-foreground">growth engine</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
