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

  await createNotification({
    userId: invoice.studio.ownerId,
    type: "PAYMENT_RECEIVED",
    title: `Payment claimed — Invoice ${invoiceNum}`,
    message: `${invoice.contact.name} says they sent $${invoice.total.toFixed(2)} via ${method}. Verify and mark as paid.`,
    link: `/studio/invoices`,
  });

  return NextResponse.json({ ok: true });
}
