/**
 * GET /api/dashboard/fans
 *
 * Returns a unified fan database merged from four sources:
 *   1. FanContact       — email / SMS subscribers (RELEASE_NOTIFY | SHOW_NOTIFY)
 *   2. ArtistBookingInquiry — booking / press / feature inquiries from public page
 *   3. ArtistSupport    — pay-what-you-want tip supporters
 *   4. MerchOrder       — merch buyers
 *
 * Each record is deduplicated by e-mail address and enriched with:
 *   - name (from booking inquiry if captured)
 *   - phone / zip (from FanContact)
 *   - spend totals from FanScore
 *   - all source tags the fan appears under
 *   - firstSeen / lastActivity timestamps
 *
 * Response shape:
 *   { fans: FanRecord[], stats: Stats }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type FanSource =
  | "EMAIL_SIGNUP"
  | "SHOW_NOTIFY"
  | "BOOKING_INQUIRY"
  | "SUPPORTER"
  | "MERCH_BUYER";

export type FanRecord = {
  email:        string;
  name:         string | null;
  phone:        string | null;
  zip:          string | null;
  sources:      FanSource[];
  totalSpend:   number;
  merchSpend:   number;
  tipSpend:     number;
  orderCount:   number;
  tipCount:     number;
  firstSeen:    string;   // ISO
  lastActivity: string;   // ISO
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    // ── Fetch all four sources in parallel ──────────────────────────────────
    const [fanContacts, bookingInquiries, supporters, merchOrders, fanScores] =
      await Promise.all([
        db.fanContact.findMany({
          where:  { artistId },
          select: { email: true, phone: true, zip: true, source: true, createdAt: true },
        }),
        db.artistBookingInquiry.findMany({
          where:  { artistId },
          select: { email: true, name: true, inquiryType: true, createdAt: true },
        }),
        db.artistSupport.findMany({
          where:  { artistId },
          select: { supporterEmail: true, amount: true, createdAt: true },
        }),
        db.merchOrder.findMany({
          where:  { artistId },
          select: { buyerEmail: true, artistEarnings: true, createdAt: true },
          take:   2000,
        }),
        db.fanScore.findMany({
          where:  { artistId },
          select: {
            email:      true,
            totalSpend: true,
            merchSpend: true,
            tipSpend:   true,
            orderCount: true,
            tipCount:   true,
          },
        }),
      ]);

    // ── Build spend lookup ──────────────────────────────────────────────────
    const spendMap = new Map(fanScores.map((s) => [s.email.toLowerCase(), s]));

    // ── Unified fan map (keyed by lowercase email) ─────────────────────────
    type Merged = {
      email:        string;
      name:         string | null;
      phone:        string | null;
      zip:          string | null;
      sources:      Set<FanSource>;
      firstSeen:    Date;
      lastActivity: Date;
    };

    const fanMap = new Map<string, Merged>();

    function touch(email: string, ts: Date): Merged {
      const key = email.toLowerCase().trim();
      const existing = fanMap.get(key);
      if (existing) {
        if (ts < existing.firstSeen)    existing.firstSeen    = ts;
        if (ts > existing.lastActivity) existing.lastActivity = ts;
        return existing;
      }
      const fresh: Merged = {
        email:        key,
        name:         null,
        phone:        null,
        zip:          null,
        sources:      new Set(),
        firstSeen:    ts,
        lastActivity: ts,
      };
      fanMap.set(key, fresh);
      return fresh;
    }

    // 1. Fan contacts
    for (const c of fanContacts) {
      const fan    = touch(c.email, c.createdAt);
      const source: FanSource = c.source === "SHOW_NOTIFY" ? "SHOW_NOTIFY" : "EMAIL_SIGNUP";
      fan.sources.add(source);
      if (c.phone && !fan.phone) fan.phone = c.phone;
      if (c.zip   && !fan.zip)   fan.zip   = c.zip;
    }

    // 2. Booking inquiries
    for (const b of bookingInquiries) {
      const fan = touch(b.email, b.createdAt);
      fan.sources.add("BOOKING_INQUIRY");
      if (b.name && !fan.name) fan.name = b.name;
    }

    // 3. PWYW supporters
    for (const s of supporters) {
      touch(s.supporterEmail, s.createdAt).sources.add("SUPPORTER");
    }

    // 4. Merch buyers
    for (const o of merchOrders) {
      touch(o.buyerEmail, o.createdAt).sources.add("MERCH_BUYER");
    }

    // ── Assemble output records ─────────────────────────────────────────────
    const fans: FanRecord[] = Array.from(fanMap.values()).map((f) => {
      const spend = spendMap.get(f.email);
      return {
        email:        f.email,
        name:         f.name,
        phone:        f.phone,
        zip:          f.zip,
        sources:      Array.from(f.sources),
        totalSpend:   spend?.totalSpend  ?? 0,
        merchSpend:   spend?.merchSpend  ?? 0,
        tipSpend:     spend?.tipSpend    ?? 0,
        orderCount:   spend?.orderCount  ?? 0,
        tipCount:     spend?.tipCount    ?? 0,
        firstSeen:    f.firstSeen.toISOString(),
        lastActivity: f.lastActivity.toISOString(),
      };
    });

    // Sort by firstSeen desc by default (client can re-sort)
    fans.sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());

    // ── Stats ───────────────────────────────────────────────────────────────
    const emailSignupEmails   = new Set(fanContacts.map((c) => c.email.toLowerCase()));
    const showNotifyEmails    = new Set(fanContacts.filter(c => c.source === "SHOW_NOTIFY").map(c => c.email.toLowerCase()));
    const bookingEmails       = new Set(bookingInquiries.map((b) => b.email.toLowerCase()));
    const supporterEmails     = new Set(supporters.map((s) => s.supporterEmail.toLowerCase()));
    const merchBuyerEmails    = new Set(merchOrders.map((o) => o.buyerEmail.toLowerCase()));
    const totalRevenue        = fanScores.reduce((s, f) => s + f.totalSpend, 0);

    return NextResponse.json({
      fans,
      stats: {
        total:            fanMap.size,
        emailSignups:     emailSignupEmails.size,
        showNotify:       showNotifyEmails.size,
        bookingInquiries: bookingEmails.size,
        supporters:       supporterEmails.size,
        merchBuyers:      merchBuyerEmails.size,
        totalRevenue,
      },
    });
  } catch (err) {
    console.error("[fans GET]", err);
    return NextResponse.json({ error: "Failed to load fans" }, { status: 500 });
  }
}
