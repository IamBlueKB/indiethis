/**
 * GET /api/studio/ai-tools/roster
 *
 * Returns the studio's CRM contacts (up to 100) with an `indieThisUserId`
 * field if the contact's email matches an active IndieThis ARTIST account.
 *
 * The frontend uses this to:
 *  - Populate the "Select Client" dropdown on the AI Tools page.
 *  - If indieThisUserId is set, the AI job's `artistId` is passed so the
 *    output appears in that artist's dashboard automatically.
 */

import { NextResponse }  from "next/server";
import { auth }          from "@/lib/auth";
import { db }            from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Load studio ────────────────────────────────────────────────────────────
  const studio = await db.studio.findFirst({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  // ── Load contacts ──────────────────────────────────────────────────────────
  const contacts = await db.contact.findMany({
    where:   { studioId: studio.id },
    select:  { id: true, name: true, email: true, photoUrl: true, genre: true },
    orderBy: { name: "asc" },
    take:    100,
  });

  if (contacts.length === 0) {
    return NextResponse.json({ roster: [] });
  }

  // ── Find which contacts have IndieThis ARTIST accounts (by email) ──────────
  const emails = contacts
    .map(c => c.email)
    .filter((e): e is string => !!e);

  const linkedUsers = emails.length > 0
    ? await db.user.findMany({
        where:  { email: { in: emails }, role: "ARTIST" },
        select: { id: true, email: true, name: true },
      })
    : [];

  const emailToUser = new Map(linkedUsers.map(u => [u.email, u]));

  // ── Build response ─────────────────────────────────────────────────────────
  const roster = contacts.map(c => {
    const linked = c.email ? emailToUser.get(c.email) : undefined;
    return {
      id:              c.id,
      name:            c.name,
      email:           c.email,
      photoUrl:        c.photoUrl,
      genre:           c.genre,
      indieThisUserId: linked?.id  ?? null,
      indieThisName:   linked?.name ?? null,
      isLinked:        !!linked,
    };
  });

  return NextResponse.json({ roster });
}
