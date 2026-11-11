"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const SECTIONS = [
  { href: "#model", label: "Model" },
  { href: "#simulator", label: "Simulator" },
  { href: "#share", label: "Share" },
  { href: "#rails", label: "Payments" },
  { href: "#compute", label: "Compute" },
  { href: "#receipts", label: "Receipts" },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        className="fill-card stroke-border"
        strokeWidth="1.2"
      />
      {/* the twin — concentric receipt folds */}
      <path
        d="M9 22 L9 10 L16 14 L23 10 L23 22"
        className="stroke-amber-brand"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17" r="2" className="fill-emerald-brand" />
      <path
        d="M11 25.5 L21 25.5"
        className="stroke-clay-brand"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "sticky top-0 z-50 transition-colors " +
        (scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent")
      }
    >
      <div className="rule-top h-px w-full" />
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="#top"
          className="group flex items-center gap-2.5"
          aria-label="Venture Vision Ubuntu"
        >
          <BrandMark className="size-8" />
          <div className="leading-none">
            <div className="font-display text-[15px] font-medium tracking-tight">
              Venture Vision Ubuntu
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              publish a twin · prove the receipt
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="#simulator"
            className="hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Start free build
          </a>
        </div>
      </nav>
    </header>
  );
}
