'use client';

// src/components/docs/DocsWorkspace.tsx — Task 46 · #/docs
// THE DOCUMENTS — FIELD ACCESS. The 19th projection, built for the
// operator's field message: "I'm lost… you're no longer supplying me with
// these types of documents… I want to get the QR code — can I get these
// documents?" The documents existed (Task 44/45: pitches, price card v2,
// payment discipline, consent spec, the compliance pack) but they lived in
// repo files and desktop projections — not in the hand that sells.
//
// This view is the phone-first carry:
//   * QR ACCESS — a master QR (encodes the REAL serving address + #/docs —
//     no URL is ever invented) plus a text QR on every document card that
//     carries the content itself and works with no server at all.
//   * every document readable on this screen: the three pitches, the price
//     card, payment discipline, consent, the compliance pack (fetched from
//     disk via /api/docs/compliance — fixed server-side allowlist), and the
//     five email drafts cross-referenced to #/commercial (single source).
//   * COPY / QR / PRINT on every document — clipboard + legacy fallback +
//     sonner toast + WORM log, same pattern as commercial/ops.
//
// Built in the exact IVE visual language of OpsWorkspace /
// CommercialWorkspace (gold #C9A84C · proven #3DFFB0 · ready #F5A623 ·
// lime #c8ff00, Geist + Geist Mono, 228px left nav, grid-paper hero, mono
// labels, responsive grids, 44px touch targets).
//
// HONESTY (the Day 1 standard, applied to this build):
//   * The master QR encodes window.location.origin at runtime. If that
//     address is local or session-bound, the view says so (amber) and the
//     text QRs remain the always-works path. Nothing is invented.
//   * Text QRs are capped at 1000 chars (/api/docs/qr answers 413 with a
//     stated reason) — long documents report TOO LONG FOR A QR honestly
//     and offer COPY instead of being silently truncated.
//   * The compliance pack renders DRAFT — REVIEW REQUIRED on every doc
//     until the lawyer signs off (manifest L7). Printing a draft prints
//     the draft label.
//   * Every count is DERIVED from the ledgers (fielddocsTotals()). The
//     ledger wins.
//   * One VIEW_OPEN · DOCS WORM log per mount.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  ClipboardCopy,
  FileText,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import {
  CONSENT_RECORD_FIELDS,
  CONSENT_RULE,
  CONSENT_STATUS,
  PAYMENT_DISCIPLINE,
  PITCHES,
  PITCH_RULE,
  PITCH_WARNING,
  PRICE_CARD,
  PRICE_CARD_CAVEAT,
  PRICE_CARD_TRANSITION,
} from '@/lib/ops-data';
import type { Pitch, PriceRow } from '@/lib/ops-data';
import { EMAIL_DRAFTS } from '@/lib/commercial-data';
import {
  DOCS_QR_CAP,
  QR_HONESTY,
  compliancePurposeFor,
  consentDocText,
  fielddocsTotals,
  paymentDocText,
  pitchDocText,
  priceCardDocText,
} from '@/lib/fielddocs-data';
import { externalLinkAria } from '@/lib/watchboard-ledger';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { useHashRoute } from '@/hooks/use-hash-route';

// ── IVE tokens ───────────────────────────────────────────────────────────────

const GOLD = '#C9A84C';
const PROVEN = '#3DFFB0';
const READY = '#F5A623';
const LIME = '#c8ff00';

const SANS = 'var(--font-geist-sans), system-ui, sans-serif';
const MONO = 'var(--font-geist-mono), monospace';

// ── nav sections (DOM order = view order; ids are valid CSS selectors) ───────

interface NavSection {
  key: string;
  code: string;
  title: string;
}

const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'qr', code: 'QA', title: 'QR ACCESS' },
  { key: 'guide', code: 'FG', title: 'FIELD GUIDE · SECURITY' },
  { key: 'pitches', code: 'PI', title: 'THE THREE PITCHES' },
  { key: 'price', code: 'PC', title: 'PRICE CARD (V2)' },
  { key: 'payment', code: 'PM', title: 'PAYMENT DISCIPLINE' },
  { key: 'consent', code: 'CN', title: 'CONSENT' },
  { key: 'compliance', code: 'CP', title: 'COMPLIANCE PACK' },
  { key: 'emails', code: 'EM', title: 'THE FIVE EMAILS' },
] as const;

// ── the compliance route's response shape (/api/docs/compliance) ─────────────

interface ServedDoc {
  id: string;
  title: string;
  file: string;
  markdown: string;
  chars: number;
  mtimeIso: string | null;
  error: string | null;
}

// ── count-up (rAF, zero deps — same pattern as ops/commercial/manifest) ──────

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / durationMs);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return value;
}

// ── clipboard (navigator.clipboard + legacy fallback) ────────────────────────

function legacyCopyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── presentational helpers (mirrors OpsWorkspace) ────────────────────────────

function SectionHead({ code, title, sub }: { code: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span aria-hidden className="h-[14px] w-[3px] rounded-full" style={{ background: GOLD, opacity: 0.85 }} />
      <h2 className="vvu-label text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(244,244,245,0.85)]">
        <span style={{ color: GOLD }}>{code}</span> — {title}
        {sub && (
          <span className="ml-2 font-normal normal-case tracking-normal text-[rgba(244,244,245,0.4)]">({sub})</span>
        )}
      </h2>
    </div>
  );
}

