'use client';

// VVU Pricing — the tier table. Accessible from both the console
// (injected as a module) and as a standalone /pricing route.

const TIERS = [
  { name: 'Single User', price: 'R9', period: '/mo', desc: 'Games + Recording Studio + Ubuntu Pools community', features: ['Game access', 'Recording Studio', 'Ubuntu Pools community', '1 digital twin build/day'] },
  { name: 'Single User Pro', price: 'R49', period: '/mo', desc: 'Everything in Single, plus device monitoring', features: ['All Single features', 'Device monitoring (R25/device included)', '5 twin builds/day', 'Share links (24h)'] },
  { name: 'Single User Max', price: 'R99', period: '/mo', desc: 'Everything in Pro, plus health monitoring', features: ['All Pro features', 'Health monitoring (included)', 'Unlimited twin builds', 'Share links (7 days)'] },
  { name: 'Business', price: 'R499', period: '/mo', desc: 'Up to 10 users, all single features', features: ['Up to 10 users', 'All Single Max features', 'Team sharing', 'Priority support'] },
  { name: 'Business Max', price: 'R1,499', period: '/mo', desc: 'Up to 25 users, priority support', features: ['Up to 25 users', 'All Business features', 'Priority support', 'Audit trail'] },
  { name: 'B2B Subscription', price: 'R5,000', period: '/mo', desc: 'B2B pilot, targeted validation packages', features: ['B2B pilot', 'Targeted validation packages', 'All Business Max features', 'Dedicated onboarding'] },
  { name: 'B2B Max', price: 'R7,499', period: '/mo', desc: 'Fraud monitoring, unlimited devices', features: ['All B2B features', 'Fraud monitoring (R9,999 value)', 'Unlimited devices', 'Custom integrations'] },
  { name: 'Organization', price: 'R8,999', period: '/mo', desc: 'Org-wide, governance, audit receipts', features: ['Org-wide deployment', 'Governance module', 'WORM audit receipts', 'SSO + RBAC'] },
  { name: 'Org Max', price: 'R9,499', period: '/mo', desc: 'Custom branding, SLA, dedicated support', features: ['All Org features', 'Custom branding', 'SLA guarantee', 'Dedicated support engineer'] },
  { name: 'Org2Org Core', price: 'R9,999', period: '/mo', desc: 'Max solution, cross-org trust, everything', features: ['Everything in Org Max', 'Cross-org trust chain', 'Unlimited everything', 'On-premise option', 'Source escrow'] },
];

const ADDON_PRICES = [
  { item: 'Monitor a device', price: 'R25' },
  { item: 'Monitor health', price: 'R99' },
  { item: 'B2B pilot (one-time)', price: 'R5,000' },
  { item: 'Fraud monitoring', price: 'R9,999' },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0b09', color: '#f0ead6', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 28px', background: 'rgba(12,11,9,0.8)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(240,234,214,0.08)',
      }}>
        <a href="/" style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
          color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Console
        </a>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18 }}>Pricing</span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b6d7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
          100% of shares owned by founder · CIPC 2026/259053/07
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,64px)', fontWeight: 700, lineHeight: 1, marginBottom: 20, color: '#f0ead6' }}>
          From <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#f59e0b' }}>R9</em> to <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#06b6d4' }}>R9,999</em>
        </h1>
        <p style={{ fontSize: 17, color: '#a8a496', maxWidth: 500, margin: '0 auto', lineHeight: 1.65 }}>
          One subscription ladder. From a single user playing games in Free City to an organization running cross-org trust chains. No hidden fees.
        </p>
      </div>

      {/* Tier grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: '0 24px 40px', maxWidth: 1400, margin: '0 auto' }}>
        {TIERS.map((tier, i) => (
          <div key={tier.name} style={{
            background: i === 9 ? 'linear-gradient(135deg,#1a1d28,#21242f)' : '#1a1d28',
            border: i === 9 ? '1px solid #f59e0b' : '1px solid rgba(240,234,214,0.08)',
            borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden',
          }}>
            {i === 9 && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f59e0b,#06b6d4,#4dd4ac)' }} />
            )}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#6b6d7a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Tier {i + 1}
            </div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, marginBottom: 8, color: '#f0ead6' }}>{tier.name}</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 700, color: i === 9 ? '#f59e0b' : '#f0ead6' }}>{tier.price}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#6b6d7a' }}>{tier.period}</span>
            </div>
            <p style={{ fontSize: 13, color: '#a8a496', marginBottom: 16, lineHeight: 1.5 }}>{tier.desc}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tier.features.map((f, j) => (
                <li key={j} style={{ fontSize: 12, color: '#a8a496', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#4dd4ac', fontSize: 10 }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Add-on prices */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 60px' }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b6d7a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, textAlign: 'center' }}>
          Add-on prices
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ADDON_PRICES.map(a => (
            <div key={a.item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d28', border: '1px solid rgba(240,234,214,0.08)', borderRadius: 8, padding: '12px 16px' }}>
              <span style={{ fontSize: 13, color: '#a8a496' }}>{a.item}</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: '#f59e0b' }}>{a.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
