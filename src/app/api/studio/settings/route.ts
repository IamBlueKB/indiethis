import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerModerationScan } from "@/lib/moderation";

// GET /api/studio/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  return NextResponse.json({ studio });
}

// PATCH /api/studio/settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();

  // Validate slug uniqueness if being changed
  if (body.slug?.trim()) {
    const conflict = await db.studio.findFirst({
      where: { slug: body.slug.trim(), id: { not: studio.id } },
    });
    if (conflict) {
      return NextResponse.json({ error: "That URL is already taken." }, { status: 409 });
    }
  }

  const updated = await db.studio.update({
    where: { id: studio.id },
    data: {
      name:                 body.name?.trim()          || undefined,
      slug:                 body.slug?.trim()          || undefined,
      address:              body.address?.trim()       ?? undefined,
      phone:                body.phone?.trim()         ?? undefined,
      email:                body.email?.trim()         ?? undefined,
      description:          body.description?.trim()   ?? undefined,
      hours:                body.hours                 ?? undefined,
      streetAddress:        body.streetAddress?.trim() ?? undefined,
      city:                 body.city?.trim()          ?? undefined,
      state:                body.state?.trim()         ?? undefined,
      zipCode:              body.zipCode?.trim()       ?? undefined,
      instagram:            body.instagram?.trim()     ?? undefined,
      tiktok:               body.tiktok?.trim()        ?? undefined,
      youtube:              body.youtube?.trim()       ?? undefined,
      facebook:             body.facebook?.trim()      ?? undefined,
      cashAppHandle:        body.cashAppHandle?.trim() ?? undefined,
      zelleHandle:          body.zelleHandle?.trim()   ?? undefined,
      paypalHandle:         body.paypalHandle?.trim()  ?? undefined,
      venmoHandle:          body.venmoHandle?.trim()   ?? undefined,
      stripePaymentsEnabled: typeof body.stripePaymentsEnabled === "boolean"
        ? body.stripePaymentsEnabled : undefined,
      // Public page fields
      template:       body.template         ?? undefined,
      accentColor:    body.accentColor?.trim() ?? undefined,
      isPublished:    typeof body.isPublished === "boolean" ? body.isPublished : undefined,
      bio:            body.bio?.trim()          ?? undefined,
      tagline:        body.tagline?.trim()       ?? undefined,
      logoUrl:        body.logoUrl              ?? undefined,
      heroImage:      body.heroImage            ?? undefined,
      galleryImages:  body.galleryImages        ?? undefined,
      studioHours:    body.studioHours          ?? undefined,
      hoursNote:      body.hoursNote?.trim()    ?? undefined,
      servicesJson:   body.servicesJson         ?? undefined,
      testimonials:   body.testimonials         ?? undefined,
      featuredArtists: body.featuredArtists     ?? undefined,
      twitter:        body.twitter?.trim()      ?? undefined,
      pageConfig:          body.pageConfig               ?? undefined,
      onboardingCompleted: typeof body.onboardingCompleted === "boolean"
        ? body.onboardingCompleted : undefined,
      emailSequenceEnabled: typeof body.emailSequenceEnabled === "boolean"
        ? body.emailSequenceEnabled : undefined,
    },
  });

  // Auto-scan on publish
  if (typeof body.isPublished === "boolean" && body.isPublished) {
    triggerModerationScan(studio.id);
  }

  return NextResponse.json({ studio: updated });
}