function SubHead({ children, color = 'rgba(244,244,245,0.7)' }: { children: ReactNode; color?: string }) {
  return (
    <h3 className="vvu-label mb-2.5 text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
      {children}
    </h3>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 ${className}`}>{children}</div>;
}

/** Shared whileInView entrance (reduced-motion aware). */
function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      role="region"
      aria-label={label}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="mb-6 scroll-mt-4"
    >
      {children}
    </motion.section>
  );
}

/** Honest amber note box (QR caveats, price-card caveat, …). */
function HonestNote({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.06)] p-3.5">
      <p className="flex items-start gap-2 text-[10.5px] leading-relaxed text-[#F5A623]" style={{ fontFamily: SANS }}>
        <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="vvu-label mr-1.5 text-[8px] font-bold uppercase tracking-[0.14em]">{label}</span>
          {children}
        </span>
      </p>
    </div>
  );
}

// ── the QR card — fetches its own QR from /api/docs/qr on mount ──────────────

function QrCard({
  label,
  payload,
  mode,
  note,
}: {
  label: string;
  payload: string | null;
  mode: 'LINK' | 'TEXT';
  note?: string;
}) {
  const sendWormLog = useSendWormLog();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setBusy(false);
      setErr(null);
      return;
    }
    setBusy(true);
    setErr(null);
    setDataUrl(null);
    (async () => {
      try {
        const res = await fetch('/api/docs/qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });
        const data = (await res.json()) as { dataUrl?: string; chars?: number; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.dataUrl) {
          setErr(data.error ?? `QR route HTTP ${res.status}`);
        } else {
          setDataUrl(data.dataUrl);
          sendWormLog('DOC_QR_GENERATED', 'DOCS', `${label} · ${mode} payload · ${data.chars} chars`);
        }
      } catch {
        if (!cancelled) setErr('the QR route did not respond');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, label, mode, sendWormLog]);

  if (!payload) {
    return (
      <p className="vvu-label text-[9px] text-[rgba(244,244,245,0.45)]" style={{ fontFamily: MONO }}>
        DETECTING THE SERVING ADDRESS…
      </p>
    );
  }

  if (busy) {
    return (
      <div className="flex min-h-[120px] items-center justify-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <Loader2 aria-hidden className="size-4 animate-spin text-[#7a8a6e]" />
        <span className="vvu-label text-[9px] text-[rgba(244,244,245,0.55)]">GENERATING QR — {label}</span>
      </div>
    );
  }

  if (err) {
    // Honest failure: the cap, an unreachable route, whatever it is — stated.
    return (
      <div className="rounded-lg border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.06)] p-3.5">
        <p className="text-[10px] font-semibold leading-relaxed text-[#F5A623]" style={{ fontFamily: SANS }}>
          TOO LONG / FAILED FOR A QR — {err}
        </p>
        <p className="mt-1 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.6)]" style={{ fontFamily: SANS }}>
          {QR_HONESTY.capNote} The full text stays above — COPY carries all of it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[rgba(200,255,0,0.22)] bg-[rgba(200,255,0,0.03)] p-3.5">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
        {dataUrl && (
          <img
            src={dataUrl}
            alt={`QR code — ${mode === 'LINK' ? 'opens THE DOCUMENTS view' : 'carries the text of'} ${label}`}
            className="mx-auto h-auto w-[168px] shrink-0 rounded-md sm:mx-0 sm:w-[184px]"
            width={184}
            height={184}
          />
        )}
        <div className="min-w-0 flex-1">
          <span
            className="vvu-label inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[7.5px] font-bold"
            style={
              mode === 'TEXT'
                ? { color: PROVEN, borderColor: 'rgba(61,255,176,0.4)', background: 'rgba(61,255,176,0.06)' }
                : { color: LIME, borderColor: 'rgba(200,255,0,0.4)', background: 'rgba(200,255,0,0.06)' }
            }
          >
            <ScanLine aria-hidden className="size-3" />
            {mode === 'TEXT' ? 'TEXT PAYLOAD — WORKS OFFLINE' : 'LINK PAYLOAD — LIVE ADDRESS'}
          </span>
          <p
            className="custom-scrollbar mt-2 max-h-[84px] overflow-y-auto break-all rounded border border-white/[0.06] bg-white/[0.02] p-2 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.6)]"
            style={{ fontFamily: MONO }}
          >
            {payload}
          </p>
          <p className="vvu-label mt-1.5 text-[7.5px] text-[rgba(244,244,245,0.4)]">
            {payload.length} / {DOCS_QR_CAP} CHARS · WHAT IS ENCODED IS SHOWN IN FULL — NOTHING HIDDEN
          </p>
          {note && (
            <p className="mt-2 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.55)]" style={{ fontFamily: SANS }}>
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Lazy per-document QR: the button opens the QrCard (fetch on demand). */
function DocQrToggle({ label, payload }: { label: string; payload: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="vvu-label flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.05)] px-3 text-[9px] font-bold text-[#c8ff00] transition-colors hover:bg-[rgba(200,255,0,0.1)] sm:w-auto"
      >
        <QrCode aria-hidden className="size-3.5" />
        {open ? 'HIDE QR' : 'QR — CARRIES THE TEXT'}
      </button>
      {open && (
        <div className="mt-2.5">
          <QrCard label={label} payload={payload} mode="TEXT" note={QR_HONESTY.textMode} />
        </div>
      )}
    </div>
  );
}

// ── the document action row — COPY / QR / PRINT (44px targets) ───────────────

function DocActions({
  label,
  text,
  onCopy,
  onPrint,
}: {
  label: string;
  text: string;
  onCopy: (label: string, text: string) => void;
  onPrint: (label: string, sub: string, text: string) => void;
}) {
  return (
    <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={() => onCopy(label, text)}
        className="vvu-label flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.07)] px-3 text-[9px] font-bold text-[#C9A84C] transition-colors hover:bg-[rgba(201,168,76,0.12)]"
      >
        <ClipboardCopy aria-hidden className="size-3.5" />
        COPY
      </button>
      <DocQrToggle label={label} payload={text} />
      <button
        type="button"
        onClick={() => onPrint(label, 'Field document — THE DOCUMENTS console', text)}
        className="vvu-label flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.03] px-3 text-[9px] font-bold text-[rgba(244,244,245,0.75)] transition-colors hover:bg-white/[0.06]"
      >
        <Printer aria-hidden className="size-3.5" />
        PRINT
      </button>
    </div>
  );
}

// ── pitch card ───────────────────────────────────────────────────────────────

function PitchDocCard({
  pitch,
  index,
  onCopy,
  onPrint,
}: {
  pitch: Pitch;
  index: number;
  onCopy: (label: string, text: string) => void;
  onPrint: (label: string, sub: string, text: string) => void;
}) {
  const text = useMemo(() => pitchDocText(pitch), [pitch]);
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.25), ease: 'easeOut' }}
      className="flex flex-col rounded-lg border border-[rgba(200,255,0,0.18)] bg-white/[0.02] p-4"
      aria-label={`Pitch — ${pitch.audience}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#F4F4F5]" style={{ fontFamily: SANS }}>
          {pitch.audience}
        </h3>
        <span
          className="vvu-label rounded border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.05)] px-1.5 py-0.5 text-[7px] font-bold text-[#c8ff00]"
          title="The three sentences, exactly as the operator wrote them"
        >
          VERBATIM · 3 SENTENCES
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-[rgba(244,244,245,0.88)]" style={{ fontFamily: SANS }}>
        {pitch.text}
      </p>
      <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-[9.5px] text-[rgba(244,244,245,0.5)]" style={{ fontFamily: MONO }}>
        <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#C9A84C]">THEN</span>
        {PITCH_RULE}
      </p>
      <DocActions label={pitch.id} text={text} onCopy={onCopy} onPrint={onPrint} />
    </motion.article>
  );
}

