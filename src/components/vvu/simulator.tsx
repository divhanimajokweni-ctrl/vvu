"use client";

import * as React from "react";
import Image from "next/image";
import {
  Box,
  Cpu,
  Eye,
  FileDown,
  Loader2,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Kicker, SectionHeading, TierBadge, HashChip, CopyButton } from "./primitives";
import { ChainPanel } from "./chain-panel";
import { surfaceMeta, SURFACES, timeUntil, formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type BuildRes = {
  buildId: string;
  twinName: string;
  twinHash: string;
  tier: string;
  fidelity: string;
  surface: string;
  expiresAt: string;
  share: { ttlMs: number; viewerLimit: number; export: string; watermark: boolean };
  freeBuildUsed: boolean;
};
type ShareRes = {
  shareId: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  viewerLimit: number;
  signature: string;
  kid: string;
  payload: Record<string, unknown>;
};
type ViewRes = {
  state: string;
  shareId?: string;
  twinName?: string;
  twinHash?: string;
  tier?: string;
  surface?: string;
  viewerLimit?: number;
  viewerCount?: number;
  expiresAt?: string;
  totalViews?: number;
};
type ExportRes = {
  ok: boolean;
  twinName: string;
  twinHash: string;
  licence: string;
  fileHash: string;
  sizeBytes: number;
  markdown: string;
  chainVerdict: string;
  chainRoot: string;
  exportedAt: string;
  exportUsed: boolean;
};
type LicenceRes = {
  ok: boolean;
  licenceId: string;
  rail: string;
  issuedAt: string;
  token: string;
  signature: string;
  kid: string;
  payload: Record<string, unknown>;
  note: string;
};

export function Simulator() {
  const [twinName, setTwinName] = React.useState("Neave Hydro-Gateway Mk-II");
  const [surface, setSurface] = React.useState("rig");
  const [fidelity, setFidelity] = React.useState("T1");
  const [rail, setRail] = React.useState<"STITCH" | "PAYSTACK">("STITCH");

  const [build, setBuild] = React.useState<BuildRes | null>(null);
  const [share, setShare] = React.useState<ShareRes | null>(null);
  const [view, setView] = React.useState<ViewRes | null>(null);
  const [exp, setExp] = React.useState<ExportRes | null>(null);
  const [licence, setLicence] = React.useState<LicenceRes | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const bump = () => setRefreshKey((k) => k + 1);

  const buildTwin = async () => {
    setError(null);
    setBusy("build");
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ twinName, surface, fidelity }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "DAILY_LIMIT") {
          setError(
            `Daily limit reached. Your next free build unlocks ${new Date(data.retryAt).toLocaleTimeString()}. This is the wall — commercial use pays.`
          );
        } else {
          setError(data?.error || "Build failed");
        }
        return;
      }
      setBuild(data as BuildRes);
      setShare(null);
      setView(null);
      setExp(null);
      setLicence(null);
      bump();
    } finally {
      setBusy(null);
    }
  };

  const shareTwin = async () => {
    if (!build) return;
    setError(null);
    setBusy("share");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buildId: build.buildId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Share failed");
        return;
      }
      setShare(data as ShareRes);
      setView(null);
      bump();
    } finally {
      setBusy(null);
    }
  };

  const openAsViewer = async (fp?: string) => {
    if (!share) return;
    setError(null);
    setBusy("view");
    try {
      const url = `/api/share/resolve?token=${encodeURIComponent(share.token)}` +
        (fp ? `&fp=${encodeURIComponent(fp)}` : "");
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as ViewRes;
      setView(data);
      bump();
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!share) return;
    setError(null);
    setBusy("revoke");
    try {
      const res = await fetch("/api/share/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId: share.shareId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Revoke failed");
        return;
      }
      bump();
    } finally {
      setBusy(null);
    }
  };

  const exportObsidian = async () => {
    if (!build) return;
    setError(null);
    setBusy("export");
    try {
      const res = await fetch("/api/obsidian-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buildId: build.buildId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Export failed");
        return;
      }
      setExp(data as ExportRes);
      bump();
    } finally {
      setBusy(null);
    }
  };

  const goCommercial = async () => {
    if (!build) return;
    setError(null);
    setBusy("commercial");
    try {
      const res = await fetch("/api/licence/commercial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buildId: build.buildId, rail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Licence failed");
        return;
      }
      setLicence(data as LicenceRes);
      bump();
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setBuild(null);
    setShare(null);
    setView(null);
    setExp(null);
    setLicence(null);
    setError(null);
    bump();
  };

  const exportable =
    build?.share.export === "MIT_ONCE" || build?.share.export === "UNRESTRICTED";

  return (
    <section id="simulator" className="scroll-mt-20 border-y border-border bg-muted/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker>Live simulator</Kicker>
            <SectionHeading className="mt-4 max-w-2xl">
              Run the loop. Watch the chain.
            </SectionHeading>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Build a twin, mint a signed share link, open it as a viewer,
              export to Obsidian, and trip the commercial gate. Every action
              appends a WORM event — recompute the chain yourself.
            </p>
          </div>
          {build && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="size-3.5" /> New build
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-clay-brand/40 bg-clay-brand/10 px-4 py-3 text-sm text-clay-brand">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* ── left: the steps ───────────────────────────── */}
          <div className="space-y-4">
            {/* Step 1 — Build */}
            <StepCard
              index={1}
              title="Build a twin"
              icon={<Box className="size-4" />}
              done={!!build}
            >
              {!build ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Twin name
                      </span>
                      <input
                        value={twinName}
                        onChange={(e) => setTwinName(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-brand/60"
                        placeholder="Name your twin"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Surface
                      </span>
                      <select
                        value={surface}
                        onChange={(e) => setSurface(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-brand/60"
                      >
                        {SURFACES.map((s) => (
                          <option key={s} value={s}>
                            {surfaceMeta(s).label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Fidelity
                      </span>
                      <div className="flex gap-1.5">
                        {["T0", "T1", "T2"].map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFidelity(f)}
                            className={cn(
                              "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                              fidelity === f
                                ? "border-amber-brand/60 bg-amber-brand/10 text-amber-brand"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                  <button
                    onClick={buildTwin}
                    disabled={busy === "build"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy === "build" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Box className="size-4" />
                    )}
                    Build twin
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    Compute is client-side (Puter.js). No card, no signup — a
                    cookie is your only identity.
                  </p>
                </div>
              ) : (
                <BuildResult build={build} />
              )}
            </StepCard>

            {/* Step 2 — Share */}
            {build && (
              <StepCard
                index={2}
                title="Mint a signed share link"
                icon={<Share2 className="size-4" />}
                done={!!share}
              >
                {!share ? (
                  <button
                    onClick={shareTwin}
                    disabled={busy === "share"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-brand/50 bg-amber-brand/10 px-4 py-2.5 text-sm font-medium text-amber-brand transition-colors hover:bg-amber-brand/20 disabled:opacity-60"
                  >
                    {busy === "share" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Share2 className="size-4" />
                    )}
                    Share twin
                  </button>
                ) : (
                  <ShareResult share={share} />
                )}
              </StepCard>
            )}

            {/* Step 3 — Viewer */}
            {share && (
              <StepCard
                index={3}
                title="Open as a viewer"
                icon={<Eye className="size-4" />}
                done={!!view && view.state === "SHARE_LIVE"}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openAsViewer()}
                      disabled={busy === "view"}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:border-amber-brand/60 disabled:opacity-60"
                    >
                      {busy === "view" && <Loader2 className="size-3.5 animate-spin" />}
                      <Eye className="size-3.5" /> Open as you
                    </button>
                    <button
                      onClick={() => openAsViewer("rec-" + Math.random().toString(36).slice(2, 8))}
                      disabled={busy === "view"}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-amber-brand/60 hover:text-foreground disabled:opacity-60"
                    >
                      <Users className="size-3.5" /> Simulate a new recipient
                    </button>
                    <button
                      onClick={revoke}
                      disabled={busy === "revoke"}
                      className="inline-flex items-center gap-2 rounded-md border border-clay-brand/40 px-3 py-2 text-xs font-medium text-clay-brand transition-colors hover:bg-clay-brand/10 disabled:opacity-60"
                    >
                      {busy === "revoke" && <Loader2 className="size-3.5 animate-spin" />}
                      Revoke
                    </button>
                  </div>
                  {view && <ViewerResult view={view} surface={build.surface} />}
                </div>
              </StepCard>
            )}

            {/* Step 4 — Export */}
            {build && (
              <StepCard
                index={4}
                title="Export to Obsidian (MIT)"
                icon={<FileDown className="size-4" />}
                done={!!exp}
                locked={!exportable}
                lockedNote={
                  build.share.export === "NONE"
                    ? "Export is not available on the free daily tier. Commercial unlocks it."
                    : undefined
                }
              >
                {!exp ? (
                  <div className="space-y-3">
                    <button
                      onClick={exportObsidian}
                      disabled={busy === "export" || !exportable}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-brand/50 bg-emerald-brand/10 px-4 py-2.5 text-sm font-medium text-emerald-brand transition-colors hover:bg-emerald-brand/20 disabled:opacity-50"
                    >
                      {busy === "export" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileDown className="size-4" />
                      )}
                      {build.share.export === "MIT_ONCE"
                        ? "Export under MIT (once)"
                        : "Export under MIT"}
                    </button>
                    {!exportable && (
                      <p className="text-[11px] text-muted-foreground">
                        Upgrade to commercial to unlock unrestricted export.
                      </p>
                    )}
                  </div>
                ) : (
                  <ExportResult exp={exp} />
                )}
              </StepCard>
            )}

            {/* Step 5 — Commercial gate */}
            {build && (
              <StepCard
                index={5}
                title="Commercial gate"
                icon={<ShieldCheck className="size-4" />}
                done={!!licence}
              >
                {!licence ? (
                  <div className="space-y-3">
                    <div className="flex gap-1.5">
                      {(["STITCH", "PAYSTACK"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRail(r)}
                          className={cn(
                            "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                            rail === r
                              ? "border-emerald-brand/60 bg-emerald-brand/10 text-emerald-brand"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {r === "STITCH" ? "Stitch (SA)" : "Paystack (intl)"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={goCommercial}
                      disabled={busy === "commercial"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {busy === "commercial" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Issue commercial licence
                    </button>
                    <p className="text-[11px] text-muted-foreground">
                      Simulated checkout — production validates a Stitch /
                      Paystack webhook before appending this event.
                    </p>
                  </div>
                ) : (
                  <LicenceResult licence={licence} />
                )}
              </StepCard>
            )}
          </div>

          {/* ── right: live chain ─────────────────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChainPanel buildId={build?.buildId ?? null} refreshKey={refreshKey} />
            {build && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Receipt
                </div>
                <ReceiptBlock buildId={build.buildId} refreshKey={refreshKey} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── subcomponents ─────────────────────────────────────────────────────────

function StepCard({
  index,
  title,
  icon,
  done,
  locked,
  lockedNote,
  children,
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  done?: boolean;
  locked?: boolean;
  lockedNote?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        locked ? "border-border/60 opacity-80" : "border-border"
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
            done
              ? "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {done ? "✓" : index}
        </span>
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </span>
        {locked && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> locked
          </span>
        )}
      </div>
      <div className="p-4">
        {locked && lockedNote ? (
          <p className="text-sm text-muted-foreground">{lockedNote}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function BuildResult({ build }: { build: BuildRes }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={build.tier} />
        <HashChip value={build.twinHash} prefix="0x" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Field label="Surface" value={surfaceMeta(build.surface).label.split(" · ")[0]} />
        <Field label="Fidelity" value={build.fidelity} />
        <Field label="Persists" value={timeUntil(build.expiresAt)} />
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        {build.share.watermark
          ? "Watermarked · commercial use prohibited"
          : "Unwatermarked · MIT export available once"}
      </div>
    </div>
  );
}

function ShareResult({ share }: { share: ShareRes }) {
  const [showPayload, setShowPayload] = React.useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="hash truncate text-[11px] text-foreground">
          {share.shareUrl}
        </span>
        <CopyButton value={share.shareUrl} label="" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Viewers" value={`${share.viewerLimit || "∞"}`} />
        <Field label="Expires" value={timeUntil(share.expiresAt)} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            signature
          </div>
          <div className="hash truncate text-foreground/80">{share.signature}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            key id
          </div>
          <div className="hash text-foreground/80">{share.kid}</div>
        </div>
      </div>
      <button
        onClick={() => setShowPayload((s) => !s)}
        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {showPayload ? "Hide" : "Show"} signed payload (Ed25519)
      </button>
      {showPayload && (
        <pre className="scroll-fine max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[10px] leading-relaxed">
          {JSON.stringify(share.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ViewerResult({ view, surface }: { view: ViewRes; surface: string }) {
  const meta = surfaceMeta(surface);
  const live = view.state === "SHARE_LIVE";
  const limit = view.viewerLimit ?? 0;
  const count = view.viewerCount ?? 0;
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
          live
            ? "border-emerald-brand/40 bg-emerald-brand/10 text-emerald-brand"
            : "border-clay-brand/40 bg-clay-brand/10 text-clay-brand"
        )}
      >
        {live ? <Eye className="size-3" /> : <Lock className="size-3" />}
        {view.state.replace(/_/g, " ")}
      </div>
      {live && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="relative">
            <Image
              src={meta.image}
              alt={meta.label}
              width={1024}
              height={1024}
              className="aspect-[16/10] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            <div className="absolute bottom-2 left-2 rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] backdrop-blur">
              {meta.label}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Field
          label="Viewers"
          value={limit > 0 ? `${count}/${limit}` : `${count}`}
        />
        <Field
          label="Expires"
          value={view.expiresAt ? timeUntil(view.expiresAt) : "—"}
        />
        <Field label="Tier" value={view.tier ?? "—"} />
      </div>
      {view.state === "SHARE_EXHAUSTED" && (
        <p className="text-[11px] text-clay-brand">
          Viewer limit reached — SHARE_EXHAUSTED appended to the chain. The link
          now returns the exhausted page, not the twin.
        </p>
      )}
      {view.state === "SHARE_REVOKED" && (
        <p className="text-[11px] text-clay-brand">
          Revoked by the owner. The link is dead; the proof it existed is not.
        </p>
      )}
    </div>
  );
}

function ExportResult({ exp }: { exp: ExportRes }) {
  const download = () => {
    const blob = new Blob([exp.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "twin-export.md";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-brand/40 bg-emerald-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-brand">
          <ShieldCheck className="size-3" /> MIT · yours forever
        </span>
        <HashChip value={exp.fileHash} prefix="sha256:" />
        <span className="text-[11px] text-muted-foreground">
          {formatBytes(exp.sizeBytes)}
        </span>
      </div>
      <div className="scroll-fine max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3">
        <pre className="text-[10px] leading-relaxed text-foreground/80">
          {exp.markdown}
        </pre>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          chain verdict:{" "}
          <span className="text-emerald-brand">{exp.chainVerdict}</span>
        </span>
        <button
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-emerald-brand/60"
        >
          <FileDown className="size-3.5" /> Download .md
        </button>
      </div>
    </div>
  );
}

function LicenceResult({ licence }: { licence: LicenceRes }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-brand/40 bg-emerald-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-brand">
          <Sparkles className="size-3" /> Commercial · {licence.rail}
        </span>
        <HashChip value={licence.licenceId} prefix="" head={14} tail={4} />
      </div>
      <p className="text-[11px] text-muted-foreground">{licence.note}</p>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          signed licence token
        </div>
        <div className="hash mt-1 break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-[10px] text-foreground/80">
          {licence.token}
        </div>
      </div>
    </div>
  );
}

function ReceiptBlock({
  buildId,
  refreshKey,
}: {
  buildId: string;
  refreshKey: number;
}) {
  const [receipt, setReceipt] = React.useState<Record<string, unknown> | null>(null);
  React.useEffect(() => {
    let active = true;
    fetch(`/api/receipt/${buildId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => active && setReceipt(d.receipt ?? d))
      .catch(() => {});
    const id = setInterval(() => {
      fetch(`/api/receipt/${buildId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => active && setReceipt(d.receipt ?? d))
        .catch(() => {});
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [buildId, refreshKey]);

  if (!receipt) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  const r = receipt as Record<string, string | number>;
  return (
    <div className="scroll-fine max-h-72 overflow-y-auto p-3">
      <dl className="space-y-1.5 text-[11px]">
        {Object.entries(r).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd
              className={cn(
                "hash text-right",
                k === "chain_verdict"
                  ? String(v) === "VERIFIED"
                    ? "text-emerald-brand"
                    : "text-clay-brand"
                  : k === "tier"
                    ? "text-amber-brand"
                    : "text-foreground/80"
              )}
            >
              {typeof v === "string" && v.length > 40
                ? v.slice(0, 18) + "…" + v.slice(-8)
                : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
