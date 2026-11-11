"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortHash } from "@/lib/format";

export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
    >
      <span className="inline-block size-1.5 rounded-full bg-amber-brand" />
      {children}
    </div>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-display text-balance text-3xl font-light leading-[1.08] tracking-tight sm:text-4xl md:text-5xl",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function CopyButton({
  value,
  className,
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-amber-brand/60",
        className
      )}
    >
      {done ? (
        <Check className="size-3.5 text-emerald-brand" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {done ? "Copied" : label}
    </button>
  );
}

export function HashChip({
  value,
  head = 10,
  tail = 6,
  className,
  prefix,
}: {
  value: string;
  head?: number;
  tail?: number;
  className?: string;
  prefix?: string;
}) {
  return (
    <span
      className={cn(
        "hash inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[12px] text-muted-foreground",
        className
      )}
      title={value}
    >
      {prefix && <span className="text-amber-brand">{prefix}</span>}
      {shortHash(value, head, tail)}
    </span>
  );
}

export function VerdictBadge({
  valid,
  className,
}: {
  valid: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        valid
          ? "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand"
          : "border-clay-brand/40 bg-clay-brand/10 text-clay-brand",
        className
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          valid ? "bg-emerald-brand pulse-dot" : "bg-clay-brand"
        )}
      />
      {valid ? "Chain verified" : "Chain broken"}
    </span>
  );
}

export function TierBadge({
  tier,
  className,
}: {
  tier: string;
  className?: string;
}) {
  const map: Record<string, string> = {
    FREE_BUILD:
      "border-amber-brand/40 bg-amber-brand/10 text-amber-brand",
    FREE_DAILY: "border-border bg-muted text-muted-foreground",
    COMMERCIAL:
      "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand",
  };
  const label: Record<string, string> = {
    FREE_BUILD: "Free build",
    FREE_DAILY: "Free daily",
    COMMERCIAL: "Commercial",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        map[tier] ?? map.FREE_DAILY,
        className
      )}
    >
      {label[tier] ?? tier}
    </span>
  );
}

export function Stat({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="font-display text-2xl font-light tracking-tight text-foreground sm:text-3xl">
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
