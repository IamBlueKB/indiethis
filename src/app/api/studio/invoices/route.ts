import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type LineItem = { description: string; quantity: number; rate: number; total: number };

// GET /api/studio/invoices — list all invoices for the studio
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const invoices = await db.invoice.findMany({
    where: { studioId: studio.id },
    include: { contact: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invoices });
}

// POST /api/studio/invoices — create a new invoice
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const { contactId, lineItems, taxRate, dueDate, notes } = body as {
    contactId: string;
    lineItems: LineItem[];
    taxRate?: number;
    dueDate: string;
    notes?: string;
  };

  if (!contactId || !lineItems?.length || !dueDate) {
    return NextResponse.json({ error: "Contact, line items, and due date are required." }, { status: 400 });
  }

  // Verify contact belongs to this studio
  const contact = await db.contact.findFirst({ where: { id: contactId, studioId: studio.id } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Auto-increment invoice number per studio
  const lastInvoice = await db.invoice.findFirst({
    where: { studioId: studio.id },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const invoiceNumber = (lastInvoice?.invoiceNumber ?? 0) + 1;

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const resolvedTaxRate = taxRate ?? 0;
  const tax = subtotal * (resolvedTaxRate / 100);
  const total = subtotal + tax;

  const invoice = await db.invoice.create({
    data: {
      studioId: studio.id,
      contactId,
      invoiceNumber,
      lineItems,
      subtotal,
      tax,
      taxRate: resolvedTaxRate,
      total,
      dueDate: new Date(dueDate),
      notes: notes?.trim() || null,
    },
    include: { contact: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
