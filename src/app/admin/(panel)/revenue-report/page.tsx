import { db }                 from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { toStringArray }      from "@/lib/revenue-report/json-fields";
import RevenueReportContent   from "./RevenueReportContent";

export default async function RevenueReportPage() {
  await requireAdminAccess("agents");

  const now           = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const page          = 1;
  const perPage       = 20;

  const [rawConfig, alerts, goals, logsResult] = await Promise.all([
    db.revenueReportConfig.findFirst(),
    db.revenueReportAlert.findMany({ orderBy: { createdAt: "asc" } }),
    db.revenueReportGoal.findMany({ where: { period: currentPeriod }, orderBy: { createdAt: "asc" } }),
    Promise.all([
      db.revenueReportLog.findMany({
        orderBy: { createdAt: "desc" },
        take:    perPage,
        skip:    0,
        select: { id: true, period: true, frequency: true, sentTo: true, createdAt: true },
      }),
      db.revenueReportLog.count(),
    ]),
  ]);

  const config = rawConfig ? {
    ...rawConfig,
    recipients:      toStringArray(rawConfig.recipients),
    enabledSections: toStringArray(rawConfig.enabledSections),
  } : null;

  const [logs, totalLogs] = logsResult;

  return (
    <RevenueReportContent
      config={config}
      alerts={alerts.map(a => ({
        ...a,
        lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
        createdAt:       a.createdAt.toISOString(),
      }))}
      goals={goals}
      history={{
        logs: logs.map((l) => ({
          ...l,
          sentTo: l.sentTo as string[],
          createdAt: l.createdAt.toISOString(),
        })),
        total:      totalLogs,
        page,
        perPage,
        totalPages: Math.ceil(totalLogs / perPage),
      }}
      currentPeriod={currentPeriod}
    />
  );
}
