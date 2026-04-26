/**
 * GET /api/admin/reference-library/intelligence
 * Mix Intelligence dashboard — outcome aggregates + revision keyword stats
 * + reference-library impact (holdout vs informed).
 * PLATFORM_ADMIN only.
 */

import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";

export async function GET() {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [feedback, totals] = await Promise.all([
    prisma.mixOutcomeFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take:    1000,
    }),
    prisma.mixOutcomeFeedback.count(),
  ]);

  const qualifying = feedback.filter(f => f.qualifiesForLearning).length;
  const revised    = feedback.filter(f => f.outcome === "revised").length;
  const downloaded = feedback.filter(f => f.outcome === "downloaded").length;
  const abandoned  = feedback.filter(f => f.outcome === "abandoned").length;

  // Per-genre breakdown
  const perGenre = new Map<string, {
    genre: string; total: number; qualify: number; revised: number;
    downloaded: number; topComplaint: string | null; deviation: number | null;
  }>();

  const keywordCounts = new Map<string, Map<string, number>>(); // genre -> keyword -> count

  for (const f of feedback) {
    const g = f.genre;
    if (!perGenre.has(g)) perGenre.set(g, {
      genre: g, total: 0, qualify: 0, revised: 0, downloaded: 0,
      topComplaint: null, deviation: null,
    });
    const row = perGenre.get(g)!;
    row.total++;
    if (f.qualifiesForLearning) row.qualify++;
    if (f.outcome === "revised")    row.revised++;
    if (f.outcome === "downloaded") row.downloaded++;
    for (const kw of f.revisionKeywords ?? []) {
      if (!keywordCounts.has(g)) keywordCounts.set(g, new Map());
      const m = keywordCounts.get(g)!;
      m.set(kw, (m.get(kw) ?? 0) + 1);
    }
  }

  for (const [g, kws] of keywordCounts) {
    const top = [...kws.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) perGenre.get(g)!.topComplaint = top[0];
  }

  // Holdout vs informed comparison
  const holdout       = feedback.filter(f => f.isHoldout);
  const informed      = feedback.filter(f => !f.isHoldout);
  const revRate       = (xs: typeof feedback) => xs.length === 0 ? null : xs.filter(f => f.outcome === "revised").length / xs.length;
  const avgTime       = (xs: typeof feedback) => {
    const ts = xs.map(f => f.timeToDownload).filter((t): t is number => typeof t === "number");
    return ts.length === 0 ? null : ts.reduce((a, b) => a + b, 0) / ts.length;
  };

  return NextResponse.json({
    totals: {
      total:       totals,
      qualifying,  revised,  downloaded,  abandoned,
      qualifyRate: totals === 0 ? 0 : qualifying / totals,
      revisionRate: totals === 0 ? 0 : revised / totals,
    },
    perGenre: [...perGenre.values()].sort((a, b) => b.total - a.total),
    holdoutImpact: {
      holdoutRevisionRate: revRate(holdout),
      informedRevisionRate: revRate(informed),
      holdoutAvgTimeToDownload: avgTime(holdout),
      informedAvgTimeToDownload: avgTime(informed),
      holdoutN:  holdout.length,
      informedN: informed.length,
    },
  });
}
