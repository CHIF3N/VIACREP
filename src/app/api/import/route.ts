import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseExcelFile } from "@/lib/ingest/excel-parser";
import { parsePdfFile } from "@/lib/ingest/pdf-parser";

/**
 * POST /api/import
 * Accepts a multipart/form-data upload with a single `file` field.
 * Computes SHA-256, checks for duplicates, stores document record, runs parser.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");

  // Duplicate check
  const existing = await db.document.findUnique({ where: { fileHash: hash } });
  if (existing) {
    return NextResponse.json(
      {
        error: "Duplicate file",
        documentId: existing.id,
        message: "This exact file has already been uploaded.",
      },
      { status: 409 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const fileName = file.name;
  const isExcel =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls");
  const isPdf = mimeType.includes("pdf") || fileName.endsWith(".pdf");

  if (!isExcel && !isPdf) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload .xlsx or .pdf files." },
      { status: 400 },
    );
  }

  // Parse the file
  let extractedData: unknown;
  if (isExcel) {
    extractedData = await parseExcelFile(buffer);
  } else {
    extractedData = await parsePdfFile(buffer);
  }

  // Create the document record (storage path is a placeholder — use object storage in prod)
  const doc = await db.document.create({
    data: {
      fileName,
      storagePath: `uploads/${hash.slice(0, 8)}/${fileName}`,
      fileHash: hash,
      mimeType,
      extractionStatus: "REVIEWING",
      extractedData: extractedData as never,
      uploadedById: user.id,
    },
  });

  return NextResponse.json({ documentId: doc.id, extractedData });
}
