"use client";

import { Share2, Send, FileDown, Trash2, Eye } from "lucide-react";
import { Kicker, SectionHeading } from "./primitives";

const COMPARE: { concern: string; publish: string; share: string }[] = [
  { concern: "Storage cost", publish: "Grows unbounded", share: "Bounded by TTL, self-cleaning" },
  { concern: "CDN cost", publish: "Every twin served forever", share: "Only active shares served" },
  { concern: "Abuse", publish: "Anyone publishes anything forever", share: "Time-boxed, revocable, viewer-limited" },
  { concern: "DMCA burden", publish: "Takedowns on permanent URLs", share: "Share expires → SHARE_EXPIRED page" },
  { concern: "User motivation", publish: "“I'll publish later” → procrastination", share: "“Expires in 7 days” → urgency" },
  { concern: "Proof of sharing", publish: "Weak — a hosted page", share: "Strong — WORM logs who, when, how many" },
];

const LIFECYCLE = [
  {
    event: "TWIN_SHARED",
    when: "User creates a share",
    icon: Share2,
    tone: "amber",
    desc: "share_id, tier, viewer_limit, expires_at, twin_hash, signed",
  },
  {
    event: "SHARE_VIEWED",
    when: "Each new viewer opens",
    icon: Eye,
    tone: "emerald",
    desc: "share_id, viewer_hash, viewer_index, ts",
  },
  {
    event: "SHARE_REVOKED",
    when: "Owner revokes early",
    icon: Trash2,
    tone: "clay",
    desc: "share_id, revoked_at, revoked_by",
  },
  {
    event: "SHARE_EXPIRED",
    when: "TTL hits",
    icon: Trash2,
    tone: "clay",
    desc: "share_id, expired_at, total_views",
  },
  {
    event: "SHARE_EXHAUSTED",
    when: "Viewer limit reached first",
    icon: Eye,
    tone: "clay",
    desc: "share_id, total_views, limit",
  },
];

const toneMap: Record<string, string> = {
  amber: "border-amber-brand/40 text-amber-brand bg-amber-brand/5",
  emerald: "border-emerald-brand/40 text-emerald-brand bg-emerald-brand/5",
  clay: "border-clay-brand/40 text-clay-brand bg-clay-brand/5",
};

export function ShareModel() {
  return (
    <section id="share" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Kicker>The share model</Kicker>
        <SectionHeading className="mt-4 max-w-3xl">
          The share is the delivery. The proof is the receipt.
        </SectionHeading>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          When you send an email via Resend, the email is delivered, Resend
          logs the delivery, and the body isn&apos;t archived forever. Your twin
          share works the same way: the share was sent, the WORM chain proves
          it, the recipient saw the twin, then the share expired. That&apos;s a
          share, not a publication.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* comparison */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Persistent publishing vs share-only
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">
                      Concern
                    </th>
                    <th className="px-4 py-2.5 font-medium text-clay-brand">
                      Persistent publish
                    </th>
                    <th className="px-4 py-2.5 font-medium text-emerald-brand">
                      Share with WORM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr
                      key={r.concern}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">{r.concern}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.publish}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.share}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* lifecycle */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              The WORM event lifecycle per share
            </div>
            {LIFECYCLE.map((l) => {
              const Icon = l.icon;
              return (
                <div
                  key={l.event}
                  className={
                    "flex items-start gap-3 rounded-lg border p-3 " + toneMap[l.tone]
                  }
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="hash text-sm font-semibold">
                        {l.event}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {l.when}
                      </span>
                    </div>
                    <div className="hash mt-0.5 text-[10px] text-muted-foreground">
                      {l.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* the hierarchy */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <HierarchyCard
            icon={<FileDown className="size-4 text-emerald-brand" />}
            title="Export = ownership"
            body="The Obsidian export is permanent, MIT-licensed. You own it forever — we cannot revoke it."
            tone="emerald"
          />
          <HierarchyCard
            icon={<Send className="size-4 text-amber-brand" />}
            title="Share = delivery"
            body="The signed link is the delivery mechanism. Time-boxed, viewer-limited, revocable, WORM-logged."
            tone="amber"
          />
          <HierarchyCard
            icon={<Trash2 className="size-4 text-muted-foreground" />}
            title="Raw = ephemeral"
            body="The raw twin data is deleted per TTL — the Mayfly principle. Only the export survives."
            tone="muted"
          />
        </div>
      </div>
    </section>
  );
}

function HierarchyCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-brand/30",
    amber: "border-amber-brand/30",
    muted: "border-border",
  };
  return (
    <div className={"rounded-xl border bg-card p-4 " + tones[tone]}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
