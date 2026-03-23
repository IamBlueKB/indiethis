/**
 * POST /api/admin/content/[type]/[id]/request-docs
 *
 * Sends a "Request Documentation" email to the content owner via Brevo.
 * [type] must be one of: beat | track | streamLease
 *
 * Auth: any admin session.
 */

import { NextRequest, NextResponse }          from "next/server";
import { getAdminSession }                    from "@/lib/admin-auth";
import { db }                                 from "@/lib/db";
import { sendDocumentationRequestEmail }      from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

type Params = { params: Promise<{ type: string; id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await params;

  // ── Resolve owner + title by content type ─────────────────────────────────

  type ContentOwner = {
    email:        string;
    name:         string;
    contentTitle: string;
    contentType:  "beat" | "track" | "stream lease";
    vaultFilter:  string;
  };

  let owner: ContentOwner | null = null;

  if (type === "beat" || type === "track") {
    const track = await db.track.findUnique({
      where:   { id },
      include: { artist: { select: { name: true, email: true } } },
    });
    if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

    owner = {
      email:        track.artist.email ?? "",
      name:         track.artist.name ?? "Artist",
      contentTitle: track.title,
      contentType:  type === "beat" ? "beat" : "track",
      vaultFilter:  type === "beat" ? "beats" : "tracks",
    };
  } else if (type === "streamLease") {
    const lease = await db.streamLease.findUnique({
      where:   { id },
      include: { artist: { select: { name: true, email: true } } },
    });
    if (!lease) return NextResponse.json({ error: "Not found" }, { status: 404 });

    owner = {
      email:        lease.artist.email ?? "",
      name:         lease.artist.name ?? "Artist",
      contentTitle: lease.trackTitle,
      contentType:  "stream lease",
      vaultFilter:  "leases",
    };
  } else {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  if (!owner.email) {
    return NextResponse.json({ error: "User has no email address" }, { status: 422 });
  }

  // Build vault URL pre-filtered to the relevant content type
  const vaultUrl = `${APP_URL()}/dashboard/vault?filter=${owner.vaultFilter}&ref=${type}:${id}`;

  await sendDocumentationRequestEmail({
    userEmail:    owner.email,
    userName:     owner.name,
    contentTitle: owner.contentTitle,
    contentType:  owner.contentType,
    vaultUrl,
  });

  return NextResponse.json({ success: true, sentTo: owner.email });
}
