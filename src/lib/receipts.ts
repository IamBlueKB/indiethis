/**
 * Receipt generation utility
 * Creates a Receipt record, generates PDF, and emails it to the user.
 */

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import type { ReceiptType } from "@prisma/client";
import ReceiptPDF from "@/components/pdf/ReceiptPDF";

export type CreateReceiptParams = {
  userId: string;
  type: ReceiptType;
  description: string;
  amount: number;
  paymentMethod?: string;
  stripePaymentId?: string;
  studioName?: string;
};

/**
 * Creates a receipt, generates the PDF, stores the download URL, and returns the receipt.
 * Call this after any successful payment.
 */
export async function createReceipt(params: CreateReceiptParams) {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error("User not found");

  // Create receipt record (pdfUrl will be set to the API route for on-demand generation)
  const receipt = await db.receipt.create({
    data: {
      userId: params.userId,
      type: params.type,
      description: params.description,
      amount: params.amount,
      paymentMethod: params.paymentMethod ?? null,
      stripePaymentId: params.stripePaymentId ?? null,
    },
  });

  // Set pdfUrl to the on-demand API route
  const pdfUrl = `/api/receipts/${receipt.id}/pdf`;
  await db.receipt.update({ where: { id: receipt.id }, data: { pdfUrl } });

  // Send email with PDF attachment (fire-and-forget)
  sendReceiptEmail({ receipt: { ...receipt, pdfUrl, user }, studioName: params.studioName }).catch(
    (err) => console.error("[receipts] Email send failed:", err)
  );

  return { ...receipt, pdfUrl };
}

async function sendReceiptEmail({
  receipt,
  studioName,
}: {
  receipt: {
    id: string;
    type: string;
    description: string;
    amount: number;
    paymentMethod: string | null;
    stripePaymentId: string | null;
    pdfUrl: string | null;
    createdAt: Date;
    user: { name: string; email: string };
  };
  studioName?: string;
}) {
  const { sendEmail } = await import("@/lib/brevo/email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  // Generate PDF buffer for attachment
  let pdfBase64: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ReceiptPDF, { receipt, studioName }) as any);
    pdfBase64 = Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("[receipts] PDF generation failed:", err);
  }

  const brandName = studioName ?? "IndieThis";
  const date = new Date(receipt.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  await sendEmail({
    to: { email: receipt.user.email, name: receipt.user.name },
    subject: `Your receipt from ${brandName} — $${receipt.amount.toFixed(2)}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">Receipt from ${brandName}</h2>
        <p style="color:#888;margin-top:0">${date}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p><strong>Amount Paid:</strong> $${receipt.amount.toFixed(2)} USD</p>
        <p><strong>Description:</strong> ${receipt.description}</p>
        ${receipt.paymentMethod ? `<p><strong>Payment Method:</strong> ${receipt.paymentMethod}</p>` : ""}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p>
          <a href="${appUrl}/api/receipts/${receipt.id}/pdf"
             style="background:#7B61FF;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Download Receipt PDF
          </a>
        </p>
        <p style="color:#aaa;font-size:12px">Thank you for your payment.</p>
      </div>
    `,
    ...(pdfBase64
      ? {
          attachment: [
            {
              content: pdfBase64,
              name: `receipt-${receipt.id.slice(-8)}.pdf`,
            },
          ],
        }
      : {}),
    tags: ["receipt"],
  } as Parameters<typeof sendEmail>[0]);
}
