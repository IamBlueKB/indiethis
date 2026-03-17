import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import InvoicePDF from "@/components/pdf/InvoicePDF";

export async function GET(
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
    select: { id: true },
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

  type LineItem = { description: string; quantity: number; rate: number; total: number };
  const invoiceData = {
    ...invoice,
    lineItems: invoice.lineItems as LineItem[],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(InvoicePDF, { invoice: invoiceData }) as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${String(invoice.invoiceNumber).padStart(4, "0")}.pdf"`,
    },
  });
}
