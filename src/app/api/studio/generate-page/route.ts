import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import Anthropic from "@anthropic-ai/sdk";
import {
  PageConfig,
  STYLE_DEFAULTS,
  FontPairing,
  SectionType,
} from "@/types/page-config";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const GENERATION_LIMITS: Record<string, number> = {
  PRO: 3,
  ELITE: 10,
};

const OVERAGE_AMOUNT_CENTS = 100; // $1.00

// ── Prompt helpers ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional studio website designer. Your job is to generate a PageConfig JSON object for a music recording studio's public website.

The PageConfig determines the layout, section variants, content copy, and accent color for the studio's page.

Rules:
- Return ONLY a valid JSON object. No markdown, no explanation, no code fences.
- The JSON must match the PageConfig schema exactly.
- All section "visible" fields should be set based on whether the studio has relevant data.
- Choose variants that match the requested base style (CLASSIC, BOLD, or EDITORIAL).
- Write compelling, professional copy tailored to the studio's actual data.
- accentColor must be a valid hex color (e.g. "#D4A843").
- fontPairing must be one of: "playfair-dm", "inter-serif", "space-grotesk", "dm-sans-only".

PageConfig schema:
{
  "accentColor": string,
  "fontPairing": "playfair-dm" | "inter-serif" | "space-grotesk" | "dm-sans-only",
  "sections": Array<{
    "id": string,
    "type": "hero" | "services" | "gallery" | "testimonials" | "featured_artists" | "about" | "booking_cta" | "contact_form" | "contact_location" | "footer",
    "visible": boolean,
    "variant": string,
    "content": object
  }>
}

Section order must be: hero, services, gallery, testimonials, featured_artists, about, booking_cta, contact_form, contact_location, footer.`;

function buildPrompt(studio: {
  name: string;
  tagline?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  accentColor?: string | null;
  studioHours?: unknown;
  hoursNote?: string | null;
  servicesJson?: string | null;
  testimonials?: string | null;
  featuredArtists?: unknown;
  galleryImages?: unknown;
  heroImage?: string | null;
}, baseStyle: "CLASSIC" | "BOLD" | "EDITORIAL"): string {
  const defaults = STYLE_DEFAULTS[baseStyle];

  const services = studio.servicesJson
    ? (() => { try { return JSON.parse(studio.servicesJson); } catch { return []; } })()
    : [];

  const testimonialList = studio.testimonials
    ? (() => { try { return JSON.parse(studio.testimonials); } catch { return []; } })()
    : [];

  const artists = Array.isArray(studio.featuredArtists) ? studio.featuredArtists : [];
  const gallery = Array.isArray(studio.galleryImages) ? studio.galleryImages : [];

  const address = [studio.streetAddress, studio.city, studio.state, studio.zipCode]
    .filter(Boolean).join(", ");

  const styleGuide: Record<string, { tone: string; font: FontPairing }> = {
    CLASSIC: { tone: "warm, professional, and timeless", font: "playfair-dm" },
    BOLD:    { tone: "energetic, powerful, and modern",   font: "space-grotesk" },
    EDITORIAL: { tone: "sleek, refined, and artistic",   font: "inter-serif" },
  };

  const { tone, font } = styleGuide[baseStyle];

  return `Generate a PageConfig for ${studio.name}, a music recording studio.

BASE STYLE: ${baseStyle}
TONE: ${tone}
FONT PAIRING: ${font}
ACCENT COLOR: ${studio.accentColor ?? "#D4A843"} (keep this unless it clashes badly, then suggest a complementary gold/amber tone)

STUDIO DATA:
- Name: ${studio.name}
- Tagline: ${studio.tagline ?? "(none provided)"}
- Bio: ${studio.bio ?? "(none provided)"}
- Email: ${studio.email ?? "(none)"}
- Phone: ${studio.phone ?? "(none)"}
- Address: ${address || "(none)"}
- Instagram: ${studio.instagram ? "@" + studio.instagram : "(none)"}
- TikTok: ${studio.tiktok ? "@" + studio.tiktok : "(none)"}
- YouTube: ${studio.youtube ?? "(none)"}
- Hero image: ${studio.heroImage ? "YES" : "NO"}
- Gallery images: ${gallery.length} images
- Services: ${services.length > 0 ? JSON.stringify(services, null, 2) : "(none — hide services section)"}
- Testimonials: ${testimonialList.length > 0 ? JSON.stringify(testimonialList, null, 2) : "(none — hide testimonials section)"}
- Featured Artists: ${artists.length > 0 ? JSON.stringify(artists, null, 2) : "(none — hide featured_artists section)"}
- Studio Hours: ${studio.studioHours ? JSON.stringify(studio.studioHours) : "(none)"}
- Hours Note: ${studio.hoursNote ?? "(none)"}

