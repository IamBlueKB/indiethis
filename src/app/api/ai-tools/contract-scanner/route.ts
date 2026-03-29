/**
 * POST /api/ai-tools/contract-scanner
 * Scans a contract PDF for red flags using Claude.
 * Pay-per-use: $4.99 per scan, 3 free scans/day for subscribers, PPU otherwise.
 * Available to artists and producers (ARTIST role) only — not studios.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { claude, SONNET } from "@/lib/claude";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export const maxDuration = 60;

const DAILY_FREE_LIMIT = 3;
const MAX_PDF_BYTES    = 10 * 1024 * 1024; // 10 MB

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Studio admins cannot use this tool
  if (session.user.role === "STUDIO_ADMIN") {
    return NextResponse.json({ error: "This tool is for artists and producers only." }, { status: 403 });
  }

  const userId = session.user.id;

  const contentType = req.headers.get("content-type") ?? "";

  // ── Path A: PPU payment return ────────────────────────────────────────────
  // Called as JSON with { stripeSessionId, jobId } after Stripe redirect
  if (contentType.includes("application/json")) {
    const body = await req.json() as { stripeSessionId?: string; jobId?: string };

    if (body.stripeSessionId && body.jobId) {
      return handlePostPayment(userId, body.jobId, body.stripeSessionId);
    }
  }

  // ── Parse multipart: pdfFile (required) + optional metadata ──────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const pdfFile = formData.get("pdfFile") as File | null;
  if (!pdfFile) {
    return NextResponse.json({ error: "pdfFile is required." }, { status: 400 });
  }
  if (pdfFile.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF must be under 10 MB." }, { status: 400 });
  }

  const contractType = (formData.get("contractType") as string | null)?.trim() || "music contract";

  // ── Check subscription ────────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { subscription: { select: { status: true, tier: true } }, stripeCustomerId: true },
  });

  const hasActiveSub = user?.subscription?.status === "ACTIVE";

  // ── Daily free scans (subscribers only) ──────────────────────────────────
  if (hasActiveSub) {
    const usedToday = await db.aIJob.count({
      where: {
        triggeredById: userId,
        type:          "CONTRACT_SCANNER",
        status:        { in: ["COMPLETE", "QUEUED", "PROCESSING"] },
        createdAt:     { gte: todayStart() },
      },
    });

    if (usedToday < DAILY_FREE_LIMIT) {
      // Run immediately — free scan included in subscription
      return runScan(userId, pdfFile, contractType, true);
    }
  }

  // ── Require PPU payment ───────────────────────────────────────────────────
  if (!hasActiveSub) {
    return NextResponse.json(
      { error: "Active subscription required to use the Contract Scanner.", requiresUpgrade: true },
      { status: 402 }
    );
  }

  // Subscriber who exceeded daily free limit → redirect to Stripe checkout
  if (!stripe) {
    return NextResponse.json({ error: "Payment not configured." }, { status: 500 });
  }

  // First, temporarily store the PDF as base64 in an AIJob so we can process after payment
  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
  const pdfBase64 = pdfBuffer.toString("base64");

  const job = await db.aIJob.create({
    data: {
      type:          "CONTRACT_SCANNER",
      status:        "QUEUED",
      triggeredBy:   "ARTIST",
      triggeredById: userId,
      artistId:      userId,
      provider:      "anthropic",
      inputData:     { contractType, pdfBase64, fileName: pdfFile.name } as object,
    },
  });

  const pricing  = await getPricing();
  const priceRow = pricing["AI_CONTRACT_SCANNER"] ?? PRICING_DEFAULTS.AI_CONTRACT_SCANNER;
  const amountCents = Math.round(priceRow.value * 100);

  let customerId = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:  customerId,
    mode:      "payment",
    line_items: [{
      price_data: {
        currency:     "usd",
        product_data: { name: "Contract Red Flag Scanner – IndieThis" },
        unit_amount:  amountCents,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/dashboard/ai/contract-scanner?paid=1&session_id={CHECKOUT_SESSION_ID}&jobId=${job.id}`,
    cancel_url:  `${appUrl}/dashboard/ai/contract-scanner`,
    metadata: { userId, jobId: job.id, tool: "CONTRACT_SCANNER" },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url, jobId: job.id });
}

// ── handlePostPayment: verify Stripe then process stored PDF ─────────────────

async function handlePostPayment(userId: string, jobId: string, stripeSessionId: string) {
  if (!stripe) {
    return NextResponse.json({ error: "Payment not configured." }, { status: 500 });
  }

  const job = await db.aIJob.findFirst({ where: { id: jobId, triggeredById: userId } });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (job.status === "COMPLETE") {
    return NextResponse.json({ jobId, result: job.outputData });
  }

  // Verify payment
  try {
    const cs = await stripe.checkout.sessions.retrieve(stripeSessionId);
    if (cs.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not confirmed." }, { status: 402 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify payment." }, { status: 402 });
  }

  const input = job.inputData as { contractType?: string; pdfBase64?: string };
  if (!input.pdfBase64) {
    return NextResponse.json({ error: "PDF data not found for this job." }, { status: 400 });
  }

  const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
  const dummyFile = { arrayBuffer: async () => pdfBuffer, name: "contract.pdf" } as unknown as File;

  return runScan(userId, dummyFile, input.contractType ?? "music contract", false, jobId);
}

// ── runScan: extract PDF text → Claude → parse → store ───────────────────────

async function runScan(
  userId: string,
  pdfFile: File,
  contractType: string,
  isFree: boolean,
  existingJobId?: string
) {
  // ── Extract PDF text ─────────────────────────────────────────────────────
  let contractText: string;
  try {
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const parsed = await pdfParse(buffer);
    contractText = parsed.text?.trim() ?? "";
  } catch (err) {
    return NextResponse.json({ error: "Could not read PDF. Make sure it is not encrypted.", detail: String(err) }, { status: 422 });
  }

  if (contractText.length < 100) {
    return NextResponse.json({ error: "PDF appears to be empty or image-only (no readable text)." }, { status: 422 });
  }

  // Truncate to ~80k chars to stay within context window
  const truncated = contractText.length > 80_000
    ? contractText.slice(0, 80_000) + "\n\n[Contract truncated — first 80,000 characters analyzed]"
    : contractText;

  // ── Create or update job record ───────────────────────────────────────────
  let job: { id: string };
  if (existingJobId) {
    job = await db.aIJob.update({
      where: { id: existingJobId },
      data:  { status: "PROCESSING" },
    });
  } else {
    job = await db.aIJob.create({
      data: {
        type:          "CONTRACT_SCANNER",
        status:        "PROCESSING",
        triggeredBy:   "ARTIST",
        triggeredById: userId,
        artistId:      userId,
        provider:      "anthropic",
        priceCharged:  isFree ? 0 : undefined,
        inputData:     { contractType, fileName: pdfFile.name } as object,
      },
    });
  }

  // ── Call Claude ──────────────────────────────────────────────────────────
  const prompt = `You are an expert music industry attorney reviewing a ${contractType} on behalf of an independent artist or producer. Analyze the following contract and identify red flags, unfavorable terms, and areas requiring attention.

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

JSON shape:
{
  "summary": "2–3 sentence overview of what this contract is and its overall risk level",
  "riskLevel": "low" | "medium" | "high" | "critical",
  "redFlags": [
    {
      "title": "Short flag title (5–8 words)",
      "severity": "low" | "medium" | "high" | "critical",
      "clause": "Exact or paraphrased clause text (max 200 chars)",
      "explanation": "Plain-English explanation of why this is problematic",
      "recommendation": "What the artist should ask for instead or how to negotiate this"
    }
  ],
  "positives": ["Any genuinely favorable terms worth noting (keep it brief, 1–2 sentences each)"],
  "negotiationTips": ["3–5 overall negotiation tips specific to this contract type"],
  "disclaimer": "This analysis is for informational purposes only and does not constitute legal advice. Consult a qualified music attorney before signing."
}

If no red flags are found, return an empty array for redFlags.
Sort redFlags by severity: critical first, then high, medium, low.

CONTRACT TEXT:
---
${truncated}
---`;

  try {
    const message = await claude.messages.create({
      model:      SONNET,
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    });

    const rawText = message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    let result: {
      summary: string;
      riskLevel: string;
      redFlags: { title: string; severity: string; clause: string; explanation: string; recommendation: string }[];
      positives: string[];
      negotiationTips: string[];
      disclaimer: string;
    };

    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      throw new Error("Claude returned non-JSON: " + rawText.slice(0, 200));
    }

    const inputTokens  = message.usage?.input_tokens  ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const costToUs     = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    await db.aIJob.update({
      where: { id: job.id },
      data:  {
        status:      "COMPLETE",
        outputData:  result as object,
        costToUs,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ jobId: job.id, result, isFree });

  } catch (err) {
    await db.aIJob.update({
      where: { id: job.id },
      data:  { status: "FAILED", errorMessage: String(err) },
    });
    return NextResponse.json(
      { error: "Contract analysis failed. Please try again.", detail: String(err) },
      { status: 500 }
    );
  }
}

// ── GET: fetch job result + usage stats ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const jobId  = new URL(req.url).searchParams.get("jobId");

  const [usedToday, job] = await Promise.all([
    db.aIJob.count({
      where: {
        triggeredById: userId,
        type:          "CONTRACT_SCANNER",
        status:        { in: ["COMPLETE", "QUEUED", "PROCESSING"] },
        createdAt:     { gte: todayStart() },
      },
    }),
    jobId
      ? db.aIJob.findFirst({ where: { id: jobId, triggeredById: userId }, select: { id: true, status: true, outputData: true } })
      : null,
  ]);

  const hasActiveSub = (await db.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
  })) !== null;

  return NextResponse.json({
    usedToday,
    dailyFreeLimit: DAILY_FREE_LIMIT,
    remainingFree:  Math.max(0, DAILY_FREE_LIMIT - usedToday),
    hasActiveSub,
    ...(job ? { job } : {}),
  });
}
