import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// POST /api/invoice/[id]/stripe-checkout — create Stripe checkout for invoice payment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      studio: { select: { name: true, stripePaymentsEnabled: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "PAID") return NextResponse.json({ error: "Already paid." }, { status: 400 });
  if (!invoice.studio.stripePaymentsEnabled) return NextResponse.json({ error: "Card payments not enabled." }, { status: 400 });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3456");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(invoice.total * 100),
          product_data: {
            name: `Invoice #${String(invoice.invoiceNumber).padStart(4, "0")}`,
            description: `Payment to ${invoice.studio.name}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/invoice/${id}?paid=stripe`,
    cancel_url: `${appUrl}/invoice/${id}`,
    metadata: { type: "invoice_payment", invoiceId: id },
  });

  return NextResponse.json({ url: session.url });
}
