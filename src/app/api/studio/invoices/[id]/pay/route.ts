import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReceipt } from "@/lib/receipts";

// POST /api/studio/invoices/[id]/pay — mark invoice as paid + generate receipt
// Auth: STUDIO_ADMIN whose studio owns the invoice. Phase 1.2 IDOR fix —
// previously this endpoint accepted an unauthenticated POST that could mark
// any invoice paid given only its ID. A `secret` body field was parsed but
// never compared, so the documented "Stripe webhook" path was a no-op.
// Stripe-triggered transitions should go through /api/stripe/webhook, which
// already verifies signatures and runs server-side as the platform.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as {
    paymentMethod?: string;
    stripePaymentId?: string;
  };

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      studio: { select: { ownerId: true, name: true } },
      contact: { select: { name: true, email: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Ownership: invoice belongs to the studio owned by current session user
  if (invoice.studio.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
