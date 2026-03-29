/**
 * /api/fans/automations — CRUD for FanAutomation rules
 * GET  — return all 5 automation types with current settings (or defaults)
 * POST — upsert an automation (create or update by triggerType)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Default templates ────────────────────────────────────────────────────────

export const DEFAULT_AUTOMATIONS: Record<string, { subject: string; body: string; description: string; label: string }> = {
  FIRST_PURCHASE: {
    label:       "First Purchase",
    description: "Fan buys merch for the first time",
    subject:     "Thank you for your support! 🎶",
    body:        "Hey {{fanName}},\n\nThank you so much for your first purchase! Your support means everything to me and keeps me creating.\n\nI hope you love it — wear it proud.\n\nWith love,\n{{artistName}}",
  },
  FIRST_TIP: {
    label:       "First Tip",
    description: "Fan sends their first tip",
    subject:     "You made my day 💛",
    body:        "Hey {{fanName}},\n\nI just wanted to say — your tip means more than you know. That kind of direct support from fans like you is what keeps the music going.\n\nThank you from the bottom of my heart.\n\n{{artistName}}",
  },
  REPEAT_BUYER: {
    label:       "Repeat Buyer (3rd purchase)",
    description: "Fan makes their 3rd merch purchase",
    subject:     "You're officially a superfan 🏆",
    body:        "Hey {{fanName}},\n\nThis is your third time supporting me — you're officially part of the inner circle.\n\nSeriously, thank you for the continued love and support. You have no idea what it means.\n\nAlways,\n{{artistName}}",
  },
  BIG_TIPPER: {
    label:       "Big Tip ($20+)",
    description: "Fan tips $20 or more in a single tip",
    subject:     "Wow. Thank you. 🙏",
    body:        "Hey {{fanName}},\n\nI'm genuinely blown away by your generosity. That tip just made my whole week.\n\nThank you so much — I'm going to put it directly toward making better music for you.\n\n{{artistName}}",
  },
  ANNIVERSARY: {
    label:       "1-Year Anniversary",
    description: "Fan has been following for 1 year",
    subject:     "One year with you 🎉",
    body:        "Hey {{fanName}},\n\nIt's been a whole year since you joined the journey — and I just wanted to say thank you for sticking around.\n\nEvery play, every purchase, every share counts. You're the reason I keep going.\n\nHere's to more music together.\n\n{{artistName}}",
  },
};

// ─── GET — return current automations merged with defaults ────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [existing, recentLogs] = await Promise.all([
    db.fanAutomation.findMany({ where: { userId: session.user.id } }),
    // Last 20 automation sends logged in AIJob (we use AIJob with type = PRESS_KIT as a workaround;
    // actually we'll use a lightweight notification log — skip for now, return empty array)
    Promise.resolve([]),
  ]);

  const byType = Object.fromEntries(existing.map(a => [a.triggerType, a]));

  const automations = Object.entries(DEFAULT_AUTOMATIONS).map(([type, def]) => ({
    id:          byType[type]?.id ?? null,
    triggerType: type,
    label:       def.label,
    description: def.description,
    isActive:    byType[type]?.isActive ?? true,
    subject:     byType[type]?.subject ?? def.subject,
    body:        byType[type]?.body    ?? def.body,
    createdAt:   byType[type]?.createdAt ?? null,
    updatedAt:   byType[type]?.updatedAt ?? null,
  }));

  return NextResponse.json({ automations, recentLogs });
}

// ─── POST — upsert automation ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    triggerType: string;
    isActive?:   boolean;
    subject?:    string;
    body?:       string;
  };

  if (!body.triggerType || !(body.triggerType in DEFAULT_AUTOMATIONS)) {
    return NextResponse.json({ error: "Invalid trigger type." }, { status: 400 });
  }

  const defaults = DEFAULT_AUTOMATIONS[body.triggerType];

  const automation = await db.fanAutomation.upsert({
    where:  { userId_triggerType: { userId: session.user.id, triggerType: body.triggerType } },
    create: {
      userId:      session.user.id,
      triggerType: body.triggerType,
      isActive:    body.isActive  ?? true,
      subject:     body.subject   ?? defaults.subject,
      body:        body.body      ?? defaults.body,
    },
    update: {
      ...(body.isActive  !== undefined && { isActive: body.isActive }),
      ...(body.subject   !== undefined && { subject:  body.subject }),
      ...(body.body      !== undefined && { body:     body.body }),
    },
  });

  return NextResponse.json({ automation });
}
