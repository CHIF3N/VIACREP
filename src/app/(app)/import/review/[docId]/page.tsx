import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { StagingGrid } from "@/components/import/staging-grid";

export const metadata = { title: "Review Import" };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  await requireUser();

  const doc = await db.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      extractionStatus: true,
      extractedData: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  if (!doc) notFound();

  const isPdf = doc.mimeType.includes("pdf") || doc.fileName.toLowerCase().endsWith(".pdf");
  const isExcel = !isPdf;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Import review & staging"
        title={doc.fileName}
        description={`Uploaded by ${doc.uploadedBy?.name ?? "Coordinator"} on ${new Date(doc.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`}
      />
      <StagingGrid
        documentId={doc.id}
        extractedData={doc.extractedData}
        isExcel={isExcel}
        status={doc.extractionStatus}
      />
    </div>
  );
}
