'use client';

// src/components/commercial/CommercialWorkspace.tsx — ROUND 30 · tenth projection
// #/commercial — the COMMERCIAL DAY-1 workspace: the document supply the
// operator asked for in the field ("can I get these documents?").
//
//   · 17 price cards — per-card provenance (OFFER-DOC / RUNNER-DOC / SUMMONED)
//   · payment discipline — six operator rules, quotes verbatim
//   · QR STATION — self-contained text QRs (NO URL minted — estate rule #1:
//     never invent URLs; no public endpoint exists). Scan shows the offer
//     line itself, offline. Re-point payloads when a public address exists.
//   · five email drafts — DRAFT — NOT SENT · REBUILT FROM OFFER DOC
//   · FS Operating Standard — 15-question gate, all PENDING (3 REGULATORY)
//   · three-door opening scripts — never open with architecture
//
// Reconstruction disclosure lives in src/lib/commercial-data.ts (Zero
// Fabrication Rule): the prior session's commercial ledger was never
// persisted; this projection rebuilds it from surviving sources only.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  FileText,
  Gavel,
  Mail,
  QrCode,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import { Chip, SectionHeader, SectionReveal } from '@/components/analytics/shared';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { cn } from '@/lib/utils';
import {
  ALL_PRICE_CARDS,
  EMAIL_DRAFTS,
  FS_GATE,
  PAYMENT_DISCIPLINE,
  PRICELIST_QR_PAYLOAD,
  PRICING_DISCLOSURE,
  QR_STATION_DISCLOSURE,
  THREE_DOOR_SCRIPTS,
  priceCardQrPayload,
  type PriceCard,
} from '@/lib/commercial-data';

const SOURCE_TONE: Record<PriceCard['source'], { label: string; cls: string }> = {
  'OFFER-DOC': { label: 'OFFER-DOC', cls: 'border-[rgba(200,255,0,0.4)] text-[#c8ff00]' },
  'RUNNER-DOC': { label: 'RUNNER-DOC', cls: 'border-[rgba(143,179,90,0.4)] text-[#8fb35a]' },
  SUMMONED: { label: 'SUMMONED', cls: 'border-dashed border-[rgba(243,227,138,0.4)] text-[#f3e38a]' },
};

type SectionId = 'cards' | 'discipline' | 'qr' | 'emails' | 'fs' | 'doors';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'cards', label: `PRICE CARDS · ${ALL_PRICE_CARDS.length}` },
  { id: 'discipline', label: 'PAYMENT DISCIPLINE' },
  { id: 'qr', label: 'QR STATION' },
  { id: 'emails', label: 'EMAIL DRAFTS · 5' },
  { id: 'fs', label: 'FS GATE · 15' },
  { id: 'doors', label: 'THREE DOORS' },
];

