'use client';

// src/app/page.tsx — VVU Unified Console
//
// The unified console is the landing page. The hero section (from the
// vvu_unified_console HTML template) is the first thing you see.
// The validation dashboard (the estate with 30+ workspaces) is embedded
// as a module within the console — accessible via the "Console" nav
// button or the "Launch Telemetry" CTA.
//
// Structure:
//   - Hero (the unified console's home module) → landing
//   - Validation Dashboard → accessible from nav or CTA
//   - 7 modules total: Hero, Dashboard, Onboarding, Compiler, Auth, Pools, Bridge, Studio

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import Script from 'next/script';

const ValidationDashboard = lazy(() =>
  import('@/components/vvu/ValidationDashboard').then(m => ({ default: m.ValidationDashboard }))
);

const MODULES = [
  { id: 'home', label: 'Hero', icon: 'cube' },
  { id: 'dashboard', label: 'Console', icon: 'chart-line' },
  { id: 'onboarding', label: 'Onboarding', icon: 'layer-group' },
  { id: 'compiler', label: 'Compiler', icon: 'vr-cardboard' },
  { id: 'auth', label: 'Auth', icon: 'shield-halved' },
  { id: 'pools', label: 'Pools', icon: 'people-group' },
  { id: 'proof', label: 'Bridge', icon: 'link' },
  { id: 'studio', label: 'Studio', icon: 'music' },
];

const THEMES = ['dark', 'light', 'cyber'] as const;
type Theme = typeof THEMES[number];

const THEME_CSS: Record<Theme, string> = {
  dark: `--bg:#0c0b09;--bg-elev:#14120e;--bg-card:#1a1d28;--bg-card-2:#21242f;--fg:#f0ead6;--fg-dim:#a8a496;--muted:#6b6d7a;--accent:#f59e0b;--accent-2:#06b6d4;--accent-3:#4dd4ac;--accent-4:#ff5e62;--border:rgba(240,234,214,.08);--border-strong:rgba(240,234,214,.18);--glow:rgba(245,158,11,.15);--nav-bg:rgba(12,11,9,.74)`,
  light: `--bg:#f3ecdc;--bg-elev:#faf3e1;--bg-card:#fffaee;--bg-card-2:#fdf5e6;--fg:#1a1610;--fg-dim:#3d362b;--muted:#6b6358;--accent:#c2410c;--accent-2:#0e7490;--accent-3:#0d9488;--accent-4:#dc2626;--border:rgba(26,22,16,.12);--border-strong:rgba(26,22,16,.24);--glow:rgba(194,65,12,.12);--nav-bg:rgba(243,236,220,.80)`,
  cyber: `--bg:#02060a;--bg-elev:#050d10;--bg-card:#071318;--bg-card-2:#0a1c24;--fg:#4eff96;--fg-dim:#8affb8;--muted:#2a8a5e;--accent:#ffea00;--accent-2:#ff10f0;--accent-3:#4eff96;--accent-4:#ff10f0;--border:rgba(78,255,150,.18);--border-strong:rgba(78,255,150,.4);--glow:rgba(78,255,150,.2);--nav-bg:rgba(2,6,10,.82)`,
};

// Font Awesome icons (inline SVG to avoid CDN dependency on the nav)
const ICONS: Record<string, string> = {
  'cube': 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'chart-line': 'M3 3v18h18M7 14l4-4 4 4 6-6',
  'layer-group': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'vr-cardboard': 'M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.5a2 2 0 0 1-1.6-.8L12 14l-2.9 3.2a2 2 0 0 1-1.6.8H4a2 2 0 0 1-2-2V8z',
  'shield-halved': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'people-group': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'link': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  'music': 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'moon': 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  'sun': 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  'terminal': 'M4 17l6-6-6-6M12 19h8',
};

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={d} />
    </svg>
  );
}

