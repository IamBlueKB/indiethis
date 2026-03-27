import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";
import { sendSMS } from "@/lib/brevo/sms";

/**
 * POST /api/studio/invoices/reminders
 * Run by a cron job (e.g., daily at 9am).
 * Sends reminder emails/SMS for overdue invoices:
 *   - 3 days past due → first reminder (remindersSent < 1)
 *   - 7 days past due → second reminder (remindersSent < 2)
 * Also marks invoices OVERDUE if past due date and still SENT/VIEWED.
 *
 * Secure with CRON_SECRET env var.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://indiethis.com");

  // Find all unpaid invoices that are past due
  const overdueInvoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "VIEWED", "OVERDUE"] },
      dueDate: { lt: now },
    },
    include: {
      contact: { select: { name: true, email: true, phone: true } },
      studio: { select: { name: true } },
    },
  });

  let reminded = 0;
  let markedOverdue = 0;

  for (const invoice of overdueInvoices) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Mark as OVERDUE if not already
    if (invoice.status !== "OVERDUE") {
      await db.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });
      markedOverdue++;
    }

    const paymentUrl = `${appUrl}/invoice/${invoice.id}`;
    const dueStr = new Date(invoice.dueDate).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });

    // First reminder: 3+ days overdue, no reminders sent yet
    if (daysOverdue >= 3 && invoice.remindersSent < 1) {
      if (invoice.contact.email) {
        await sendEmail({
          to: { email: invoice.contact.email, name: invoice.contact.name },
          subject: `Reminder: Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} from ${invoice.studio.name} is overdue`,
          htmlContent: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
              <h2>Friendly Payment Reminder</h2>
              <p>Hi ${invoice.contact.name},</p>
              <p>Invoice <strong>#${String(invoice.invoiceNumber).padStart(4, "0")}</strong> from <strong>${invoice.studio.name}</strong> was due on ${dueStr} and remains unpaid.</p>
              <p><strong>Amount Due: $${invoice.total.toFixed(2)} USD</strong></p>
              <p>
                <a href="${paymentUrl}" style="background:#7B61FF;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Pay Now</a>
              </p>
            </div>
          `,
          tags: ["invoice-reminder"],
        });
      }
      if (invoice.contact.phone) {
        await sendSMS({
          to: invoice.contact.phone,
          content: `${invoice.studio.name}: Reminder — Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} for $${invoice.total.toFixed(2)} was due ${dueStr}. Pay: ${paymentUrl}`,
          tag: "invoice-reminder",
        });
      }
      await db.invoice.update({
        where: { id: invoice.id },
        data: { remindersSent: { increment: 1 } },
      });
      reminded++;
    }

    // Second reminder: 7+ days overdue, only 1 reminder sent
    else if (daysOverdue >= 7 && invoice.remindersSent < 2) {
      if (invoice.contact.email) {
        await sendEmail({
          to: { email: invoice.contact.email, name: invoice.contact.name },
          subject: `Final Reminder: Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} from ${invoice.studio.name} — Action Required`,
          htmlContent: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
              <h2 style="color:#dc2626">Final Payment Reminder</h2>
              <p>Hi ${invoice.contact.name},</p>
              <p>Invoice <strong>#${String(invoice.invoiceNumber).padStart(4, "0")}</strong> from <strong>${invoice.studio.name}</strong> is now <strong>${daysOverdue} days overdue</strong>. Please arrange payment as soon as possible.</p>
              <p><strong>Amount Due: $${invoice.total.toFixed(2)} USD</strong></p>
              <p>
                <a href="${paymentUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Pay Now</a>
              </p>
            </div>
          `,
          tags: ["invoice-reminder-final"],
        });
      }
      if (invoice.contact.phone) {
        await sendSMS({
          to: invoice.contact.phone,
          content: `${invoice.studio.name}: FINAL NOTICE — Invoice #${String(invoice.invoiceNumber).padStart(4, "0")} for $${invoice.total.toFixed(2)} is ${daysOverdue} days overdue. Pay now: ${paymentUrl}`,
          tag: "invoice-reminder-final",
        });
      }
      await db.invoice.update({
        where: { id: invoice.id },
        data: { remindersSent: { increment: 1 } },
      });
      reminded++;
    }
  }

  return NextResponse.json({ reminded, markedOverdue, checked: overdueInvoices.length });
}
