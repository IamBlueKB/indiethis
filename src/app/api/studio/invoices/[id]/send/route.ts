import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";
import { sendSMS } from "@/lib/brevo/sms";
import InvoicePDF from "@/components/pdf/InvoicePDF";

// POST /api/studio/invoices/[id]/send — email + SMS invoice to contact
export async function POST(
  _req: NextRequest,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://indiethis.com");
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

  // Send email
  if (invoice.contact.email) {
    await sendEmail({
      to: { email: invoice.contact.email, name: invoice.contact.name },
      subject: `Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} from ${studio.name} — $${invoice.total.toFixed(2)} due ${dueDate}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">Invoice from ${studio.name}</h2>
          <p style="color:#888;margin-top:0">Invoice #${String(invoice.invoiceNumber).padStart(4, "0")}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p>Hi ${invoice.contact.name},</p>
          <p>You have a new invoice for <strong>$${invoice.total.toFixed(2)} USD</strong>, due on <strong>${dueDate}</strong>.</p>
          <p>
            <a href="${paymentUrl}"
               style="background:#7B61FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
              View &amp; Pay Invoice
            </a>
          </p>
          <p style="color:#aaa;font-size:12px">Invoice PDF is attached for your records.</p>
        </div>
      `,
      ...(pdfBase64
        ? {
            attachment: [
              {
                content: pdfBase64,
                name: `invoice-${String(invoice.invoiceNumber).padStart(4, "0")}.pdf`,
              },
            ],
          }
        : {}),
      tags: ["invoice"],
    } as Parameters<typeof sendEmail>[0]);
  }

  // Send SMS if phone available
  if (invoice.contact.phone) {
    await sendSMS({
      to: invoice.contact.phone,
      content: `${studio.name}: Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} for $${invoice.total.toFixed(2)} due ${dueDate}. Pay here: ${paymentUrl}`,
      tag: "invoice",
    });
  }

  // Update status to SENT
  const updated = await db.invoice.update({
    where: { id },
    data: { status: "SENT" },
  });

  return NextResponse.json({ invoice: updated });
}