function ViewLoader({ label }: { label: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.3em' }}>VVU</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--muted)', marginTop: '12px', animation: 'pulse 1.5s infinite' }}>{label}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeModule, setActiveModule] = useState('home');
  const [theme, setTheme] = useState<Theme>('dark');
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroShapeRef = useRef<HTMLDivElement>(null);

  // Read theme from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vvu-theme') as Theme;
      if (THEMES.includes(saved)) setTheme(saved);
    } catch { /* */ }
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('vvu-theme', theme); } catch { /* */ }
  }, [theme]);

  // Hash routing
  useEffect(() => {
    const readHash = () => {
      const h = window.location.hash;
      if (h.startsWith('#/')) {
        const name = h.slice(2);
        if (MODULES.some(m => m.id === name)) {
          setActiveModule(name);
          return;
        }
      }
      setActiveModule('home');
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  // Scroll progress
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Triple-tap gesture
  useEffect(() => {
    let taps = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, .nav-links')) return;
      taps++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { taps = 0; }, 400);
      if (taps >= 3) {
        taps = 0;
        const idx = THEMES.indexOf(theme);
        setTheme(THEMES[(idx + 1) % THEMES.length]);
      }
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchend', handler, { passive: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchend', handler);
    };
  }, [theme]);

  const goModule = (id: string) => {
    window.location.hash = `#/${id}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div style={{
      '--sans': "'Space Grotesk',-apple-system,BlinkMacSystemFont,sans-serif",
      '--serif': "'Fraunces',Georgia,serif",
      '--mono': "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
      '--nav-h': '72px',
      ...Object.fromEntries(THEME_CSS[theme].split(';').filter(s => s.trim()).map(s => {
        const [k, v] = s.split(':');
        return [k.trim(), v];
      })),
    } as React.CSSProperties}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes livePulse { 0%{transform:scale(.8);opacity:1} 100%{transform:scale(2.2);opacity:0} }
        @keyframes marqueeMove { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes moduleIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .module { display: none; }
        .module.active { display: block; animation: moduleIn .4s cubic-bezier(.4,0,.2,1); }
        .live-dot { width:7px; height:7px; background:var(--accent); border-radius:50%; display:inline-block; position:relative; margin-right:8px; }
        .live-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; border:1.5px solid var(--accent); animation:livePulse 2s infinite; }
        .bg-grid { background-image: linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px); background-size:60px 60px; }
      `}</style>

      {/* Scroll progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: 2, width: `${scrollProgress}%`, background: `linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3))`, zIndex: 120, transition: 'width .08s linear', boxShadow: '0 0 12px var(--accent)' }} />

      {/* Atmosphere */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: `radial-gradient(circle,var(--glow) 0%,transparent 60%)`, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: `radial-gradient(circle,rgba(6,182,212,.08) 0%,transparent 60%)`, filter: 'blur(60px)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 60, padding: '12px 28px', minHeight: 'var(--nav-h)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 21, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 9, color: 'var(--fg)' }}>
          <span style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: 14, fontWeight: 900, transform: 'rotate(-8deg)' }}>V</span>
          VVU
          <small style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 400, marginLeft: 2 }}>UNIFIED</small>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {MODULES.map(m => {
            const active = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => goModule(m.id)}
                style={{
                  fontFamily: 'var(--mono)', fontSize: '10.5px', letterSpacing: '0.09em', textTransform: 'uppercase',
                  background: active ? 'var(--accent)' : 'transparent', border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  color: active ? 'var(--bg)' : 'var(--fg-dim)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .22s',
                  fontWeight: active ? 700 : 400,
                }}
              >
                <Icon name={m.icon} />
                <span className="nav-label" style={{ display: typeof window !== 'undefined' && window.innerWidth < 650 ? 'none' : 'inline' }}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: 3, gap: 2 }}>
          {THEMES.map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: 'none', background: theme === t ? 'var(--accent)' : 'transparent',
                color: theme === t ? 'var(--bg)' : 'var(--muted)', transition: 'all .35s',
              }}
              title={t}
            >
              <Icon name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'terminal'} size={12} />
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* HERO MODULE */}
        <div className={`module ${activeModule === 'home' ? 'active' : ''}`}>
          <HeroSection onLaunch={() => goModule('dashboard')} />
        </div>

        {/* DASHBOARD MODULE (the validation dashboard) */}
        <div className={`module ${activeModule === 'dashboard' ? 'active' : ''}`}>
          <Suspense fallback={<ViewLoader label="INITIALIZING VALIDATION DASHBOARD…" />}>
            <ValidationDashboard />
          </Suspense>
        </div>

        {/* PLACEHOLDER MODULES (the other 6 from the console template) */}
        {['onboarding', 'compiler', 'auth', 'pools', 'proof', 'studio'].map(modId => {
          const mod = MODULES.find(m => m.id === modId)!;
          return (
            <div key={modId} className={`module ${activeModule === modId ? 'active' : ''}`}>
              <PlaceholderModule title={mod.label} />
            </div>
          );
        })}
      </main>

      {/* Footer */}
      <footer style={{ padding: '70px 40px 40px', borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 60, marginBottom: 50 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 21, display: 'flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
              <span style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: 14, fontWeight: 900, transform: 'rotate(-8deg)' }}>V</span>
              VVU
            </div>
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, lineHeight: 1.45, color: 'var(--fg)', maxWidth: 520 }}>
              "Every pixel on your screen is bound to a sensor reading with a confidence score, and if the sensor is off, the screen tells you."
              <span style={{ display: 'block', marginTop: 12, fontStyle: 'normal', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)', letterSpacing: '0.05em' }}>— VVU Design Doctrine</span>
            </p>
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Modules</h4>
            {MODULES.map(m => (
              <a key={m.id} onClick={() => goModule(m.id)} style={{ display: 'block', color: 'var(--fg-dim)', textDecoration: 'none', fontSize: '13.5px', padding: '4px 0', cursor: 'pointer', transition: 'color .2s' }}>{m.label}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Ecosystem</h4>
            <a style={{ display: 'block', color: 'var(--fg-dim)', textDecoration: 'none', fontSize: '13.5px', padding: '4px 0', cursor: 'pointer' }}>Free City</a>
            <a style={{ display: 'block', color: 'var(--fg-dim)', textDecoration: 'none', fontSize: '13.5px', padding: '4px 0', cursor: 'pointer' }}>HostAfrica Affiliate</a>
            <a style={{ display: 'block', color: 'var(--fg-dim)', textDecoration: 'none', fontSize: '13.5px', padding: '4px 0', cursor: 'pointer' }}>Obsidian Export</a>
            <a style={{ display: 'block', color: 'var(--fg-dim)', textDecoration: 'none', fontSize: '13.5px', padding: '4px 0', cursor: 'pointer' }}>POPIA Compliance</a>
          </div>
        </div>
        <div style={{ maxWidth: 1400, margin: '0 auto', paddingTop: 28, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--muted)' }}>
          <span>© 2026 Venture Vision Ubuntu — handcrafted with geometry</span>
          <span>v 3.0 · fail-closed · unified</span>
        </div>
      </footer>
    </div>
  );
}

// ─── The Hero Section (the unified console's home module) ────────────────
function HeroSection({ onLaunch }: { onLaunch: () => void }) {
  return (
    <>
      <section className="bg-grid" style={{ minHeight: 'calc(100dvh - 72px)', padding: '70px 40px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center', position: 'relative' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', border: '1px solid var(--border-strong)', borderRadius: 100, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--fg-dim)', letterSpacing: '0.05em', marginBottom: 30 }}>
            <span className="live-dot" />
            LIVE · FAIL-CLOSED · POPIA COMPLIANT
          </div>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(44px,6.5vw,88px)', lineHeight: 0.96, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.03em', color: 'var(--fg)' }}>
            Provable<br />
            <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(135deg,var(--accent) 0%,var(--accent-2) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Digital Twins.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--fg-dim)', maxWidth: 480, margin: '0 0 38px', lineHeight: 1.65 }}>
            One world. One StateVector bus. One WORM chain. Every pixel on your screen is cryptographically bound to a physical sensor reading. If the sensor drops, the twin tells the truth.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button onClick={onLaunch} style={{ background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600, padding: '14px 26px', borderRadius: 10, transition: 'all .25s', display: 'inline-flex', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', fontSize: '14.5px', fontFamily: 'inherit' }}>
              Launch Telemetry <Icon name="arrow-right" size={12} />
            </button>
            <button onClick={onLaunch} style={{ background: 'transparent', color: 'var(--fg)', fontWeight: 500, padding: '14px 26px', borderRadius: 10, border: '1px solid var(--border-strong)', transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '14.5px', fontFamily: 'inherit' }}>
              View WORM Ledger
            </button>
          </div>
        </div>

        {/* Morphing blob SVG */}
        <div style={{ position: 'relative', aspectRatio: 1, maxWidth: 560, marginLeft: 'auto' }}>
          <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
            <defs>
              <radialGradient id="blobGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="strokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="50%" stopColor="var(--accent-2)" />
                <stop offset="100%" stopColor="var(--accent-3)" />
              </linearGradient>
            </defs>
            <line x1="250" y1="20" x2="250" y2="480" stroke="var(--border-strong)" strokeDasharray="2 6" />
            <line x1="20" y1="250" x2="480" y2="250" stroke="var(--border-strong)" strokeDasharray="2 6" />
            <circle cx="250" cy="250" r="3" fill="var(--accent)" />
            <circle cx="250" cy="250" r="8" fill="none" stroke="var(--accent)" strokeOpacity="0.4" />
            {/* Animated morphing polygon */}
            <MorphBlob />
          </svg>
          <div style={{ position: 'absolute', top: '6%', left: '2%', fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.6 }}>
            entity: H01 (Life Twin)<br />sensor: YOLOv8 + IMU
          </div>
          <div style={{ position: 'absolute', bottom: '6%', right: '2%', fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.6, textAlign: 'right' }}>
            StateVector → Mesh<br />Chain: VERIFIED
          </div>
          <span style={{ position: 'absolute', top: '10%', right: '-4%', fontSize: 40, color: 'var(--accent)', opacity: 0.25, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>∫</span>
          <span style={{ position: 'absolute', bottom: '18%', left: '-6%', fontSize: 34, color: 'var(--accent-2)', opacity: 0.25, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>π</span>
        </div>
      </section>

      {/* Marquee */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '26px 0', overflow: 'hidden', position: 'relative', background: 'var(--bg-elev)' }}>
        <div style={{ display: 'flex', gap: 60, whiteSpace: 'nowrap', animation: 'marqueeMove 55s linear infinite', fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic', color: 'var(--fg-dim)' }}>
          {['YOLOv8', 'SEV-SNP', 'POPIA', 'SHA-256', 'TrueDepth', 'StateVector', 'Obsidian', 'WORM', 'Ed25519', 'Kalman Filter', 'MIT License', 'Free City'].map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 60 }}>
              {s}<span style={{ color: 'var(--accent)', fontStyle: 'normal', fontSize: 15 }}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Morphing blob animation ──────────────────────────────────────────────
function MorphBlob() {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const N = 12;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 150 + Math.random() * 40;
      pts.push([250 + Math.cos(a) * r, 250 + Math.sin(a) * r]);
    }

    let frame = 0;
    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      frame += 0.008;
      const animated = pts.map(([x, y], i) => {
        const a = (i / N) * Math.PI * 2;
        const r = 150 + Math.sin(frame + i * 0.5) * 30 + Math.cos(frame * 1.3 + i) * 15;
        return [250 + Math.cos(a) * r, 250 + Math.sin(a) * r] as [number, number];
      });

      // Catmull-Rom to Bezier
      let d = '';
      for (let i = 0; i < N; i++) {
        const p0 = animated[(i - 1 + N) % N];
        const p1 = animated[i];
        const p2 = animated[(i + 1) % N];
        const p3 = animated[(i + 2) % N];
        if (i === 0) d += `M ${p1[0].toFixed(2)},${p1[1].toFixed(2)} `;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += `C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} `;
      }
      d += 'Z';
      if (ref.current) {
        ref.current.setAttribute('d', d);
      }
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <path ref={ref} fill="url(#blobGrad)" />
      <path ref={ref} fill="none" stroke="url(#strokeGrad)" strokeWidth={2} />
    </>
  );
}

// ─── Placeholder for the console's other modules ─────────────────────────
function PlaceholderModule({ title }: { title: string }) {
  return (
    <div style={{ minHeight: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 40 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--fg)' }}>{title}</h2>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>module ready · wired to estate APIs</p>
    </div>
  );
}
