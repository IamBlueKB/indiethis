/**
 * POST /api/mastering/job/[id]/email-results
 *
 * Silently sends the mastering complete email to the job owner.
 * Fired automatically in the background when the user clicks Download.
 * Only sends once per session (frontend guards with emailSent state).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { sendMasteringCompleteEmail } from "@/lib/email/mastering";

export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session     = await auth();
    const guestEmail  = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body        = await req.json() as { access_token?: string };
    const accessToken = body.access_token ?? null;

    const job = await prisma.masteringJob.findUnique({
      where:  { id },
      select: {
        id:           true,
        status:       true,
        userId:       true,
        guestEmail:   true,
        guestName:    true,
        inputFileUrl: true,
      },
    });

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (job.status !== "COMPLETE") return NextResponse.json({ error: "Job not complete." }, { status: 409 });

    // Auth: session owner, guest email cookie, or valid access token
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    let tokenValid = false;
    if (accessToken) {
      const t = await prisma.masteringAccessToken.findUnique({ where: { token: accessToken } });
      if (t && t.jobId === id && t.expiresAt > new Date()) tokenValid = true;
    }
    if (!isOwner && !isGuest && !tokenValid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Determine recipient and download URL
    const base = process.env.NEXTAUTH_URL ?? "https://indiethis.com";
    let recipientEmail: string | null = null;
    let recipientName  = "Artist";
    let downloadUrl    = `${base}/master`;

    if (job.userId) {
      // Logged-in user
      const user = await prisma.user.findUnique({
        where:  { id: job.userId },
        select: { email: true, name: true },
      });
      recipientEmail = user?.email ?? null;
      recipientName  = user?.name  ?? "Artist";
      downloadUrl    = `${base}/dashboard/ai/master`;
    } else if (job.guestEmail) {
      // Guest — look up their access token for the results link
      recipientEmail = job.guestEmail;
      recipientName  = job.guestName ?? "Artist";
      const token = await prisma.masteringAccessToken.findUnique({
        where:  { jobId: id },
        select: { token: true },
      });
      downloadUrl = token
        ? `${base}/master/results?token=${token.token}`
        : `${base}/master`;
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: "No email address on file." }, { status: 400 });
    }

    const trackTitle = job.inputFileUrl
      ? decodeURIComponent(job.inputFileUrl.split("/").pop()?.split("?")[0] ?? "your track")
          .replace(/\.[^.]+$/, "")
      : "your track";

    await sendMasteringCompleteEmail({
      artistEmail:  recipientEmail,
      artistName:   recipientName,
      trackTitle,
      downloadUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mastering/job/${id}/email-results:`, err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
