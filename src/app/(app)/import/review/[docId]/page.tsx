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

  const isExcel =
    doc.mimeType.includes("spreadsheet") ||
    doc.mimeType.includes("excel") ||
    doc.fileName.endsWith(".xlsx");

  return (
    <>
      <PageHeader
        eyebrow="Import review"
        title={doc.fileName}
        description={`Uploaded by ${doc.uploadedBy.name} on ${doc.createdAt.toLocaleDateString("en-GB")}`}
      />
      <StagingGrid
        documentId={doc.id}
        extractedData={doc.extractedData}
        isExcel={isExcel}
        status={doc.extractionStatus}
      />
    </>
  );
}