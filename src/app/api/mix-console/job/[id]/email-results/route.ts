/**
 * POST /api/mix-console/job/[id]/email-results
 *
 * Resends the mix-complete email with the download link.
 * Called from WizardClient on first download.
 * Auth: session, guest email cookie, or MixAccessToken in body.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { sendMixCompleteEmail } from "@/lib/brevo/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body       = await req.json().catch(() => ({})) as { access_token?: string };

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:         true,
        status:     true,
        userId:     true,
        guestEmail: true,
        guestName:  true,
        inputFiles: true,
      },
    });

    if (!job)                        return NextResponse.json({ error: "Job not found." },     { status: 404 });
    if (job.status !== "COMPLETE")   return NextResponse.json({ error: "Job not complete." },  { status: 409 });

    // ── Auth check ────────────────────────────────────────────────────────────
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;

    let tokenAuthed = false;
    if (!isOwner && !isGuest && body.access_token) {
      const t = await prisma.mixAccessToken.findUnique({ where: { token: body.access_token } });
      if (t?.jobId === id && t.expiresAt > new Date()) tokenAuthed = true;
    }

    if (!isOwner && !isGuest && !tokenAuthed) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // ── Resolve recipient + download URL ──────────────────────────────────────
    let artistEmail: string;
    let artistName:  string;
    let downloadUrl: string;

    if (isOwner && session?.user?.id) {
      const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { email: true, name: true },
      });
      artistEmail = user?.email ?? "";
      artistName  = user?.name  ?? "Artist";
      downloadUrl = `${APP_URL}/dashboard/ai/mix-console`;
    } else {
      // Guest or token auth
      artistEmail = job.guestEmail ?? "";
      artistName  = job.guestName  ?? "Artist";

      const accessToken = await prisma.mixAccessToken.findUnique({
        where: { jobId: id },
      });
      downloadUrl = accessToken
        ? `${APP_URL}/mix-console/results?token=${accessToken.token}`
        : `${APP_URL}/mix-console`;
    }

    if (!artistEmail) return NextResponse.json({ ok: true }); // no email on file, silently succeed

    // ── Track title from first input file label ───────────────────────────────
    const inputFiles = (job.inputFiles ?? []) as { label: string; url: string }[];
    const trackTitle = inputFiles[0]?.label ?? "Your Mix";

    await sendMixCompleteEmail({ artistEmail, artistName, trackTitle, downloadUrl });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mix-console/job/${id}/email-results:`, err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
