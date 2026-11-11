// VVU client-side format helpers — pure functions, safe for the browser.

export function shortHash(h: string, head = 10, tail = 6): string {
  if (!h) return "";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

const SURFACE_META: Record<
  string,
  { label: string; blurb: string; image: string }
> = {
  rig: {
    label: "RIG · photoreal manufacturing",
    blurb: "Three.js + IBL, 6-axis arms, hash-chained ticker.",
    image: "/twin/rig-viewer.png",
  },
  map: {
    label: "MAP 3D · spatial truth",
    blurb: "MapLibre 3D, node array, FSM console.",
    image: "/twin/estate-map.png",
  },
  assembly: {
    label: "ASSEMBLY · 8-station line",
    blurb: "Takt 14s, KPIs, fault mode, 5 camera views.",
    image: "/twin/hero-estate.png",
  },
  admin: {
    label: "ADMIN · command center",
    blurb: "Disruption switches, WORM ledger, E-STOP.",
    image: "/twin/estate-map.png",
  },
  viewer: {
    label: "VIEWER · WebXR GLB",
    blurb: "Drop-to-load GLB, VR grab + scale.",
    image: "/twin/rig-viewer.png",
  },
};

export function surfaceMeta(surface: string) {
  return SURFACE_META[surface] ?? SURFACE_META.rig;
}

export const SURFACES = Object.keys(SURFACE_META);