SECTION VARIANTS TO USE (from the ${baseStyle} style):
${(Object.entries(defaults) as [SectionType, string][]).map(([type, variant]) => `- ${type}: "${variant}"`).join("\n")}

INSTRUCTIONS:
1. Set "visible: false" for sections where data is missing (no services → hide services; no testimonials → hide testimonials; no featured artists → hide featured_artists; no address → set contact_location visible false).
2. Write compelling headline and eyebrow copy for each visible section based on the studio's actual bio and tagline.
3. hero.content should include: eyebrow, headline, tagline, ctaPrimary ("Book a Session"), ctaSecondary ("View Our Work"), showScrollIndicator: true
4. booking_cta.content should include a strong call to action with the studio's name.
5. about.content.bio should be a refined version of the studio bio (or the bio itself if it's already good).
6. Return valid JSON only. No explanation.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { baseStyle?: string };
  const baseStyle = (body.baseStyle ?? "BOLD") as "CLASSIC" | "BOLD" | "EDITORIAL";

  if (!["CLASSIC", "BOLD", "EDITORIAL"].includes(baseStyle)) {
    return NextResponse.json({ error: "Invalid base style." }, { status: 400 });
  }

  // Fetch studio + owner
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    include: { owner: { select: { email: true, name: true, stripeCustomerId: true } } },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  }

  const limit = GENERATION_LIMITS[studio.studioTier] ?? 3;
  const now = new Date();

  // Spec: compare month/year of last reset against current month/year
  const lastReset = studio.generationResetDate ? new Date(studio.generationResetDate) : null;
  const needsReset = !lastReset ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear();

  // Reset counter if new billing month
  let currentCount = studio.generationsUsedThisMonth;
  if (needsReset) {
    await db.studio.update({
      where: { id: studio.id },
      data: { generationsUsedThisMonth: 0, generationResetDate: now },
    });
    currentCount = 0;
  }

  let wasPaid = false;

  // Overage charge if at or over limit
  if (currentCount >= limit) {
    const owner = studio.owner;
    let customerId = owner.stripeCustomerId;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: owner.email ?? undefined,
        name: owner.name ?? undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await db.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Attempt charge via saved payment method
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;

    // Try default payment method first, then fall back to first attached card
    let defaultPm: string | null =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : null;

    if (!defaultPm) {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
      defaultPm = pms.data[0]?.id ?? null;
    }

    if (!defaultPm) {
      return NextResponse.json(
        { error: "You've reached your generation limit. Please add a payment method to continue.", code: "NO_PAYMENT_METHOD" },
        { status: 402 }
      );
    }

    try {
      await stripe.paymentIntents.create({
        amount: OVERAGE_AMOUNT_CENTS,
        currency: "usd",
        customer: customerId,
        payment_method: defaultPm,
        confirm: true,
        off_session: true,
        description: "IndieThis — Extra page generation",
        metadata: { studioId: studio.id, type: "page_generation_overage" },
      });
      wasPaid = true;
    } catch {
      return NextResponse.json(
        { error: "Payment failed. Please update your payment method and try again.", code: "PAYMENT_FAILED" },
        { status: 402 }
      );
    }
  }

  // Call Claude API
  let rawText: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(studio, baseStyle) }],
    });

    rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
  } catch (err) {
    console.error("[generate-page] Claude API error:", err);
    return NextResponse.json({ error: "AI generation failed. Please try again." }, { status: 502 });
  }

  // Parse JSON — strip markdown code fences if present
  let pageConfig: PageConfig;
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    pageConfig = JSON.parse(cleaned) as PageConfig;
  } catch {
    console.error("[generate-page] JSON parse error. Raw response:", rawText.slice(0, 500));
    return NextResponse.json({ error: "AI returned invalid configuration. Please try again." }, { status: 502 });
  }

  // Persist config + log + increment counter
  await db.$transaction([
    db.studio.update({
      where: { id: studio.id },
      data: {
        pageConfig: pageConfig as unknown as import("@prisma/client").Prisma.JsonObject,
        template: "CUSTOM",
        generationsUsedThisMonth: { increment: 1 },
      },
    }),
    db.generationLog.create({
      data: {
        studioId: studio.id,
        template: baseStyle,
        configSnapshot: pageConfig as unknown as import("@prisma/client").Prisma.JsonObject,
        wasPaid,
      },
    }),
  ]);

  return NextResponse.json({ pageConfig });
}
