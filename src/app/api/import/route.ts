import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseExcelFile } from "@/lib/ingest/excel-parser";
import { parsePdfFile } from "@/lib/ingest/pdf-parser";

/**
 * GET /api/import
 * Returns list of recent documents uploaded for ingestion.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const docs = await db.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        extractionStatus: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        _count: { select: { sessions: true } },
      },
    });

    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error("Failed to fetch documents:", err);
    return NextResponse.json({ documents: [] });
  }
}

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

  const mimeType = file.type || "application/octet-stream";
  const fileName = file.name;
  const isExcel =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls");
  const isCsv =
    mimeType.includes("csv") ||
    mimeType.includes("comma-separated") ||
    fileName.endsWith(".csv");
  const isPdf = mimeType.includes("pdf") || fileName.endsWith(".pdf");

  if (!isExcel && !isCsv && !isPdf) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload .xlsx, .xls, .csv, or .pdf files." },
      { status: 400 },
    );
  }

  // Parse the file
  let extractedData: unknown;
  try {
    if (isExcel || isCsv) {
      extractedData = await parseExcelFile(buffer);
    } else {
      extractedData = await parsePdfFile(buffer);
    }
  } catch (parseErr) {
    console.error("File parsing error:", parseErr);
    return NextResponse.json(
      {
        error: "File parsing failed",
        message: parseErr instanceof Error ? parseErr.message : "Unable to parse file contents",
      },
      { status: 422 },
    );
  }

  // Duplicate check
  const existing = await db.document.findUnique({ where: { fileHash: hash } });
  if (existing) {
    // If the file was already committed to the live database, warn with 409
    if (existing.extractionStatus === "COMMITTED") {
      return NextResponse.json(
        {
          error: "Duplicate file",
          documentId: existing.id,
          message: "This exact file has already been committed to the live database.",
          status: "COMMITTED",
        },
        { status: 409 },
      );
    }

    // If still in REVIEWING or PENDING state, update the existing record with fresh extractedData
    const updatedDoc = await db.document.update({
      where: { id: existing.id },
      data: {
        fileName,
        extractedData: extractedData as never,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      documentId: updatedDoc.id,
      extractedData,
      isReupload: true,
      message: "Existing staged document refreshed with new extraction.",
    });
  }

  // Create new document record
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
