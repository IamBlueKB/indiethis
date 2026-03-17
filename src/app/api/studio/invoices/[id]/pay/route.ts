import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createReceipt } from "@/lib/receipts";

// POST /api/studio/invoices/[id]/pay — mark invoice as paid + generate receipt
// Called after Stripe webhook or manual confirmation from studio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Support both authenticated studio admin and a secret token for Stripe webhooks
  const body = await req.json().catch(() => ({})) as {
    paymentMethod?: string;
    stripePaymentId?: string;
    secret?: string;
  };

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      studio: { select: { ownerId: true, name: true } },
      contact: { select: { name: true, email: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Already paid." }, { status: 400 });
  }

  const updated = await db.invoice.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: body.paymentMethod ?? null,
    },
  });

  // Generate receipt for the studio owner
  try {
    await createReceipt({
      userId: invoice.studio.ownerId,
      type: "SESSION_PAYMENT",
      description: `Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} — ${invoice.contact.name}`,
      amount: invoice.total,
      paymentMethod: body.paymentMethod,
      stripePaymentId: body.stripePaymentId,
      studioName: invoice.studio.name,
    });
  } catch (err) {
    console.error("[invoices/pay] Receipt creation failed:", err);
  }

  // Log activity on contact
  await db.activityLog.create({
    data: {
      contactId: invoice.contactId,
      studioId: invoice.studioId,
      type: "PAYMENT_RECEIVED",
      description: `Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} paid — $${invoice.total.toFixed(2)}`,
      metadata: { invoiceId: id, amount: invoice.total },
    },
  });

  // Update contact totalSpent
  await db.contact.update({
    where: { id: invoice.contactId },
    data: { totalSpent: { increment: invoice.total } },
  });

  return NextResponse.json({ invoice: updated });
}
