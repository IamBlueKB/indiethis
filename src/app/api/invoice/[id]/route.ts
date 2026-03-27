import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/invoice/[id] — public invoice page data (marks as VIEWED)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true, email: true, phone: true } },
        studio: { select: { name: true, email: true, phone: true, logo: true } },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Mark as VIEWED on first open (fire-and-forget — don't block response)
    if (invoice.status === "SENT") {
      db.invoice.update({ where: { id }, data: { status: "VIEWED" } }).catch(() => {});
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
  } catch (err) {
    console.error("[invoice/GET]", err);
    return NextResponse.json({ error: "Failed to load invoice. Please try again." }, { status: 500 });
  }
}
