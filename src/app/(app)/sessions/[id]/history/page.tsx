import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Edit History" };

export default async function SessionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const session = await db.session.findUnique({
    where: { id },
    select: {
      date: true,
      community: { select: { name: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          reason: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!session) notFound();

  const dateStr = session.date instanceof Date
    ? session.date.toLocaleDateString("en-GB")
    : String(session.date);

  return (
    <>
      <PageHeader
        eyebrow="Edit history"
        title={`${session.community.name} · ${dateStr}`}
        description={`${session.auditLogs.length} recorded change${session.auditLogs.length !== 1 ? "s" : ""}`}
      />
      <Card>
        <CardHeader title="Audit trail" description="Every manual edit made to this session" />
        <CardBody>
          {session.auditLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No edits recorded — this session has never been modified.
            </p>
          ) : (
            <ol className="space-y-0">
              {session.auditLogs.map((log, i) => (
                <li key={log.id} className="relative flex gap-4 py-4">
                  {/* Timeline line */}
                  {i < session.auditLogs.length - 1 && (
                    <div className="absolute left-3 top-10 bottom-0 w-px bg-ink-100" aria-hidden />
                  )}
                  {/* Dot */}
                  <div className="relative mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white">
                    <div className="size-2 rounded-full bg-blue-500" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">
                        {log.user?.name ?? "System"} changed{" "}
                        <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs text-ink-700">
                          {log.field}
                        </code>
                      </p>
                      <time
                        dateTime={log.createdAt.toISOString()}
                        className="ml-auto shrink-0 text-xs text-ink-400"
                      >
                        {log.createdAt.toLocaleString("en-GB")}
                      </time>
                    </div>
                    <div className="mt-1.5 flex gap-2 text-xs">
                      {log.oldValue && (
                        <span className="rounded bg-danger-50 px-2 py-1 text-danger-700 line-through">
                          {log.oldValue}
                        </span>
                      )}
                      {log.newValue && (
                        <span className="rounded bg-success-50 px-2 py-1 text-success-700">
                          {log.newValue}
                        </span>
                      )}
                    </div>
                    {log.reason && (
                      <p className="mt-1 text-xs italic text-ink-500">
                        Reason: {log.reason}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </>
  );
}