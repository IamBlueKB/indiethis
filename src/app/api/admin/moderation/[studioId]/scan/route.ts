import { getAdminSession } from "@/lib/admin-auth";
import { runModerationScan } from "@/lib/moderation";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/moderation/[studioId]/scan — manually re-scan
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studioId } = await params;

  await runModerationScan(studioId);

  return NextResponse.json({ ok: true });
}
