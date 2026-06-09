import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/invoice/[id]
//
// Returns invoice header data + Stripe-payments-enabled flag.
//
// Phase 1.2 PII scrub: does NOT return the studio's Cash App / Zelle / PayPal
// / Venmo handles, customer email, or customer phone. Those are sensitive
// fields that previously leaked to anyone with the invoice ID. The invoice
// page now fetches payment handles separately via POST /api/invoice/[id]/payment-options
// after the customer authenticates by entering the email the invoice was
// sent to.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true } },
        studio:  { select: { name: true, logo: true, stripePaymentsEnabled: true } },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Mark as VIEWED on first open (fire-and-forget — don't block response)
    if (invoice.status === "SENT") {
      db.invoice.update({ where: { id }, data: { status: "VIEWED" } }).catch(() => {});
    }

    return NextResponse.json({
      id:            invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      lineItems:     invoice.lineItems,
      subtotal:      invoice.subtotal,
      tax:           invoice.tax,
      taxRate:       invoice.taxRate,
      total:         invoice.total,
      dueDate:       invoice.dueDate,
      status:        invoice.status,
      notes:         invoice.notes,
      createdAt:     invoice.createdAt,
      studio: {
        name:                  invoice.studio.name,
        logo:                  invoice.studio.logo,
        stripePaymentsEnabled: invoice.studio.stripePaymentsEnabled,
      },
      contact: { name: invoice.contact.name },
    });
  } catch (err) {
    console.error("[invoice/GET]", err);
    return NextResponse.json({ error: "Failed to load invoice. Please try again." }, { status: 500 });
  }
}
