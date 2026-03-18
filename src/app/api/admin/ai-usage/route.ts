/**
 * GET /api/admin/ai-usage
 *
 * Paginated, filtered list of AIJob records for the admin panel.
 *
 * Query params:
 *   type        – AIJobType enum value (VIDEO | COVER_ART | MASTERING | LYRIC_VIDEO | AR_REPORT | PRESS_KIT)
 *   status      – AIJobStatus (QUEUED | PROCESSING | COMPLETE | FAILED)
 *   triggeredBy – AIJobTrigger (ARTIST | STUDIO)
 *   from        – ISO date string (createdAt ≥)
 *   to          – ISO date string (createdAt ≤)
 *   page        – page number (default 1)
 *   limit       – rows per page (default 50, max 100)
 *
 * Returns: { jobs, total, pages, page }
 * Each job is enriched with triggeredByName, triggeredByEmail, durationMs.
 */

import { NextRequest, NextResponse }            from "next/server";
import { getAdminSession }                      from "@/lib/admin-auth";
import { db }                                   from "@/lib/db";
import type { AIJobType, AIJobStatus, AIJobTrigger } from "@prisma/client";

const VALID_TYPES:     AIJobType[]    = ["VIDEO","COVER_ART","MASTERING","LYRIC_VIDEO","AR_REPORT","PRESS_KIT"];
const VALID_STATUSES:  AIJobStatus[]  = ["QUEUED","PROCESSING","COMPLETE","FAILED"];
const VALID_TRIGGERS:  AIJobTrigger[] = ["ARTIST","STUDIO"];

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;

  const rawType   = sp.get("type")        as AIJobType    | null;
  const rawStatus = sp.get("status")      as AIJobStatus  | null;
  const rawTrig   = sp.get("triggeredBy") as AIJobTrigger | null;
  const from      = sp.get("from");
  const to        = sp.get("to");
  const page      = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
  const limit     = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50", 10)));

  const type        = rawType   && VALID_TYPES.includes(rawType)     ? rawType    : null;
  const status      = rawStatus && VALID_STATUSES.includes(rawStatus) ? rawStatus  : null;
  const triggeredBy = rawTrig   && VALID_TRIGGERS.includes(rawTrig)   ? rawTrig    : null;

  // Build Prisma where clause
  const where = {
    ...(type        ? { type }        : {}),
    ...(status      ? { status }      : {}),
    ...(triggeredBy ? { triggeredBy } : {}),
    ...((from || to) ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      },
    } : {}),
  };

  const [jobs, total] = await Promise.all([
    db.aIJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id:            true,
        type:          true,
        status:        true,
        triggeredBy:   true,
        triggeredById: true,
        artistId:      true,
        studioId:      true,
        priceCharged:  true,
        costToUs:      true,
        errorMessage:  true,
        createdAt:     true,
        completedAt:   true,
      },
    }),
    db.aIJob.count({ where }),
  ]);

  // Enrich with user display names
  const userIds = [...new Set(jobs.map(j => j.triggeredById))];
  const users   = userIds.length > 0
    ? await db.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const enriched = jobs.map(j => ({
    ...j,
    createdAt:          j.createdAt.toISOString(),
    completedAt:        j.completedAt?.toISOString() ?? null,
    durationMs:         j.completedAt
      ? j.completedAt.getTime() - j.createdAt.getTime()
      : null,
    triggeredByName:    userMap.get(j.triggeredById)?.name  ?? null,
    triggeredByEmail:   userMap.get(j.triggeredById)?.email ?? null,
  }));

  return NextResponse.json({
    jobs:  enriched,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}
