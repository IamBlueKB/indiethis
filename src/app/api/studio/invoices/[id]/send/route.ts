import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInvoiceEmail } from "@/lib/brevo/email";
import { sendSMS } from "@/lib/brevo/sms";
import InvoicePDF from "@/components/pdf/InvoicePDF";

// POST /api/studio/invoices/[id]/send — email + SMS invoice to contact
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const invoice = await db.invoice.findFirst({
    where: { id, studioId: studio.id },
    include: {
      contact: { select: { name: true, email: true, phone: true } },
      studio: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Invoice already paid." }, { status: 400 });
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "indiethis.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const paymentUrl = `${appUrl}/invoice/${invoice.id}`;
  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  // Generate PDF
  let pdfBase64: string | undefined;
  try {
    const invoiceData = {
      ...invoice,
      lineItems: invoice.lineItems as { description: string; quantity: number; rate: number; total: number }[],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(InvoicePDF, { invoice: invoiceData }) as any);
    pdfBase64 = Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("[invoices/send] PDF generation failed:", err);
  }

  // Send email (non-fatal — log and continue if it fails)
  if (invoice.contact.email) {
    try {
      await sendInvoiceEmail({
        recipientEmail: invoice.contact.email,
        recipientName:  invoice.contact.name,
        senderName:     studio.name,
        invoiceId:      invoice.id,
        amount:         `$${invoice.total.toFixed(2)} USD`,
        dueDate,
        invoiceUrl:     paymentUrl,
        ...(pdfBase64
          ? { attachment: { content: pdfBase64, name: `invoice-${String(invoice.invoiceNumber).padStart(4, "0")}.pdf` } }
          : {}),
      });
    } catch (err) {
      console.error("[invoices/send] Email failed:", err);
    }
  }

  // Send SMS if phone available (non-fatal)
  if (invoice.contact.phone) {
    try {
      await sendSMS({
        to: invoice.contact.phone,
        content: `${studio.name}: Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} for $${invoice.total.toFixed(2)} due ${dueDate}. Pay here: ${paymentUrl}`,
        tag: "invoice",
      });
    } catch (err) {
      console.error("[invoices/send] SMS failed:", err);
    }
  }

  // Update status to SENT
  const updated = await db.invoice.update({
    where: { id },
    data: { status: "SENT" },
  });

  return NextResponse.json({ invoice: updated });
}
