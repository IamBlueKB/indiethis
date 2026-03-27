import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getStudioInvoice(invoiceId: string, ownerId: string) {
  const studio = await db.studio.findFirst({
    where: { ownerId },
    select: { id: true },
  });
  if (!studio) return null;

  return db.invoice.findFirst({
    where: { id: invoiceId, studioId: studio.id },
    include: {
      contact: { select: { name: true, email: true, phone: true } },
      studio: { select: { name: true, email: true, phone: true } },
    },
  });
}

// GET /api/studio/invoices/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoice = await getStudioInvoice(id, session.user.id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  return NextResponse.json({ invoice });
}

// PATCH /api/studio/invoices/[id] — update or advance invoice status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getStudioInvoice(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const body = await req.json();

  // ── Status-only advance (Mark Sent / Mark Paid) ──────────────────────────
  if (body.status && !body.lineItems && !body.taxRate && !body.dueDate && body.notes === undefined) {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      DRAFT:   ["SENT", "PAID"],
      SENT:    ["PAID"],
      VIEWED:  ["PAID"],
      OVERDUE: ["PAID"],
    };
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status transition." }, { status: 400 });
    }
    const invoice = await db.invoice.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.status === "PAID" ? { paidAt: new Date(), paymentMethod: body.paymentMethod ?? "MANUAL" } : {}),
      },
    });
    return NextResponse.json({ invoice });
  }

  // ── Line-item / field edit (DRAFT only) ──────────────────────────────────
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT invoices can be edited." }, { status: 400 });
  }

  type LineItem = { description: string; quantity: number; rate: number; total: number };
  const lineItems: LineItem[] | undefined = body.lineItems;
  const taxRate: number | undefined = body.taxRate;
  const dueDate: string | undefined = body.dueDate;

  const subtotal = lineItems
    ? lineItems.reduce((s: number, i: LineItem) => s + i.total, 0)
    : existing.subtotal;
  const resolvedTaxRate = taxRate ?? existing.taxRate;
  const tax = subtotal * (resolvedTaxRate / 100);
  const total = subtotal + tax;

  const invoice = await db.invoice.update({
    where: { id },
    data: {
      lineItems: lineItems ?? existing.lineItems as LineItem[],
      subtotal,
      tax,
      taxRate: resolvedTaxRate,
      total,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      notes: body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
    },
  });

  return NextResponse.json({ invoice });
}

// DELETE /api/studio/invoices/[id] — only DRAFT invoices
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getStudioInvoice(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT invoices can be deleted." }, { status: 400 });
  }

  await db.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