// ── price row (phone-first stacked, same data as #/commercial) ───────────────

function PriceDocRow({ row }: { row: PriceRow }) {
  return (
    <div
      className={`relative flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.05] px-3 py-2.5 last:border-0 ${
        row.featured ? 'bg-[rgba(201,168,76,0.045)]' : ''
      }`}
    >
      {row.featured && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: GOLD, opacity: 0.65 }} />}
      <span className="vvu-label w-[46px] shrink-0 text-[9px] text-[rgba(244,244,245,0.4)]" style={{ fontFamily: MONO }}>
        {row.id}
      </span>
      <span
        className="min-w-[150px] flex-1 text-[11.5px] font-medium leading-snug"
        style={{ fontFamily: SANS, color: row.featured ? '#F4F4F5' : 'rgba(244,244,245,0.8)' }}
      >
        {row.offering}
        {row.tier && (
          <span
            className="vvu-label ml-2 inline-block translate-y-[-1px] rounded border border-white/[0.1] bg-white/[0.02] px-1 py-px align-baseline text-[7px] font-bold text-[rgba(244,244,245,0.5)]"
            title="Task 44 sales-ledger tier cross-reference"
          >
            {row.tier}
          </span>
        )}
      </span>
      <span className="vvu-label text-[10px] font-bold text-[#C9A84C]">{row.entryPrice}</span>
      <span className="vvu-label text-[8.5px] text-[rgba(244,244,245,0.4)]">{row.delivery}</span>
    </div>
  );
}

// ── markdown body (dark tokens) — the compliance pack on screen ──────────────

