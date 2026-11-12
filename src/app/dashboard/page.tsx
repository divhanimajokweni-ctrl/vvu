'use client';

// The validation dashboard — accessible from the console's "Validation" nav button.
// Has a "Back to Console" link that returns to /#/validation (the unified console).

import { lazy, Suspense, useEffect } from 'react';

const ValidationDashboard = lazy(() =>
  import('@/components/vvu/ValidationDashboard').then(m => ({ default: m.ValidationDashboard }))
);

export default function DashboardPage() {
  // When the user navigates to /dashboard, update the console's hash
  // so when they go back, the console shows the validation module
  useEffect(() => {
    // intercept hash changes to go back to console
    const onHashChange = () => {
      if (window.location.hash === '#/validation' || window.location.hash === '') {
        // user clicked "back to console" — navigate to the console
        window.location.href = '/';
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-[#060806]">
      {/* Back to Console bar */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px', background: 'rgba(12,11,9,0.9)',
          backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(240,234,214,0.08)',
          height: 48,
        }}
      >
        <a
          href="/#/validation"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
            color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em',
            textDecoration: 'none', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Console
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/pricing" style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
            color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.08em',
            textDecoration: 'none', cursor: 'pointer',
          }}>
            Pricing
          </a>
          <span style={{ color: '#6b6d7a' }}>·</span>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b6d7a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            VVU · Validation Dashboard
          </div>
        </div>
      </div>
      <div style={{ paddingTop: 48 }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#f3e38a', fontFamily: 'monospace' }}>Loading validation dashboard…</div>}>
          <ValidationDashboard />
        </Suspense>
      </div>
    </div>
  );
}
