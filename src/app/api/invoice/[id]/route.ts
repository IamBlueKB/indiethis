import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/invoice/[id] — public invoice page data (marks as VIEWED)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      contact: { select: { name: true, email: true, phone: true } },
      studio: { select: { name: true, email: true, phone: true, logo: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Mark as VIEWED on first open
  if (invoice.status === "SENT") {
    await db.invoice.update({ where: { id }, data: { status: "VIEWED" } });
  }

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    taxRate: invoice.taxRate,
    total: invoice.total,
    dueDate: invoice.dueDate,
    status: invoice.status,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
    studio: invoice.studio,
    contact: invoice.contact,
  });
}
