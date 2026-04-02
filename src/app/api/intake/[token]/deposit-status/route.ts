import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/intake/[token]/deposit-status?submissionId=xxx
// Public — polled by the intake success page to check if Stripe webhook confirmed deposit
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const submissionId = req.nextUrl.searchParams.get("submissionId");

  if (!submissionId) return NextResponse.json({ depositPaid: false });

  const link = await db.intakeLink.findUnique({
    where: { token },
    select: { id: true },
  });
  if (!link) return NextResponse.json({ depositPaid: false });

  const submission = await db.intakeSubmission.findFirst({
    where: { id: submissionId, intakeLinkId: link.id },
    select: { depositPaid: true },
  });

  return NextResponse.json({ depositPaid: submission?.depositPaid ?? false });
}
