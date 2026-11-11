"use client";

import Image from "next/image";
import { ShieldCheck, Share2, FileDown, Infinity as InfinityIcon } from "lucide-react";
import { Kicker } from "./primitives";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* ── copy ─────────────────────────────────────── */}
          <div className="rise">
            <Kicker>Venture Vision Ubuntu · digital twin estate</Kicker>
            <h1 className="mt-5 font-display text-[2.6rem] font-light leading-[1.02] tracking-tight sm:text-6xl">
              Publish a twin.
              <br />
              <span className="text-amber-brand">Prove the receipt.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              One free build, shareable to 25 people for 7 days, exportable to
              Obsidian under MIT forever. After that, daily builds reset every
              24 hours. Commercial use pays. Every share is a signed,
              revocable, WORM-logged event — the proof of delivery is the
              product, not the hosted page.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start your free build
              </a>
              <a
                href="#model"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-amber-brand/60"
              >
                Read the one-page model
              </a>
            </div>

            <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-brand" /> No card,
                no signup
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Share2 className="size-3.5 text-amber-brand" /> WORM-logged
                shares
              </li>
              <li className="inline-flex items-center gap-1.5">
                <FileDown className="size-3.5 text-amber-brand" /> Obsidian MIT
                export
              </li>
              <li className="inline-flex items-center gap-1.5">
                <InfinityIcon className="size-3.5 text-emerald-brand" /> Yours
                forever, once
              </li>
            </ul>
          </div>

          {/* ── visual ──────────────────────────────────── */}
          <div className="rise relative" style={{ animationDelay: "120ms" }}>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40">
              <Image
                src="/twin/hero-estate.png"
                alt="Photoreal digital twin of a South African manufacturing facility at golden hour"
                width={1344}
                height={768}
                priority
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              {/* HUD receipt chips */}
              <div className="absolute left-4 top-4 flex flex-col gap-2">
                <Chip>
                  <span className="text-emerald-brand">●</span> CHAIN VERIFIED
                </Chip>
                <Chip>
                  <span className="text-amber-brand">●</span> tier: FREE_BUILD
                </Chip>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div className="rounded-lg border border-border bg-background/80 px-3 py-2 backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    twin_hash
                  </div>
                  <div className="hash text-[11px] text-foreground">
                    0x8f9a·c3d2·7e41·…·ab04
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/80 px-3 py-2 text-right backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    viewers
                  </div>
                  <div className="font-display text-lg text-foreground">
                    3<span className="text-muted-foreground">/25</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-amber-brand/10 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider backdrop-blur">
      {children}
    </span>
  );
}
