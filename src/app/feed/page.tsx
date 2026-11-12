'use client';

// The community feed — a public gallery for published songs, camera feeds,
// and shared projects. Users can publish their creations and browse what
// others have shared.

import { useEffect, useState } from 'react';

interface FeedItem {
  id: string;
  type: 'song' | 'camera' | 'project' | 'twin';
  title: string;
  author: string;
  description: string;
  thumbnail?: string;
  publishedAt: string;
  views: number;
  tier: string;
}

// Demo feed items — in production these would come from the API
const DEMO_FEED: FeedItem[] = [
  { id: '1', type: 'song', title: 'Struandale Nights', author: 'Mihle', description: 'Ambient track recorded in the Fluid Studio', publishedAt: '2026-11-12', views: 42, tier: 'Pro' },
  { id: '2', type: 'camera', title: 'Gqeberha Harbour Cam', author: 'Isuzu Ops', description: 'Live feed from the Struandale line — shift change', publishedAt: '2026-11-12', views: 128, tier: 'B2B' },
  { id: '3', type: 'twin', title: 'Water Network Twin — NMBM', author: 'VVU Foundation', description: 'The Nelson Mandela Bay water infrastructure digital twin', publishedAt: '2026-11-11', views: 340, tier: 'Org' },
  { id: '4', type: 'project', title: 'BMW Rosslyn Assembly Line', author: 'BMW Group', description: '8-station assembly line validation package', publishedAt: '2026-11-10', views: 89, tier: 'B2B' },
  { id: '5', type: 'song', title: 'Ubuntu Pools Theme', author: 'Divhani', description: 'Community pool ambient — shared under MIT', publishedAt: '2026-11-10', views: 67, tier: 'Free' },
  { id: '6', type: 'camera', title: 'Cape Town Wildfire — Ward 62', author: 'VVU Foundation', description: 'Winter pools wildfire emergency monitoring', publishedAt: '2026-11-09', views: 512, tier: 'Org' },
];

const TYPE_LABELS: Record<string, string> = {
  song: 'SONG',
  camera: 'CAMERA FEED',
  project: 'PROJECT',
  twin: 'DIGITAL TWIN',
};

const TYPE_COLORS: Record<string, string> = {
  song: '#a78bfa',
  camera: '#4dd4ac',
  project: '#f59e0b',
  twin: '#06b6d4',
};

export default function FeedPage() {
  const [filter, setFilter] = useState<string>('all');
  const [items, setItems] = useState<FeedItem[]>(DEMO_FEED);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div style={{ minHeight: '100vh', background: '#0c0b09', color: '#f0ead6', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 28px', background: 'rgba(12,11,9,0.8)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(240,234,214,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
            color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Console
          </a>
          <span style={{ color: '#6b6d7a' }}>·</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18 }}>
            Community Feed
          </span>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'song', 'camera', 'project', 'twin'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${filter === f ? '#f59e0b' : 'rgba(240,234,214,0.08)'}`,
                background: filter === f ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: filter === f ? '#f59e0b' : '#6b6d7a',
                fontWeight: filter === f ? 700 : 400,
              }}
            >
              {f === 'all' ? 'All' : TYPE_LABELS[f] || f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16, padding: 24, maxWidth: 1400, margin: '0 auto',
      }}>
        {filtered.map(item => (
          <div key={item.id} style={{
            background: '#1a1d28', border: '1px solid rgba(240,234,214,0.08)',
            borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
          }}>
            {/* Thumbnail area */}
            <div style={{
              height: 180, background: '#0c0b09', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: TYPE_COLORS[item.type], textTransform: 'uppercase',
                letterSpacing: '0.15em', fontWeight: 700,
              }}>
                {TYPE_LABELS[item.type]}
              </div>
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.7)', padding: '3px 8px',
                borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: '#f59e0b', textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {item.tier}
              </div>
            </div>
            {/* Content */}
            <div style={{ padding: 16 }}>
              <h3 style={{
                fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600,
                marginBottom: 4, color: '#f0ead6',
              }}>{item.title}</h3>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                color: '#6b6d7a', marginBottom: 8,
              }}>
                by {item.author} · {item.publishedAt} · {item.views} views
              </div>
              <p style={{
                fontSize: 13, color: '#a8a496', lineHeight: 1.5,
              }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Publish CTA */}
      <div style={{ textAlign: 'center', padding: '40px 20px 80px' }}>
        <a href="/#/studio" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: '#f59e0b', color: '#0c0b09', fontWeight: 600,
          padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 15,
        }}>
          Publish your work
        </a>
      </div>
    </div>
  );
}
