"use client";

import { CreditCard, Landmark, Zap, Webhook } from "lucide-react";
import { Kicker, SectionHeading } from "./primitives";

const RAILS = [
  {
    name: "Stitch",
    role: "SA · card + instant EFT",
    card: "2.5% + R0",
    eft: "Instant EFT, PayShap · R0",
    settle: "T+1",
    sa: "SA business account",
    primary: true,
    icon: Landmark,
  },
  {
    name: "Paystack",
    role: "International · card + EFT",
    card: "2.9% + R1 (+3.5% intl)",
    eft: "EFT supported",
    settle: "T+1",
    sa: "SA business supported",
    primary: true,
    icon: CreditCard,
  },
  {
    name: "Stripe",
    role: "Fallback · card only",
    card: "2.9% + R2",
    eft: "No EFT",
    settle: "T+2",
    sa: "International entity",
    primary: false,
    icon: Zap,
  },
] as const;

const TRIGGERS = [
  { trigger: "Commercial licence requested", how: "User toggles “Commercial use”", action: "Redirect to Stitch / Paystack checkout" },
  { trigger: "Watermark removal", how: "API POST /licence/commercial", action: "Same checkout" },
  { trigger: "Paid traffic on a published twin", how: "Analytics / monetisation detected", action: "ToS violation → DMCA + upsell" },
  { trigger: "Free export used commercially", how: "Self-declared + MIT terms prohibit it", action: "Licence violation → remediation" },
];

export function PaymentRails() {
  return (
    <section id="rails" className="scroll-mt-20 border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Kicker>Payment rails</Kicker>
        <SectionHeading className="mt-4 max-w-3xl">
          Stitch for SA. Paystack for the world. Stripe as fallback only.
        </SectionHeading>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          SA-native processors first — lower fees, instant EFT, immediate
          settlement. Stripe is a fallback you probably never enable, not the
          default. The commercial gate fires on use, not on a calendar.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {RAILS.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.name}
                className={
                  "relative flex flex-col rounded-xl border bg-card p-5 " +
                  (r.primary ? "border-border" : "border-dashed border-border opacity-80")
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted">
                      <Icon className="size-4 text-foreground" />
                    </span>
                    <div>
                      <div className="font-display text-base font-medium tracking-tight">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.role}
                      </div>
                    </div>
                  </div>
                  {!r.primary && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      fallback
                    </span>
                  )}
                  {r.primary && r.name === "Stitch" && (
                    <span className="rounded-full border border-amber-brand/40 bg-amber-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-brand">
                      SA primary
                    </span>
                  )}
                </div>
                <dl className="mt-4 space-y-2 text-xs">
                  <Row k="Card" v={r.card} />
                  <Row k="EFT" v={r.eft} />
                  <Row k="Settlement" v={r.settle} />
                  <Row k="SA entity" v={r.sa} />
                </dl>
              </div>
            );
          })}
        </div>

        {/* checkout flow */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            The checkout flow
          </div>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-stretch">
            <FlowNode icon={Zap} title="Commercial gate" body="Fires on commercial use, not calendar expiry" tone="amber" />
            <FlowArrow label="detect region" />
            <FlowNode icon={Landmark} title="Stitch (SA)" body="Card 2.5% · instant EFT · PayShap" tone="amber" />
            <FlowArrow label="or" />
            <FlowNode icon={CreditCard} title="Paystack (intl)" body="Card 2.9% · EFT · T+1" tone="emerald" />
            <FlowArrow label="webhook" />
            <FlowNode icon={Webhook} title="WORM event" body="COMMERCIAL_LICENCE_ISSUED · Ed25519 licence token returned" tone="emerald" />
          </div>
        </div>

        {/* triggers */}
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            When the commercial gate fires
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Trigger</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">How detected</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">What happens</th>
                </tr>
              </thead>
              <tbody>
                {TRIGGERS.map((t) => (
                  <tr key={t.trigger} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{t.trigger}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.how}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-brand/40 text-amber-brand",
    emerald: "border-emerald-brand/40 text-emerald-brand",
  };
  return (
    <div className="flex-1 rounded-lg border border-border bg-background p-4">
      <div className={"inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium " + tones[tone]}>
        <Icon className="size-3" /> {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center lg:flex-col">
      <span className="hidden text-muted-foreground lg:inline">→</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground lg:mt-0.5">
        {label}
      </span>
    </div>
  );
}
