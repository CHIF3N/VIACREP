/**
 * PDF Narrative Report Extraction
 *
 * Uses pdfjs-dist to extract text from monthly/quarterly narrative PDFs.
 * Applies heuristic field matching to pull out:
 *   - Reporting period
 *   - Executive summary bullets
 *   - Objectives, Methodology, Lessons Learned sections
 *   - Summary matrices (best-effort)
 */

export type ParsedPdf = {
  reportingPeriod: string | null;
  executiveSummary: string;
  objectives: string;
  methodology: string;
  lessonsLearned: string;
  fullText: string;
  pageCount: number;
  errors: string[];
};

const SECTION_PATTERNS = {
  executiveSummary: /executive\s+summary/i,
  objectives: /\b(objectives?|goal)\b/i,
  methodology: /\bmethod(?:ology|s)?\b/i,
  lessonsLearned: /lessons?\s+(?:learnt|learned)/i,
  period: /(?:reporting\s+period|period\s+covered):\s*(.+)/i,
};

export async function parsePdfFile(buffer: ArrayBuffer): Promise<ParsedPdf> {
  const errors: string[] = [];

  try {
    // pdfjs-dist is a devDependency — import dynamically
    const pdfjsLib = await import("pdfjs-dist");

    // Disable worker for Node.js server-side usage
    (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageCount = pdf.numPages;
    const pageTexts: string[] = [];

    for (let p = 1; p <= pageCount; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? (item as { str: string }).str : ""))
        .join(" ");
      pageTexts.push(text);
    }

    const fullText = pageTexts.join("\n");

    // Extract reporting period
    const periodMatch = fullText.match(SECTION_PATTERNS.period);
    const reportingPeriod = periodMatch ? periodMatch[1].trim().slice(0, 60) : null;

    // Heuristic section extraction: find the start of each section heading
    // and take text up to the next heading
    function extractSection(pattern: RegExp): string {
      const idx = fullText.search(pattern);
      if (idx === -1) return "";
      const start = idx;
      // Find next section (any heading-like line)
      const after = fullText.slice(start + 50);
      const nextHeading = after.search(/\n[A-Z][A-Z\s&]{4,50}\n/);
      const end = nextHeading === -1 ? start + 1200 : start + 50 + nextHeading;
      return fullText.slice(start, end).trim().slice(0, 2000);
    }

    return {
      reportingPeriod,
      executiveSummary: extractSection(SECTION_PATTERNS.executiveSummary),
      objectives: extractSection(SECTION_PATTERNS.objectives),
      methodology: extractSection(SECTION_PATTERNS.methodology),
      lessonsLearned: extractSection(SECTION_PATTERNS.lessonsLearned),
      fullText: fullText.slice(0, 50000), // cap at 50k chars
      pageCount,
      errors,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Unknown PDF parsing error");
    return {
      reportingPeriod: null,
      executiveSummary: "",
      objectives: "",
      methodology: "",
      lessonsLearned: "",
      fullText: "",
      pageCount: 0,
      errors,
    };
  }
}
