'use client';

// Gqeberha (Port Elizabeth) precinct density analysis — the go-to-market
// intelligence surface. Shows volumetric massing, site coverage, stormwater
// runoff, and the industrial footprint comparison that drives the
// automotive corridor sales narrative.

const IMAGES = [
  { src: '/img/pe-analysis/Central_Gqeberha_Precinct_Density_Analysis.png', title: 'Central Gqeberha Precinct — Volumetric Building Massing & Spatial Density Analysis', desc: 'Claymation-style infographic of the central precinct. Shows building heights, density clusters, and the massing analysis across the CBD.' },
  { src: '/img/pe-analysis/pe_central_3d_volumetric_massing.png', title: '3D Volumetric Massing Density — Port Elizabeth Central', desc: '3D bar chart of volumetric density (m³/m²) by street block. Heritage, NMU Campus, Commercial, and Residential buildings color-coded.' },
  { src: '/img/pe-analysis/pe_central_mass_density_ranking.png', title: 'Donkin Lighthouse & Holy Trinity — Lead Volumetric Mass Density', desc: 'Horizontal bar chart ranking 13 buildings by equivalent height (Volume/Footprint). The Donkin Lighthouse leads at 22.0 m³/m².' },
  { src: '/img/pe-analysis/pe_industrial_vs_central_site_coverage.png', title: 'Industrial vs Central Urban Spatial Footprint Profiles', desc: 'Two-panel comparison: industrial zones reach 48% coverage (Struandale leads) vs the central precinct mix. The data behind the go-to-market.' },
  { src: '/img/pe-analysis/pe_industrial_stormwater_runoff_analysis.png', title: 'Gqeberha Industrial Footprints — Runoff Coefficient & Water Impact', desc: 'Dual-panel: building site coverage vs runoff coefficient (C) across Struandale, Deal Party, Markman, Neave/Korsten, Coega SEZ, and Central.' },
  { src: '/img/pe-analysis/industrial-twin-banner.jpg', title: 'VVU Industrial Twin — Gqeberha Line', desc: 'The cinematic banner: a pickup truck in a dim factory hall with neon green laser line. The marketing surface for the PE automotive corridor.' },
];

export default function PEAnalysisPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0c1214', color: '#edf3f5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 28px', background: 'rgba(12,18,20,0.8)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid #38515c',
      }}>
        <a href="/" style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600,
          color: '#63c7d6', textTransform: 'uppercase', letterSpacing: '0.08em',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Console
        </a>
        <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 18 }}>Gqeberha Precinct Analysis</span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#94a8b0', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
          Port Elizabeth · Automotive Capital of South Africa · Go-to-Market Intelligence
        </div>
        <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, lineHeight: 1.05, marginBottom: 20, color: '#edf3f5' }}>
          Volumetric Massing &<br />
          <span style={{ color: '#63c7d6' }}>Spatial Density</span> Analysis
        </h1>
        <p style={{ fontSize: 16, color: '#94a8b0', maxWidth: 600, margin: '0 auto', lineHeight: 1.65 }}>
          The data behind the PE automotive corridor go-to-market. Building footprints, runoff coefficients, and volumetric density across Struandale, Deal Party, Markman, and the Central Precinct — the evidence that proves where the digital twin adds value.
        </p>
      </div>

      {/* Image grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20, padding: '0 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
        {IMAGES.map((img, i) => (
          <div key={i} style={{
            background: '#152024', border: '1px solid #38515c',
            borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
          }}>
            <div style={{ position: 'relative', background: '#0c1214' }}>
              <img src={img.src} alt={img.title} style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
            </div>
            <div style={{ padding: 16 }}>
              <h3 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#edf3f5' }}>{img.title}</h3>
              <p style={{ fontSize: 13, color: '#94a8b0', lineHeight: 1.5 }}>{img.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
