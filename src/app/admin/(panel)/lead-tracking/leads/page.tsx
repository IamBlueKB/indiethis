import { db } from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import LeadsContent from "./LeadsContent";

export default async function LeadSubmissionsPage() {
  await requireAdminAccess("lead-tracking");

  const now           = new Date();
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const month         = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [contactSubs, intakeSubs] = await Promise.all([
    db.contactSubmission.findMany({
      where:   { createdAt: { gte: startOfMonth } },
      select:  { id: true, name: true, email: true, createdAt: true, studioId: true, studio: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.intakeSubmission.findMany({
      where:   { createdAt: { gte: startOfMonth } },
      select:  {
        id: true, artistName: true, createdAt: true, studioId: true,
        convertedToBookingId: true,
        intakeLink: { select: { email: true } },
        studio:    { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const leads = [
    ...contactSubs.map((s) => ({
      id:     `c-${s.id}`,
      studio: s.studio.name,
      name:   s.name,
      email:  s.email,
      date:   s.createdAt.toISOString(),
      source: "Contact Form" as const,
      status: "Inquiry" as const,
    })),
    ...intakeSubs.map((s) => ({
      id:     `i-${s.id}`,
      studio: s.studio.name,
      name:   s.artistName,
      email:  s.intakeLink?.email ?? "—",
      date:   s.createdAt.toISOString(),
      source: "Intake Form" as const,
      status: s.convertedToBookingId ? ("Converted" as const) : ("Requested" as const),
    })),
  ];

  return (
    <LeadsContent
      leads={leads}
      total={leads.length}
      month={month}
    />
  );
}