function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="text-[11px] leading-relaxed text-[rgba(244,244,245,0.78)]" style={{ fontFamily: SANS }}>
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-1 text-[14px] font-bold text-[#F4F4F5]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-4 text-[12px] font-bold text-[#C9A84C]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-3 text-[11px] font-semibold text-[rgba(244,244,245,0.9)]">{children}</h3>
          ),
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[#F4F4F5]">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[rgba(201,168,76,0.5)] pl-3 text-[rgba(244,244,245,0.65)]">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code
              className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px] text-[#c8ff00]"
              style={{ fontFamily: MONO }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className="custom-scrollbar my-2 overflow-x-auto rounded-md border border-white/[0.08] bg-white/[0.03] p-2.5 text-[9.5px] text-[rgba(244,244,245,0.75)]"
              style={{ fontFamily: MONO }}
            >
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-white/[0.08]" />,
          // R192 · THE BOUNDARY-AWARE LINK: the docs renderer's anchors
          // now speak their boundary — an external href (http/https)
          // opens in a NEW TAB with relnoopener, its aria carries the
          // boundary clause BEFORE the follow (a new tab beyond the
          // estate), and the ↗ affordance rides visually only
          // (aria-hidden — the glyph is the eye's own show). Internal
          // and hash links stay in place, unnamed by the boundary.
          a: ({ children, href }) => {
            const external = typeof href === 'string' && /^https?:\/\//i.test(href);
            const base =
              'underline decoration-[rgba(201,168,76,0.5)] underline-offset-2 transition-[text-decoration-color,box-shadow] hover:decoration-[rgba(201,168,76,0.95)] hover:shadow-[0_1px_4px_rgba(201,168,76,0.2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a84c]';
            if (!external) {
              return (
                <a href={href} className={base}>
                  {children}
                </a>
              );
            }
            const name = typeof children === 'string' ? children : 'a linked page';
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={externalLinkAria(name, 'a linked page')}
                className={base}
              >
                {children}
                <span aria-hidden> ↗</span>
              </a>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

// ── compliance doc card (collapsible; markdown parsed only when open) ────────

function ComplianceDocCard({
  doc,
  index,
  onCopy,
  onPrint,
  variant = 'compliance',
}: {
  doc: ServedDoc;
  index: number;
  onCopy: (label: string, text: string) => void;
  onPrint: (label: string, sub: string, text: string) => void;
  variant?: 'compliance' | 'guide';
}) {
  const [open, setOpen] = useState(false);
  const isGuide = variant === 'guide';
  const purpose = isGuide
    ? 'The verbatim cold-outreach playbook for private security firms — the 15-minute meeting script, the daily operator workflow, the objections, the honesty table and the capture. If the app and the guide ever disagree, the app wins.'
    : compliancePurposeFor(doc.id);
  const draft = doc.id !== 'OFFER'; // the 4 pack files are DRAFT — REVIEW REQUIRED; the offer doc is an offer (state shown too)

  if (doc.error) {
    // Honest per-file failure — stated, never faked.
    return (
      <div className="rounded-lg border border-[rgba(255,77,95,0.3)] bg-[rgba(255,77,95,0.04)] p-3.5">
        <p className="text-[11px] font-semibold text-[#FF4D5F]" style={{ fontFamily: SANS }}>
          {doc.title} — UNREADABLE
        </p>
        <p className="mt-1 text-[9.5px] text-[rgba(244,244,245,0.6)]" style={{ fontFamily: MONO }}>
          {doc.file} · {doc.error}
        </p>
      </div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.25), ease: 'easeOut' }}
      className="flex flex-col rounded-lg border border-white/[0.07] bg-white/[0.02]"
      aria-label={`${isGuide ? 'Field guide' : 'Compliance document'} — ${doc.title}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-lg p-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <FileText aria-hidden className="size-4 shrink-0 text-[#C9A84C]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-[#F4F4F5]" style={{ fontFamily: SANS }}>
            {doc.title}
          </span>
          <span className="vvu-label mt-0.5 block truncate text-[7.5px] text-[rgba(244,244,245,0.4)]">
            {doc.file} · {doc.chars.toLocaleString()} chars{doc.mtimeIso ? ` · modified ${doc.mtimeIso.slice(0, 10)}` : ''}
          </span>
        </span>
        <span
          className="vvu-label inline-flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-[7px] font-bold"
          style={
            isGuide
              ? { color: LIME, borderColor: 'rgba(200,255,0,0.4)', background: 'rgba(200,255,0,0.06)' }
              : {
                  color: READY,
                  borderColor: 'rgba(245,166,35,0.4)',
                  background: 'rgba(245,166,35,0.06)',
                }
          }
          title={
            isGuide
              ? 'The cold-outreach playbook — served live from the repo file; the running app is canon on any conflict'
              : draft
                ? 'Compliance pack draft — review required before any customer use (manifest L7)'
                : 'Offer document — verify against the live price card before quoting'
          }
        >
          {isGuide ? 'FIELD GUIDE' : draft ? 'DRAFT — REVIEW REQUIRED' : 'OFFER DOC'}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-[rgba(244,244,245,0.4)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] p-3.5">
          {purpose && (
            <p className="mb-2.5 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.55)]" style={{ fontFamily: MONO }}>
              <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#C9A84C]">PURPOSE</span>
              {purpose}
            </p>
          )}
          <div className="custom-scrollbar max-h-[480px] overflow-y-auto rounded-md border border-white/[0.05] bg-white/[0.015] p-3">
            <MarkdownBody>{doc.markdown}</MarkdownBody>
          </div>
          <DocActions
            label={doc.id}
            text={doc.markdown}
            onCopy={onCopy}
            onPrint={onPrint}
          />
        </div>
      )}
    </motion.article>
  );
}

// ── workspace ────────────────────────────────────────────────────────────────

export function DocsWorkspace() {
  const totals = useMemo(() => fielddocsTotals(), []);
  const sendWormLog = useSendWormLog();
  const reduceMotion = useReducedMotion();
  const [, setView] = useHashRoute();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(NAV_SECTIONS[0].key);

  // The real serving address, detected at runtime. No URL is invented —
  // the master QR encodes exactly this + '#/docs'.
  const [origin, setOrigin] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState<boolean | null>(null);
  useEffect(() => {
    const host = window.location.hostname;
    setOrigin(window.location.origin);
    setIsLocal(host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '0.0.0.0');
  }, []);
  const masterPayload = origin ? `${origin}/#/docs` : null;

  // Compliance pack — fetched from disk via the fixed-allowlist route.
  const [pack, setPack] = useState<ServedDoc[] | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [packLoading, setPackLoading] = useState(true);
  const fetchPack = useCallback(async () => {
    setPackLoading(true);
    setPackError(null);
    try {
      const res = await fetch('/api/docs/compliance', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { docs: ServedDoc[] };
      setPack(data.docs);
    } catch {
      setPack(null);
      setPackError('the compliance route did not respond');
    } finally {
      setPackLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchPack();
  }, [fetchPack]);

  // The operator field guide (id GUIDE) renders in its own FG section —
  // derived once here, never re-found per render.
  const guideDoc = pack?.find((d) => d.id === 'GUIDE') ?? null;

  // Print sheet — a portal with a scoped @media print rule that hides
  // everything except the sheet. Raw text in <pre>: what the file says,
  // printed as it stands (drafts print with their draft state).
  const [printDoc, setPrintDoc] = useState<{ title: string; sub: string; text: string } | null>(null);
  useEffect(() => {
    if (!printDoc) return;
    const after = () => setPrintDoc(null);
    window.addEventListener('afterprint', after);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.print());
    });
    return () => {
      window.removeEventListener('afterprint', after);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [printDoc]);

  const onPrint = useCallback(
    (label: string, sub: string, text: string) => {
      sendWormLog('DOC_PRINTED', 'DOCS', `${label} · ${text.length} chars`);
      setPrintDoc({ title: label, sub, text });
    },
    [sendWormLog],
  );

  // One VIEW_OPEN WORM log per mount.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!loggedRef.current) {
      loggedRef.current = true;
      sendWormLog(
        'VIEW_OPEN',
        'DOCS',
        `the documents · ${totals.totalDocs} field documents · QR access (master + per-document text)`,
      );
    }
  }, [sendWormLog, totals.totalDocs]);

  // Section counts — derived, never hand-claimed.
  const sectionCounts: Record<string, number> = useMemo(
    () => ({
      qr: 1, // one master QR
      pitches: totals.priceRows > 0 ? PITCHES.length : 0,
      price: totals.priceRows,
      payment: totals.paymentRules,
      consent: totals.consentFields,
      compliance: totals.complianceFiles,
      emails: totals.emailDrafts,
    }),
    [totals],
  );

  // Scroll-spy (one observer per mount — sections are static).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.boundingClientRect.top < best.boundingClientRect.top) {
            best = entry;
          }
        }
        if (best) setActiveSection(best.target.id);
      },
      { root, rootMargin: '-12% 0px -72% 0px', threshold: 0 },
    );
    for (const s of NAV_SECTIONS) {
      const el = root.querySelector(`#${s.key}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback(
    (key: string) => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`#${key}`);
      if (root && el) {
        root.scrollTo({ top: el.offsetTop - 8, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    },
    [reduceMotion],
  );

  // COPY — clipboard with legacy fallback. The toast names the doc.
  const copyDoc = useCallback(
    (label: string, text: string) => {
      const onDone = () => {
        sendWormLog('DOC_COPIED', 'DOCS', `${label} · ${text.length} chars`);
        toast.success('DOCUMENT COPIED', {
          id: `docs-copy-${label}`,
          description: `${label} · ${text.length} chars on the clipboard — paste anywhere`,
        });
      };
      const onFail = () => {
        toast.error('CLIPBOARD BLOCKED', {
          id: `docs-copy-${label}`,
          description: 'browser denied write access — select the text manually',
        });
      };
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard
          .writeText(text)
          .then(onDone)
          .catch(() => (legacyCopyText(text) ? onDone() : onFail()));
      } else if (legacyCopyText(text)) {
        onDone();
      } else {
        onFail();
      }
    },
    [sendWormLog],
  );

  const heroDocs = useCountUp(totals.totalDocs);
  const heroTextQr = useCountUp(totals.builtInDocs);
  const heroDraft = useCountUp(totals.complianceFiles);
  const heroEmails = useCountUp(totals.emailDrafts);

  const heroStats: { label: string; value: number; color: string; sub: string }[] = [
    { label: 'Documents', value: heroDocs, color: '#F4F4F5', sub: 'everything the system supplies — on this screen' },
    { label: 'Text-QR ready', value: heroTextQr, color: PROVEN, sub: 'the QR carries the content itself — works offline' },
    { label: 'Draft — review', value: heroDraft, color: READY, sub: 'compliance files — until the lawyer signs (L7)' },
    { label: 'Email drafts', value: heroEmails, color: GOLD, sub: 'cross-referenced in #/commercial — not sent' },
  ];

  const priceText = useMemo(() => priceCardDocText(), []);
  const paymentText = useMemo(() => paymentDocText(), []);
  const consentText = useMemo(() => consentDocText(), []);

  return (
    <div
      role="region"
      aria-label="The documents — field access, QR, print and copy, counted honestly"
      className="absolute inset-0 flex overflow-hidden"
      style={{
        background: 'radial-gradient(at 50% 18%, #0E120B, #080907 72%)',
        color: '#F4F4F5',
      }}
    >
      {/* ── left nav (desktop) ─────────────────────────────────────────────── */}
      <nav
        aria-label="The documents sections"
        className="hidden w-[228px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/[0.06] p-3 lg:flex"
      >
        <div className="vvu-label flex items-center gap-2 px-2 pb-1 text-[9px] uppercase tracking-[0.18em] text-[rgba(244,244,245,0.4)]">
          Sections
          <span className="ml-auto rounded border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.06)] px-1.5 py-0.5 text-[8px] font-bold text-[#C9A84C]">
            {NAV_SECTIONS.length}
          </span>
        </div>
        {NAV_SECTIONS.map((s) => {
          const active = activeSection === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => scrollToSection(s.key)}
              aria-current={active ? 'location' : undefined}
              title={s.title}
              className={`vvu-label relative flex min-h-[36px] items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                active
                  ? 'border-white/[0.12] bg-white/[0.05] text-[#F4F4F5]'
                  : 'border-transparent text-[rgba(244,244,245,0.7)] hover:bg-white/[0.03] hover:text-[#F4F4F5]'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 w-[2px] rounded-full"
                  style={{ background: GOLD, boxShadow: '0 0 6px rgba(201,168,76,0.5)' }}
                />
              )}
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded border text-[8.5px] font-bold"
                style={
                  active
                    ? { borderColor: 'rgba(201,168,76,0.31)', background: 'rgba(201,168,76,0.07)', color: GOLD }
                    : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(244,244,245,0.4)' }
                }
              >
                {s.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="vvu-label text-[8px] text-[rgba(244,244,245,0.4)]">{sectionCounts[s.key]}</span>
            </button>
          );
        })}
        <div className="vvu-label mt-auto border-t border-white/[0.06] pt-2 text-[8px] leading-relaxed text-[rgba(244,244,245,0.4)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.07)] px-2 py-0.5 font-semibold uppercase tracking-[0.1em] text-[#c8ff00]">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#c8ff00]" />
            Task 46 · Field Access
          </span>
          <p className="mt-2 px-1">
            {totals.totalDocs} documents · text QRs capped at {totals.qrCap} chars. Counts derived from the ledgers.
          </p>
        </div>
      </nav>

      {/* ── right column ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* breadcrumb + honest state chip */}
        <div
          className="flex flex-none flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-5"
          style={{ background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="vvu-label flex min-w-0 flex-1 items-center gap-1.5 text-[8px] uppercase tracking-[0.14em] text-[rgba(244,244,245,0.4)]">
            <span className="text-[#C9A84C]">DOCS</span>
            <span aria-hidden className="opacity-30">▸</span>
            <span>THE DOCUMENTS · FIELD ACCESS</span>
            <span aria-hidden className="opacity-30">▸</span>
            <span className="truncate font-medium text-[rgba(244,244,245,0.85)]">
              {NAV_SECTIONS.find((s) => s.key === activeSection)?.title ?? '—'}
            </span>
          </div>
          <span
            className="vvu-label inline-flex items-center gap-1.5 rounded border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.06)] px-2 py-1 text-[7.5px] font-bold text-[#c8ff00]"
            title="Built phone-first: this is the view the master QR opens on the field device."
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#c8ff00]" />
            PHONE-FIRST CARRY
          </span>
        </div>

        {/* mobile section chips */}
        <div
          className="no-scrollbar flex flex-none items-stretch gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-1.5 lg:hidden"
          role="navigation"
          aria-label="The documents sections (compact)"
        >
          {NAV_SECTIONS.map((s) => {
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollToSection(s.key)}
                aria-current={active ? 'location' : undefined}
                className={`vvu-label flex min-h-[34px] shrink-0 items-center gap-1.5 rounded border px-2 text-[8px] font-semibold transition-colors ${
                  active
                    ? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] text-[#C9A84C]'
                    : 'border-white/[0.08] text-[rgba(244,244,245,0.55)]'
                }`}
              >
                <span className="font-bold">{s.code}</span>
                <span className="opacity-60">{sectionCounts[s.key]}</span>
              </button>
            );
          })}
        </div>

        {/* ── scroll body ─────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-28"
          role="presentation"
        >
          {/* hero */}
          <header
            className="relative overflow-hidden border-b border-white/[0.06] px-4 py-10 sm:px-8 lg:px-12"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.09), transparent)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(244,244,245,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,245,0.03) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="relative">
              <p className="vvu-label text-[9px] uppercase tracking-[0.22em] text-[#C9A84C]">
                Task 46 · The documents in your hand
              </p>
              <h1
                className="mt-2.5 max-w-[720px] text-[26px] font-bold leading-[1.12] text-[#F4F4F5] sm:text-[34px]"
                style={{ fontFamily: SANS }}
              >
                THE DOCUMENTS<span className="text-[#C9A84C]">.</span>{' '}
                <span className="text-[rgba(244,244,245,0.55)]">QR ACCESS · READ · COPY · PRINT</span>
              </h1>
              <p
                className="mt-3.5 max-w-[640px] text-[12.5px] leading-relaxed text-[rgba(244,244,245,0.62)]"
                style={{ fontFamily: SANS }}
              >
                The operator&rsquo;s field request: <em>&ldquo;I want to get the QR code — can I get these
                documents?&rdquo;</em> They exist now: every pitch, the price card, payment discipline, consent, the
                compliance pack — readable on this screen, scannable onto a phone, copyable, printable. No URL is
                invented anywhere on this view; the master QR encodes the address that actually serves this build,
                and every document&rsquo;s text QR carries the content itself.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {heroStats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                    aria-label={`${s.label}: ${s.value}`}
                  >
                    <p className="vvu-label text-[8px] uppercase tracking-[0.16em] text-[rgba(244,244,245,0.45)]">
                      {s.label}
                    </p>
                    <p className="mt-1.5 text-[22px] font-bold leading-none" style={{ color: s.color, fontFamily: MONO }}>
                      {s.value}
                    </p>
                    <p className="mt-1.5 text-[9px] leading-snug text-[rgba(244,244,245,0.45)]" style={{ fontFamily: SANS }}>
                      {s.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-8 lg:px-12">
            {/* ── QA · QR ACCESS ─────────────────────────────────────────────── */}
            <Section id="qr" label="QR access — the master QR and how the documents reach the phone">
              <SectionHead code="QA" title="QR ACCESS" sub="scan → read → copy · nothing invented" />
              <Panel>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <SubHead color={LIME}>THE MASTER QR — THIS VIEW ON A PHONE</SubHead>
                    <p className="text-[11px] leading-relaxed text-[rgba(244,244,245,0.7)]" style={{ fontFamily: SANS }}>
                      Open this view on the screen in front of you and scan with the phone camera. The QR encodes the
                      address this build is actually served from, plus <span style={{ fontFamily: MONO }}>#/docs</span>.
                      What is encoded is printed beside the QR in full — nothing hidden, nothing invented.
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {[
                        'SCAN the master QR with the phone camera — this view opens on the phone.',
                        'READ any document below — every section is the document itself.',
                        'COPY, PRINT, or open a text QR — the text QRs carry the content and need no server.',
                      ].map((step, i) => (
                        <div key={step} className="flex items-start gap-2.5">
                          <span
                            className="vvu-label flex size-5 shrink-0 items-center justify-center rounded border text-[8px] font-bold"
                            style={{ color: GOLD, borderColor: 'rgba(201,168,76,0.35)' }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-[10.5px] leading-relaxed text-[rgba(244,244,245,0.68)]" style={{ fontFamily: SANS }}>
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3.5">
                      <HonestNote label="HONEST">{QR_HONESTY.masterUrl}</HonestNote>
                    </div>
                    {isLocal && (
                      <div className="mt-2.5">
                        <HonestNote label="LOCAL ADDRESS">{QR_HONESTY.local}</HonestNote>
                      </div>
                    )}
                  </div>
                  <div>
                    <QrCard
                      label="MASTER — THE DOCUMENTS"
                      payload={masterPayload}
                      mode="LINK"
                      note={isLocal ? QR_HONESTY.local : undefined}
                    />
                    <p
                      className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.55)]"
                      style={{ fontFamily: MONO }}
                    >
                      <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#C9A84C]">DETECTED</span>
                      {origin ?? '—'}
                      <br />
                      <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#C9A84C]">STATUS</span>
                      {isLocal === null ? 'detecting…' : isLocal ? 'LOCAL — text QRs are the always-works path' : 'served address — scannable from any device that can reach it'}
                    </p>
                  </div>
                </div>
              </Panel>
            </Section>

            {/* ── FG · FIELD GUIDE · SECURITY FIRMS ─────────────────────────── */}
            <Section id="guide" label="The operator field guide — the cold-outreach playbook for private security firms, served from disk">
              <SectionHead code="FG" title="FIELD GUIDE · SECURITY FIRMS" sub="read from the repo file · the verbatim meeting playbook" />
              <Panel>
                <p className="mb-3 text-[11px] leading-relaxed text-[rgba(244,244,245,0.66)]" style={{ fontFamily: SANS }}>
                  The complete cold-outreach playbook for private security firms — the 15-minute meeting script, how
                  their operators use the system daily, the objections and answers, the honesty table, and the capture
                  before you leave the building. Served from{' '}
                  <span style={{ fontFamily: MONO }} className="text-[rgba(244,244,245,0.5)]">
                    docs/OPERATOR_FIELD_GUIDE.md
                  </span>{' '}
                  by the same fixed-allowlist disk route as the compliance pack. Expand to read on the phone; copy or
                  print to hand over.
                </p>
                {packLoading && (
                  <div className="flex min-h-[100px] items-center justify-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <Loader2 aria-hidden className="size-4 animate-spin text-[#7a8a6e]" />
                    <span className="vvu-label text-[9px] text-[rgba(244,244,245,0.55)]">
                      READING THE GUIDE FROM DISK…
                    </span>
                  </div>
                )}
                {!packLoading && packError && (
                  <div className="rounded-lg border border-[rgba(255,77,95,0.35)] bg-[rgba(255,77,95,0.05)] p-3.5">
                    <p className="text-[11px] font-semibold text-[#FF4D5F]" style={{ fontFamily: SANS }}>
                      FIELD GUIDE UNREACHABLE — {packError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void fetchPack()}
                      className="vvu-label mt-2.5 flex min-h-[44px] items-center gap-2 rounded-md border border-[rgba(255,77,95,0.4)] px-3 text-[9px] font-bold text-[#FF4D5F] transition-colors hover:bg-[rgba(255,77,95,0.08)]"
                    >
                      <RefreshCw aria-hidden className="size-3.5" />
                      RETRY
                    </button>
                  </div>
                )}
                {!packLoading && !packError && pack && !guideDoc && (
                  <div className="rounded-lg border border-[rgba(255,77,95,0.3)] bg-[rgba(255,77,95,0.04)] p-3.5">
                    <p className="text-[11px] font-semibold text-[#FF4D5F]" style={{ fontFamily: SANS }}>
                      FIELD GUIDE NOT IN THE ALLOWLIST RESPONSE
                    </p>
                    <p className="mt-1 text-[9.5px] text-[rgba(244,244,245,0.6)]" style={{ fontFamily: MONO }}>
                      docs/OPERATOR_FIELD_GUIDE.md — expected id GUIDE in /api/docs/compliance
                    </p>
                  </div>
                )}
                {!packLoading && !packError && guideDoc && (
                  <ComplianceDocCard doc={guideDoc} index={0} variant="guide" onCopy={copyDoc} onPrint={onPrint} />
                )}
              </Panel>
            </Section>

            {/* ── PI · THE THREE PITCHES ─────────────────────────────────────── */}
            <Section id="pitches" label="The three field pitches — verbatim, copy and QR ready">
              <SectionHead code="PI" title="THE THREE PITCHES" sub="verbatim · then demonstrate" />
              <div className="mb-3">
                <HonestNote label="ANTI-PATTERN">{PITCH_WARNING}</HonestNote>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {PITCHES.map((pitch, i) => (
                  <PitchDocCard key={pitch.id} pitch={pitch} index={i} onCopy={copyDoc} onPrint={onPrint} />
                ))}
              </div>
            </Section>

            {/* ── PC · PRICE CARD ────────────────────────────────────────────── */}
            <Section id="price" label="The price card v2 — sixteen rows, caveat carried with every copy">
              <SectionHead code="PC" title="PRICE CARD (V2)" sub="the canonical commercial menu" />
              <Panel>
                <div className="mb-3">
                  <HonestNote label="CAVEAT">{PRICE_CARD_CAVEAT}</HonestNote>
                </div>
                <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                  {PRICE_CARD.map((row) => (
                    <PriceDocRow key={row.id} row={row} />
                  ))}
                </div>
                <div
                  className="mt-3 rounded-lg border border-[rgba(61,255,176,0.25)] bg-[rgba(61,255,176,0.03)] p-3 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.6)]"
                  style={{ fontFamily: MONO }}
                >
                  <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#3DFFB0]">TRANSITION</span>
                  {PRICE_CARD_TRANSITION.join(' ')}
                </div>
                <DocActions label="PRICE CARD v2" text={priceText} onCopy={copyDoc} onPrint={onPrint} />
              </Panel>
            </Section>

            {/* ── PM · PAYMENT DISCIPLINE ────────────────────────────────────── */}
            <Section id="payment" label="Payment discipline — the six rules">
              <SectionHead code="PM" title="PAYMENT DISCIPLINE" sub="six rules · no exceptions in the field" />
              <Panel>
                <ol className="space-y-2">
                  {PAYMENT_DISCIPLINE.map((rule, i) => (
                    <li key={rule} className="flex items-start gap-2.5">
                      <span
                        className="vvu-label flex size-5 shrink-0 items-center justify-center rounded border text-[8px] font-bold"
                        style={{ color: GOLD, borderColor: 'rgba(201,168,76,0.35)' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-[11.5px] leading-relaxed text-[rgba(244,244,245,0.82)]" style={{ fontFamily: SANS }}>
                        {rule}
                      </p>
                    </li>
                  ))}
                </ol>
                <DocActions label="PAYMENT DISCIPLINE" text={paymentText} onCopy={copyDoc} onPrint={onPrint} />
              </Panel>
            </Section>

            {/* ── CN · CONSENT ───────────────────────────────────────────────── */}
            <Section id="consent" label="Consent — no money without a recorded consent event">
              <SectionHead code="CN" title="CONSENT" sub="no money without recorded consent" />
              <Panel>
                <blockquote
                  className="rounded-lg border-2 p-3.5 text-[12px] font-semibold leading-relaxed text-[#C9A84C]"
                  style={{ borderColor: 'rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.05)' }}
                >
                  &ldquo;{CONSENT_RULE}&rdquo;
                </blockquote>
                <div className="mt-3.5">
                  <SubHead>THE CONSENT RECORD — EIGHT FIELDS</SubHead>
                  <ul className="space-y-1.5">
                    {CONSENT_RECORD_FIELDS.map((f, i) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="vvu-label mt-0.5 text-[8px] font-bold text-[rgba(244,244,245,0.35)]" style={{ fontFamily: MONO }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] leading-relaxed text-[rgba(244,244,245,0.78)]" style={{ fontFamily: SANS }}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p
                  className="mt-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[9.5px] leading-relaxed text-[rgba(244,244,245,0.55)]"
                  style={{ fontFamily: MONO }}
                >
                  <span className="vvu-label mr-1.5 text-[7px] font-bold text-[#F5A623]">STATUS</span>
                  {CONSENT_STATUS}
                </p>
                <DocActions label="CONSENT SPEC" text={consentText} onCopy={copyDoc} onPrint={onPrint} />
              </Panel>
            </Section>

            {/* ── CP · COMPLIANCE PACK ───────────────────────────────────────── */}
            <Section id="compliance" label="The compliance pack — served from disk, DRAFT until the lawyer signs off">
              <SectionHead code="CP" title="COMPLIANCE PACK" sub="read from the repo files · DRAFT — REVIEW REQUIRED" />
              <Panel>
                <p className="mb-3 text-[11px] leading-relaxed text-[rgba(244,244,245,0.66)]" style={{ fontFamily: SANS }}>
                  These are the actual files from{' '}
                  <span style={{ fontFamily: MONO }} className="text-[rgba(244,244,245,0.5)]">
                    ProofBridge/compliance/
                  </span>{' '}
                  (and the offer document), served from disk by a fixed-allowlist route — the same bytes the lawyer
                  will review. Expand to read on the phone; copy or print to hand over.
                </p>
                {packLoading && (
                  <div className="flex min-h-[100px] items-center justify-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <Loader2 aria-hidden className="size-4 animate-spin text-[#7a8a6e]" />
                    <span className="vvu-label text-[9px] text-[rgba(244,244,245,0.55)]">
                      READING THE FILES FROM DISK…
                    </span>
                  </div>
                )}
                {packError && (
                  <div className="rounded-lg border border-[rgba(255,77,95,0.35)] bg-[rgba(255,77,95,0.05)] p-3.5">
                    <p className="text-[11px] font-semibold text-[#FF4D5F]" style={{ fontFamily: SANS }}>
                      COMPLIANCE DOCS UNREACHABLE — {packError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void fetchPack()}
                      className="vvu-label mt-2.5 flex min-h-[44px] items-center gap-2 rounded-md border border-[rgba(255,77,95,0.4)] px-3 text-[9px] font-bold text-[#FF4D5F] transition-colors hover:bg-[rgba(255,77,95,0.08)]"
                    >
                      <RefreshCw aria-hidden className="size-3.5" />
                      RETRY
                    </button>
                  </div>
                )}
                {pack && (
                  <div className="space-y-2.5">
                    {pack
                      .filter((doc) => doc.id !== 'GUIDE') // the guide renders in its own FG section
                      .map((doc, i) => (
                        <ComplianceDocCard key={doc.id} doc={doc} index={i} onCopy={copyDoc} onPrint={onPrint} />
                      ))}
                  </div>
                )}
              </Panel>
            </Section>

            {/* ── EM · THE FIVE EMAILS ───────────────────────────────────────── */}
            <Section id="emails" label="The five email drafts — cross-referenced to Day 1 commercial operations">
              <SectionHead code="EM" title="THE FIVE EMAILS" sub="cross-referenced · single source of truth" />
              <Panel>
                <p className="mb-3 text-[11px] leading-relaxed text-[rgba(244,244,245,0.66)]" style={{ fontFamily: SANS }}>
                  The five Day-1 email drafts live in one place —{' '}
                  <span style={{ fontFamily: MONO }} className="text-[rgba(244,244,245,0.5)]">
                    #/commercial
                  </span>{' '}
                  — so the copies can never diverge from the source. They are DRAFT — NOT SENT; this build has no
                  mailbox and never sends.
                </p>
                <ul className="space-y-2">
                  {EMAIL_DRAFTS.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="vvu-label text-[9px] font-bold text-[#C9A84C]" style={{ fontFamily: MONO }}>
                        {draft.id}
                      </span>
                      <span className="min-w-[140px] flex-1 text-[11px] font-medium text-[rgba(244,244,245,0.85)]" style={{ fontFamily: SANS }}>
                        {draft.to}
                        <span className="block text-[9px] font-normal text-[rgba(244,244,245,0.5)]">{draft.subject}</span>
                      </span>
                      <span
                        className="vvu-label rounded border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.06)] px-1.5 py-0.5 text-[7px] font-bold text-[#F5A623]"
                        title="Copy-ready from #/commercial — the operator personalises and sends from their own mailbox"
                      >
                        DRAFT — NOT SENT
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    sendWormLog('CROSSREF_OPEN', 'DOCS', '#/commercial — five email drafts (single source of truth)');
                    setView('commercial');
                  }}
                  className="vvu-label mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.07)] px-3 text-[9px] font-bold text-[#C9A84C] transition-colors hover:bg-[rgba(201,168,76,0.12)] sm:w-auto"
                >
                  OPEN #/COMMERCIAL — THE FIVE DRAFTS
                </button>
              </Panel>
            </Section>

            {/* closing honesty footer (derived) */}
            <footer className="mt-2 border-t border-white/[0.06] pt-4 pb-2">
              <p
                className="text-[9px] leading-relaxed text-[rgba(244,244,245,0.4)]"
                style={{ fontFamily: MONO }}
                aria-label="Derived counts footer"
              >
                {totals.totalDocs} documents ({totals.builtInDocs} built-in + {totals.complianceFiles} served from disk) ·
                {' '}text QRs capped at {totals.qrCap} chars · {totals.priceRows} price rows · {totals.paymentRules} payment
                rules · {totals.consentFields} consent fields · {totals.emailDrafts} email drafts cross-referenced ·
                compliance DRAFT — REVIEW REQUIRED until L7. Counts derived from the ledgers — the ledgers win.
              </p>
            </footer>
          </div>
        </div>
      </div>

      {/* ── print sheet (portal — the only thing on paper) ─────────────────── */}
      {printDoc &&
        createPortal(
          <>
            <style>{`@media print { body > *:not(#field-print-sheet) { display: none !important; } #field-print-sheet { display: block !important; position: static !important; } }`}</style>
            <div id="field-print-sheet" className="hidden bg-white text-[#111]">
              <div className="mx-auto max-w-[720px] p-8">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#666]">
                  ProofBridge — Field Document
                </p>
                <h1 className="mt-1.5 text-[20px] font-bold leading-tight">{printDoc.title}</h1>
                <p className="mt-1 text-[10px] text-[#666]">{printDoc.sub}</p>
                <hr className="my-4 border-[#ddd]" />
                <pre className="whitespace-pre-wrap text-[10.5px] leading-relaxed text-[#111]" style={{ fontFamily: MONO }}>
                  {printDoc.text}
                </pre>
                <hr className="my-4 border-[#ddd]" />
                <p className="text-[8.5px] leading-relaxed text-[#888]">
                  {PRICE_CARD_CAVEAT} Compliance documents remain DRAFT — REVIEW REQUIRED until legal sign-off (manifest
                  L7). Generated {new Date().toISOString()} from THE DOCUMENTS console (#/docs) — the WORM-receipted
                  build. No URL is invented on this sheet; text QRs on the console carry the content itself.
                </p>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
