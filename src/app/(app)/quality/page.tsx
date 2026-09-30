import { requireUser } from "@/lib/auth";
import { getQualityAlerts } from "@/lib/quality";
import { getAuditLog } from "@/lib/audit";
import { ALL_TIME } from "@/lib/scope";
import { PageHeader } from "@/components/layout/page-header";
import { QualityAuditView } from "@/components/quality/quality-audit-view";

export const metadata = { title: "Data Quality" };

export default async function QualityPage() {
  const user = await requireUser();
  const [alerts, auditLog] = await Promise.all([
    getQualityAlerts(user),
    getAuditLog(user, ALL_TIME, 100),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Quality"
        title="Data quality center"
        description={`${alerts.length} open alert${alerts.length !== 1 ? "s" : ""} · ${auditLog.length} recent edits`}
      />
      <QualityAuditView alerts={alerts} auditLog={auditLog} />
    </>
  );
}