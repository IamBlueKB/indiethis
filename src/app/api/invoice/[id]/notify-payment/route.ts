import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

// POST /api/invoice/[id]/notify-payment
// Artist claims they sent payment via Zelle/CashApp/PayPal — notifies studio WITHOUT marking paid
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { method?: string };

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      studio: { select: { ownerId: true, name: true } },
      contact: { select: { name: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "PAID") return NextResponse.json({ error: "Already paid." }, { status: 400 });

  const method = body.method ?? "manual";
  const invoiceNum = `#${String(invoice.invoiceNumber).padStart(4, "0")}`;
  const claimedAt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Stamp a claim marker on the invoice notes so the studio dashboard can surface it
  const claimTag = `[PAYMENT_CLAIMED:${method}:${claimedAt}]`;
  const existingNotes = invoice.notes ?? "";
  const updatedNotes = existingNotes.startsWith("[PAYMENT_CLAIMED:")
    ? existingNotes.replace(/^\[PAYMENT_CLAIMED:[^\]]*\]\s*/, claimTag + " ")
    : claimTag + (existingNotes ? " " + existingNotes : "");

  await db.invoice.update({
    where: { id },
    data: { notes: updatedNotes },
  });

  await createNotification({
    userId: invoice.studio.ownerId,
    type: "PAYMENT_RECEIVED",
    title: `Payment claimed — Invoice ${invoiceNum}`,
    message: `${invoice.contact.name} says they sent $${invoice.total.toFixed(2)} via ${method}. Verify in your ${method} app and mark as paid.`,
    link: `/studio/invoices`,
  });

  return NextResponse.json({ ok: true });
}
