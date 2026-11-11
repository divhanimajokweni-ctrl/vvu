"use client";

import { BrandMark } from "./site-nav";

const LINKS = [
  { href: "#model", label: "Model" },
  { href: "#simulator", label: "Simulator" },
  { href: "#share", label: "Share" },
  { href: "#rails", label: "Payments" },
  { href: "#compute", label: "Compute" },
  { href: "#receipts", label: "Receipts" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="rule-top h-px w-full" />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-8" />
              <div className="font-display text-base font-medium tracking-tight">
                Venture Vision Ubuntu
              </div>
            </div>
            <p className="mt-4 max-w-md text-pretty font-display text-lg font-light leading-snug tracking-tight">
              One free build, shareable to 25 people for 7 days, exportable to
              Obsidian under MIT forever. Commercial use pays. Every receipt
              proves which of those you&apos;re on, and the chain proves the
              receipt.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sections
              </div>
              <ul className="mt-3 space-y-2">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Substrate
              </div>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>SHA-256 · RFC-8785 JCS</li>
                <li>Ed25519 signed tokens</li>
                <li>WORM append-only ledger</li>
                <li>MIT freedom guarantee</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} Venture Vision Ubuntu. The Obsidian
            export is MIT-licensed; the right to deploy commercially is
            licensed separately.
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-brand pulse-dot" />
              chain verified
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>built on the SEARM substrate</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