export function CommercialWorkspace() {
  const sendWormLog = useSendWormLog();
  const [activeSection, setActiveSection] = useState<SectionId>('cards');
  const [openEmail, setOpenEmail] = useState<string | null>('sme');
  const [qrCard, setQrCard] = useState<string | null>(null);

  // View entry is WORM-logged like every projection (append-only, no silent views).
  useEffect(() => {
    sendWormLog('VIEW_MODE', 'COMMERCIAL', '#/commercial opened — 16 cards · QR station · 5 drafts');
  }, [sendWormLog]);

  const copyText = useCallback(
    (text: string, label: string, kind: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success(`COPIED — ${label}`, { description: 'WORM COPY event appended to ledger' });
          sendWormLog('COMMERCIAL_COPY', 'OPERATOR', `${kind}: ${label} → clipboard`);
          fetch('/api/vvu/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actor: 'OPERATOR',
              action: 'COMMERCIAL_COPY',
              fromState: 'COMMERCIAL_VIEW',
              toState: 'COMMERCIAL_VIEW',
              symbol: 'COPY',
              reason: `${kind}: ${label}`,
            }),
          }).catch(() => {
            /* offline — audit is best-effort */
          });
        })
        .catch(() => {
          toast.error('CLIPBOARD BLOCKED', { description: 'Browser denied clipboard access' });
        });
    },
    [sendWormLog]
  );

  const jump = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`commercial-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-scroll">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <SectionHeader
          num="10"
          title="COMMERCIAL · DAY-1 SUPPLY"
          kicker="ROUND 30 · TENTH PROJECTION · REBUILT AFTER SESSION LOSS"
          right={<Chip tone="lime">OFFERS / TARGETS — NOT PRODUCTION CLAIMS</Chip>}
        />

        {/* section nav — touch-friendly chips */}
        <nav aria-label="Commercial sections" className="flex flex-wrap gap-1.5 sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#060806]/95 backdrop-blur-sm border-b border-[rgba(107,138,64,0.2)]">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              aria-current={activeSection === s.id ? 'true' : undefined}
              className={cn(
                'vvu-label text-[8px] sm:text-[9px] px-2.5 py-2 min-h-[36px] rounded-sm border transition-all select-none',
                activeSection === s.id
                  ? 'border-[rgba(200,255,0,0.55)] text-[#c8ff00] bg-[rgba(200,255,0,0.06)]'
                  : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(200,255,0,0.35)] hover:text-[#c8ff00]'
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ── reconstruction disclosure ───────────────────────────────────── */}
        <SectionReveal featured>
          <div className="p-4 sm:p-5 border border-[rgba(229,72,77,0.35)] bg-[rgba(229,72,77,0.04)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#e5484d]" aria-hidden />
              <div className="space-y-2 min-w-0">
                <div className="vvu-label text-[10px] text-[#e5484d] tracking-[0.2em]">REGRESSION — REBUILT</div>
                <p className="vvu-label text-[9px] sm:text-[10px] leading-relaxed text-[#c9d4bd]">
                  The prior session supplied a commercial ledger that was <span className="text-[#e5484d]">never persisted to this repo</span> —
                  its files, commit and worklog entry did not survive the session cutoff. This projection rebuilds the supply from surviving
                  sources only. Per-card provenance is labelled; nothing here claims production verification.
                </p>
                <p className="vvu-label text-[9px] sm:text-[10px] leading-relaxed text-[#7a8a6e]">{PRICING_DISCLOSURE.body}</p>
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* ── price cards ────────────────────────────────────────────────── */}
        <section id="commercial-cards" aria-label="Price cards" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5" aria-hidden /> {ALL_PRICE_CARDS.length} PRICE CARDS
            </div>
            <div className="vvu-label text-[8px] text-[#7a8a6e] flex gap-2 flex-wrap">
              <span className="text-[#c8ff00]">■ OFFER-DOC = verbatim</span>
              <span className="text-[#8fb35a]">■ RUNNER-DOC = hardware list</span>
              <span className="text-[#f3e38a]">■ SUMMONED = reconstructed</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ALL_PRICE_CARDS.map((card) => (
              <article
                key={card.id}
                className="vvu-panel-solid p-4 flex flex-col gap-2.5 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="vvu-label text-[10px] text-[#f3e38a] leading-snug tracking-wide">{card.name}</h3>
                  <span
                    className={cn(
                      'vvu-label text-[7.5px] px-1.5 py-0.5 rounded-sm border shrink-0',
                      SOURCE_TONE[card.source].cls
                    )}
                    title={`Source: ${card.sourceRef}`}
                  >
                    {SOURCE_TONE[card.source].label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="vvu-label text-lg sm:text-xl font-bold text-[#c8ff00] tabular-nums">{card.price}</span>
                  <span className="vvu-label text-[8px] text-[#7a8a6e]">{card.unit}</span>
                </div>

                <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{card.oneLine}</p>

                <ul className="space-y-1 min-w-0">
                  {card.includes.map((inc) => (
                    <li key={inc} className="vvu-label text-[8px] text-[#7a8a6e] flex items-start gap-1.5">
                      <Check className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
                      <span className="min-w-0">{inc}</span>
                    </li>
                  ))}
                </ul>

                <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e] border-t border-[rgba(107,138,64,0.2)] pt-2">
                  {card.componentNote}
                </p>

                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <button
                    onClick={() => copyText(priceCardQrPayload(card), card.name, 'PRICE_CARD')}
                    className="vvu-label text-[8px] flex-1 min-h-[36px] px-2 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" aria-hidden /> COPY OFFER LINE
                  </button>
                  <button
                    onClick={() => setQrCard(qrCard === card.id ? null : card.id)}
                    aria-expanded={qrCard === card.id}
                    aria-label={`Toggle QR for ${card.name}`}
                    className={cn(
                      'vvu-label text-[8px] min-h-[36px] min-w-[36px] px-2 rounded-sm border transition-all flex items-center justify-center',
                      qrCard === card.id
                        ? 'border-[rgba(200,255,0,0.6)] text-[#c8ff00] bg-[rgba(200,255,0,0.07)]'
                        : 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00]'
                    )}
                  >
                    <QrCode className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>

                {qrCard === card.id && (
                  <div className="flex flex-col items-center gap-2 pt-2 border-t border-[rgba(107,138,64,0.2)]">
                    <div className="bg-white p-2 rounded-sm">
                      <QRCodeSVG value={priceCardQrPayload(card)} size={148} level="M" />
                    </div>
                    <p className="vvu-label text-[7px] text-[#7a8a6e] text-center leading-relaxed">
                      SELF-CONTAINED TEXT QR — scan shows the offer line. No URL (estate rule: never invent URLs).
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ── payment discipline ─────────────────────────────────────────── */}
        <section id="commercial-discipline" aria-label="Payment discipline" className="space-y-3">
          <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
            <Gavel className="w-3.5 h-3.5" aria-hidden /> PAYMENT DISCIPLINE — 6 RULES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PAYMENT_DISCIPLINE.map((rule) => (
              <div key={rule.id} className="vvu-panel-solid p-4 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">{String(rule.id).padStart(2, '0')}</span>
                  <h3 className="vvu-label text-[9.5px] text-[#c8ff00] tracking-wide">{rule.rule}</h3>
                </div>
                <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{rule.detail}</p>
                {rule.quote && (
                  <p className="vvu-label text-[7.5px] leading-relaxed text-[#f3e38a] border-l-2 border-[rgba(243,227,138,0.4)] pl-2">
                    {rule.quote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── QR station ─────────────────────────────────────────────────── */}
        <section id="commercial-qr" aria-label="QR station" className="space-y-3">
          <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
            <QrCode className="w-3.5 h-3.5" aria-hidden /> QR STATION — FIELD SUPPLY
          </div>
          <SectionReveal featured>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
              <div className="justify-self-center bg-white p-3 rounded-sm">
                <QRCodeSVG value={PRICELIST_QR_PAYLOAD} size={200} level="M" />
              </div>
              <div className="space-y-3 min-w-0">
                <div className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.15em]">FULL PRICE LIST — SCAN ON SITE</div>
                <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">
                  One scan, offline: the full price summary a prospect can read on their own phone. No app, no
                  server, no link to explain. When they ask &quot;what does it cost?&quot; — show the code, let them scan,
                  then talk.
                </p>
                <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e] border-l-2 border-[rgba(243,227,138,0.4)] pl-2">
                  {QR_STATION_DISCLOSURE}
                </p>
                <button
                  onClick={() => copyText(PRICELIST_QR_PAYLOAD, 'FULL PRICE LIST', 'PRICELIST')}
                  className="vvu-label text-[8px] min-h-[40px] px-3 rounded-sm border border-[rgba(200,255,0,0.45)] text-[#c8ff00] hover:bg-[rgba(200,255,0,0.07)] transition-all flex items-center gap-1.5 w-fit"
                >
                  <Copy className="w-3 h-3" aria-hidden /> COPY PRICE LIST TEXT
                </button>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── email drafts ───────────────────────────────────────────────── */}
        <section id="commercial-emails" aria-label="Email drafts" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" aria-hidden /> FIVE EMAIL DRAFTS
            </div>
            <Chip tone="crimson">ALL: DRAFT — NOT SENT</Chip>
          </div>

          <div className="space-y-2.5">
            {EMAIL_DRAFTS.map((draft) => {
              const open = openEmail === draft.id;
              return (
                <div key={draft.id} className="vvu-panel-solid min-w-0">
                  <button
                    onClick={() => setOpenEmail(open ? null : draft.id)}
                    aria-expanded={open}
                    className="w-full flex items-start justify-between gap-3 p-3.5 text-left hover:bg-[rgba(107,138,64,0.06)] transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="vvu-label text-[7.5px] text-[#8fb35a] tracking-[0.15em]">{draft.door}</div>
                      <div className="vvu-label text-[9.5px] text-[#f3e38a] leading-snug">{draft.subject}</div>
                      <div className="vvu-label text-[7.5px] text-[#7a8a6e] truncate">TO: {draft.to}</div>
                    </div>
                    <span className={cn('vvu-label text-[8px] text-[#7a8a6e] shrink-0 mt-1', open && 'text-[#c8ff00]')}>
                      {open ? '▲' : '▼'}
                    </span>
                  </button>

                  {open && (
                    <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-[rgba(107,138,64,0.2)] pt-3">
                      {draft.body.map((para, i) => (
                        <p key={i} className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">
                          {para}
                        </p>
                      ))}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <span className="vvu-label text-[7px] text-[#e5484d] tracking-wide">{draft.label}</span>
                        <button
                          onClick={() =>
                            copyText(`Subject: ${draft.subject}\n\n${draft.body.join('\n\n')}`, draft.subject, 'EMAIL_DRAFT')
                          }
                          className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center gap-1.5"
                        >
                          <Copy className="w-3 h-3" aria-hidden /> COPY DRAFT
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── FS operating standard gate ─────────────────────────────────── */}
        <section id="commercial-fs" aria-label="FS Operating Standard gate" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden /> FS OPERATING STANDARD — 15-QUESTION GATE
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Chip tone="amber">12 PENDING</Chip>
              <Chip tone="crimson">3 REGULATORY PENDING</Chip>
            </div>
          </div>

          <div className="vvu-panel-solid divide-y divide-[rgba(107,138,64,0.15)]">
            {FS_GATE.map((q) => (
              <div key={q.id} className="p-3 sm:p-3.5 flex items-start gap-3">
                <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums mt-0.5 shrink-0">
                  {String(q.id).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{q.question}</p>
                  <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">{q.note}</p>
                </div>
                <span
                  className={cn(
                    'vvu-label text-[7px] px-1.5 py-0.5 rounded-sm border shrink-0 mt-0.5 whitespace-nowrap',
                    q.status === 'REGULATORY PENDING'
                      ? 'border-[rgba(229,72,77,0.45)] text-[#e5484d]'
                      : 'border-[rgba(243,227,138,0.35)] text-[#f3e38a]'
                  )}
                >
                  {q.status}
                </span>
              </div>
            ))}
          </div>

          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            RECONSTRUCTED GATE — the prior session&apos;s 15 questions were not persisted. These rebuild the gate from the
            operator&apos;s three standing directives (ToS per service · complaints process · consent before payment) plus the
            SA financial-services domains disclosed in the offer document. No question is answered until the operator
            confirms each in writing.
          </p>
        </section>

        {/* ── three-door scripts ─────────────────────────────────────────── */}
        <section id="commercial-doors" aria-label="Three-door opening scripts" className="space-y-3">
          <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" aria-hidden /> THREE-DOOR OPENING SCRIPTS
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {THREE_DOOR_SCRIPTS.map((door) => (
              <div key={door.id} className="vvu-panel-solid p-4 space-y-2.5 min-w-0">
                <div className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.12em]">{door.door}</div>
                <div className="vvu-label text-[8px] text-[#f3e38a]">{door.opensWith}</div>
                <ul className="space-y-2">
                  {door.lines.map((line, i) => (
                    <li key={i} className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(143,179,90,0.35)] pl-2.5">
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="vvu-label text-[7.5px] leading-relaxed text-[#e5484d] border-t border-[rgba(107,138,64,0.2)] pt-2">
                  {door.neverDo}
                </p>
                <button
                  onClick={() => copyText(`${door.door}\n${door.opensWith}\n\n${door.lines.join('\n\n')}\n\nNEVER: ${door.neverDo}`, door.door, 'DOOR_SCRIPT')}
                  className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center gap-1.5 w-fit"
                >
                  <Copy className="w-3 h-3" aria-hidden /> COPY SCRIPT
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── footer note ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 pb-4">
          <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            Every COPY on this projection is WORM-logged (clipboard → toast → ledger → audit table). The offer document
            (blockchain-detection-offer.md v0.1) remains the only signed-source commercial text; where this projection and
            the offer doc differ, the offer doc governs. Sending the five drafts remains an operator-only action — no
            automation sends email.
          </p>
        </div>
      </div>
    </div>
  );
}
