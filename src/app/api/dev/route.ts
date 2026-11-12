import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev
// Returns the dev-hub summary: counts of each entity + 5 most recent
// contributions + 3 most recent changelog entries + overall system status
// (derived from incidents).
export async function GET() {
  await seedWorkspaceIfEmpty();

  const [
    contributions,
    changelog,
    incidents,
    contribCount,
    clCount,
    rmCount,
    docCount,
    incCount,
    openIssues,
    openPrs,
    mergedThisMonth,
    totalUpvotes,
  ] = await Promise.all([
    db.contribution.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.changelogEntry.findMany({
      orderBy: { publishedAt: "desc" },
      take: 3,
    }),
    db.incident.findMany({ orderBy: { startedAt: "desc" } }),
    db.contribution.count(),
    db.changelogEntry.count(),
    db.roadmapItem.count(),
    db.docPage.count(),
    db.incident.count(),
    db.contribution.count({ where: { type: "ISSUE", state: "OPEN" } }),
    db.contribution.count({ where: { type: "PR", state: "OPEN" } }),
    db.contribution.count({
      where: {
        state: "MERGED",
        updatedAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    }),
    db.contribution.aggregate({ _sum: { upvotes: true } }),
  ]);

  // Derive overall system status from incidents.
  // Any incident that is NOT RESOLVED is "active".
  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const lastResolved =
    incidents.find((i) => i.resolvedAt)?.resolvedAt ?? null;

  const systemStatus = {
    operational: activeIncidents.length === 0,
    activeCount: activeIncidents.length,
    lastResolvedAt: lastResolved,
    // Most severe active incident, if any.
    worstSeverity: activeIncidents.length
      ? activeIncidents.reduce(
          (acc, i) =>
            severityRank(i.severity) > severityRank(acc) ? i.severity : acc,
          "MINOR" as string,
        )
      : null,
  };

  return NextResponse.json({
    counts: {
      contributions: contribCount,
      changelog: clCount,
      roadmap: rmCount,
      docs: docCount,
      incidents: incCount,
      openIssues,
      openPrs,
      mergedThisMonth,
      totalUpvotes: totalUpvotes._sum.upvotes ?? 0,
    },
    recentContributions: contributions,
    recentChangelog: changelog,
    systemStatus,
  });
}

function severityRank(s: string): number {
  switch (s) {
    case "CRITICAL":
      return 4;
    case "MAJOR":
      return 3;
    case "MAINTENANCE":
      return 2;
    case "MINOR":
    default:
      return 1;
  }
}
