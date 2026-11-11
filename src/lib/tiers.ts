// VVU tier model — the one-page spec, encoded.
// Free first build (once, MIT export) → daily builds (24h, 3 viewers) →
// commercial (payment gate, configurable).

export type Tier = "FREE_BUILD" | "FREE_DAILY" | "COMMERCIAL";

export type TierConfig = {
  id: Tier;
  label: string;
  // raw twin storage TTL
  storageTtlMs: number;
  // signed share lifetime
  shareTtlMs: number;
  viewerLimit: number; // 0 = unlimited
  maxSimultaneousShares: number; // 0 = unlimited
  export: "MIT_ONCE" | "NONE" | "UNRESTRICTED";
  watermark: boolean;
  commercial: boolean;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const TIERS: Record<Tier, TierConfig> = {
  FREE_BUILD: {
    id: "FREE_BUILD",
    label: "Free — first build",
    storageTtlMs: DAY,
    shareTtlMs: 7 * DAY,
    viewerLimit: 25,
    maxSimultaneousShares: 1,
    export: "MIT_ONCE",
    watermark: false,
    commercial: false,
  },
  FREE_DAILY: {
    id: "FREE_DAILY",
    label: "Free — daily",
    storageTtlMs: DAY,
    shareTtlMs: DAY,
    viewerLimit: 3,
    maxSimultaneousShares: 1,
    export: "NONE",
    watermark: true,
    commercial: false,
  },
  COMMERCIAL: {
    id: "COMMERCIAL",
    label: "Commercial licence",
    storageTtlMs: 30 * DAY,
    shareTtlMs: 30 * DAY,
    viewerLimit: 0,
    maxSimultaneousShares: 0,
    export: "UNRESTRICTED",
    watermark: false,
    commercial: true,
  },
};

export function tierForUser(opts: {
  freeBuildUsed: boolean;
  tier: Tier;
}): Tier {
  if (opts.tier === "COMMERCIAL") return "COMMERCIAL";
  return opts.freeBuildUsed ? "FREE_DAILY" : "FREE_BUILD";
}

/** The daily-build rate limit window for free users. */
export const FREE_DAILY_WINDOW_MS = DAY;
