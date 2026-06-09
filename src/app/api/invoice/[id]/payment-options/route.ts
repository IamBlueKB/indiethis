/**
 * POST /api/invoice/[id]/payment-options
 *
 * Returns the studio's manual payment handles (Cash App, Zelle, PayPal, Venmo)
 * + contact details. Phase 1.2 PII scrub — these used to leak from GET
 * /api/invoice/[id] to anyone with the invoice ID. Now requires the caller to
 * prove they are the legitimate recipient by submitting the same email the
 * invoice was sent to.
 *
 * Body: { email: string }
 *
 * On match: returns the studio payment handles + customer email/phone.
 * On mismatch or missing email: 404, with no information leak.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json().catch(() => ({})) as { email?: string };
    const email  = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true, email: true, phone: true } },
        studio:  {
          select: {
            name: true, email: true, phone: true,
            cashAppHandle: true, zelleHandle: true, paypalHandle: true, venmoHandle: true,
            stripePaymentsEnabled: true,
          },
        },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const invoiceEmail = invoice.contact.email?.trim().toLowerCase() ?? "";
    if (!invoiceEmail || invoiceEmail !== email) {
      // Collapse "wrong email" and "no invoice" to identical responses so
      // the caller can't probe valid contact emails.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      studio: {
        name:                  invoice.studio.name,
        email:                 invoice.studio.email,
        phone:                 invoice.studio.phone,
        cashAppHandle:         invoice.studio.cashAppHandle,
        zelleHandle:           invoice.studio.zelleHandle,
        paypalHandle:          invoice.studio.paypalHandle,
        venmoHandle:           invoice.studio.venmoHandle,
        stripePaymentsEnabled: invoice.studio.stripePaymentsEnabled,
      },
      contact: {
        name:  invoice.contact.name,
        email: invoice.contact.email,
        phone: invoice.contact.phone,
      },
    });
  } catch (err) {
    console.error("[invoice/payment-options]", err);
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 });
  }
}
