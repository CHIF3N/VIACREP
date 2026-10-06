/**
 * Excel ingestion pipeline for Vision In Action Cameroon reporting workbooks.
 *
 * Supports both:
 * 1. The official nested 2-row header structure of Vision_In_Action_Reporting_Template.xlsx:
 *    Row 0 (parent groups): Sex workers | Gender Minorities | IDP | PWDs | AGY-W | ABY-M | General | TOTAL
 *    Row 1 (sub-columns):   Date | Week | Month | Division - Subdivision | Communities | Thematic Area |
 *                           Age Group | Project | MALE | FEMALE | MALE: | FEMALE: | ... | WOMEN | MEN | Participants
 *
 * 2. Flat single-row header workbooks or CSV exports where column names appear on row 0.
 */

export type RawRow = {
  date: string | null;
  week: number | null;
  month: string | null;
  divisionSubdivision: string | null;
  community: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  project: string | null;
  activityType: string | null;
  counts: Record<string, { male: number; female: number }>;
  rawTotalMale: number;
  rawTotalFemale: number;
  declaredTotal: number | null;
  rowIndex: number;
  /** Validation flags: missing_date | missing_community | total_mismatch | zero_participants */
  flags: string[];
};

export type ParsedSheet = {
  sheetName: string;
  rows: RawRow[];
  errors: string[];
  warnings: string[];
  columnMap: Record<string, number>;
  totalRowsScanned: number;
  blankRowsIgnored: number;
};

/**
 * Robust date converter that handles:
 * - JS Date instances (from XLSX cellDates: true)
 * - Excel numerical serial dates (e.g. 46083 -> March 2026)
 * - Strings: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, or textual dates (e.g. "15 Mar 2026")
 */
export function parseDateCell(val: unknown): string | null {
  if (val == null) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  if (typeof val === "number") {
    // Valid Excel serial dates (e.g., 25569 = 1970-01-01, 60000 = ~2064)
    if (val >= 25569 && val <= 85000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  if (typeof val === "string") {
    const s = val.trim();
    if (!s || s.toLowerCase() === "jan-1900" || s === "0") return null;

    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (isoMatch) {
      const year = +isoMatch[1];
      const month = String(+isoMatch[2]).padStart(2, "0");
      const day = String(+isoMatch[3]).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY (Cameroon standard format)
    const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmyMatch) {
      const day = String(+dmyMatch[1]).padStart(2, "0");
      const month = String(+dmyMatch[2]).padStart(2, "0");
      const year = +dmyMatch[3];
      // Basic sanity check: if day > 12, it's definitely DD/MM/YYYY
      // If month > 12 and day <= 12, it was MM/DD/YYYY
      if (+dmyMatch[2] > 12 && +dmyMatch[1] <= 12) {
        return `${year}-${day}-${month}`;
      }
      return `${year}-${month}-${day}`;
    }

    // Try standard JS Date parsing (for e.g. "15 Mar 2026" or "March 15, 2026")
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

export async function parseExcelFile(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      sheetName: "",
      rows: [],
      errors: ["The workbook contains no sheets."],
      warnings: [],
      columnMap: {},
      totalRowsScanned: 0,
      blankRowsIgnored: 0,
    };
  }

  // Find the appropriate sheet:
  // 1. Sheet with "data" or "entry" in name (case-insensitive)
  // 2. Sheet with "session" in name
  // 3. Fall back to any sheet with at least 3 rows and recognizable headers
  // 4. Default to SheetNames[0]
  let targetSheetName = workbook.SheetNames.find(
    (n) => /data|entry/i.test(n) && !/pivot/i.test(n),
  );

  if (!targetSheetName) {
    targetSheetName = workbook.SheetNames.find((n) => /session/i.test(n));
  }

  if (!targetSheetName) {
    targetSheetName = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    return {
      sheetName: targetSheetName,
      rows: [],
      errors: [`Could not open sheet "${targetSheetName}".`],
      warnings: [],
      columnMap: {},
      totalRowsScanned: 0,
      blankRowsIgnored: 0,
    };
  }

  // Get raw 2D array
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (raw.length < 2) {
    return {
      sheetName: targetSheetName,
      rows: [],
      errors: [`Sheet "${targetSheetName}" contains fewer than 2 rows — no header or data found.`],
      warnings: [],
      columnMap: {},
      totalRowsScanned: 0,
      blankRowsIgnored: 0,
    };
  }

  const header0 = (raw[0] || []) as (string | null)[];
  const header1 = (raw[1] || []) as (string | null)[];

  // Determine whether this is a nested 2-row header or a single-row header
  // In the VIAC template, row 0 has group names ("Sex workers", "IDP", etc.) and row 1 has "Date", "Communities", etc.
  const hasNestedHeaders =
    header1.some((h) => {
      const s = String(h ?? "").trim().toLowerCase();
      return s === "date" || s.includes("communit") || s.startsWith("male") || s === "women";
    });

  const startRowIndex = hasNestedHeaders ? 2 : 1;
  const colMap: Record<string, number> = {};
  const kpCols: { kpName: string; sex: "male" | "female"; colIndex: number }[] = [];

  const maxCols = Math.max(header0.length, header1.length);
  let currentGroup = "";

  for (let c = 0; c < maxCols; c++) {
    const top = (header0[c] ?? "").toString().trim();
    const sub = hasNestedHeaders ? (header1[c] ?? "").toString().trim() : "";
    const combined = `${top} ${sub}`.trim().toLowerCase();
    const topLower = top.toLowerCase();
    const subLower = sub.toLowerCase();
    const subUpper = sub.toUpperCase();

    // 1. Standard dimension columns
    if (subLower === "date" || topLower === "date" || combined.includes("session date") || combined.includes("date of session")) {
      colMap["date"] = c;
    } else if (subLower === "week" || topLower === "week") {
      colMap["week"] = c;
    } else if (subLower === "month" || topLower === "month") {
      colMap["month"] = c;
    } else if (combined.includes("subdivision") || combined.includes("division")) {
      colMap["divisionSubdivision"] = c;
    } else if (subLower.includes("communit") || topLower.includes("communit") || combined.includes("locality") || combined.includes("village")) {
      colMap["community"] = c;
    } else if (combined.includes("thematic") || combined.includes("theme") || combined.includes("topic")) {
      colMap["thematicArea"] = c;
    } else if (combined.includes("age group") || subLower.includes("age") || topLower.includes("age")) {
      colMap["ageGroup"] = c;
    } else if (combined.includes("project") || combined.includes("programme") || combined.includes("program")) {
      colMap["project"] = c;
    } else if (combined.includes("activity") || combined.includes("format")) {
      colMap["activityType"] = c;
    }

    // 2. Key Population Group Header Tracking in Row 0
    if (/sex\s*worker/i.test(top)) currentGroup = "Sex Workers";
    else if (/gender\s*minorit/i.test(top)) currentGroup = "Gender Minorities";
    else if (/idp/i.test(top)) currentGroup = "Internally Displaced Persons (IDPs)";
    else if (/disabilit|pwd/i.test(top)) currentGroup = "Persons with Disabilities";
    else if (/agy/i.test(top)) currentGroup = "Adolescent Girls & Young Women (AGYW)";
    else if (/aby/i.test(top)) currentGroup = "Adolescent & Young Boys/Men (AYBM)";
    else if (/general/i.test(top)) currentGroup = "General";
    else if (/total/i.test(top)) currentGroup = "TOTAL";

    // 3. Sub-column mappings (MALE, FEMALE, WOMEN, MEN)
    if (subUpper === "WOMEN" || (subUpper === "FEMALE" && currentGroup === "General")) {
      kpCols.push({ kpName: "General", sex: "female", colIndex: c });
    } else if (subUpper === "MEN" || (subUpper === "MALE" && currentGroup === "General")) {
      kpCols.push({ kpName: "General", sex: "male", colIndex: c });
    } else if (sub === "FEMALE_" || (subUpper.startsWith("FEMALE") && currentGroup === "Adolescent Girls & Young Women (AGYW)")) {
      kpCols.push({ kpName: "Adolescent Girls & Young Women (AGYW)", sex: "female", colIndex: c });
    } else if (sub === "MALE_" || (subUpper.startsWith("MALE") && currentGroup === "Adolescent & Young Boys/Men (AYBM)")) {
      kpCols.push({ kpName: "Adolescent & Young Boys/Men (AYBM)", sex: "male", colIndex: c });
    } else if (sub === "MALE:" || (subUpper.startsWith("MALE") && currentGroup === "Gender Minorities")) {
      kpCols.push({ kpName: "Gender Minorities", sex: "male", colIndex: c });
    } else if (sub === "FEMALE:" || (subUpper.startsWith("FEMALE") && currentGroup === "Gender Minorities")) {
      kpCols.push({ kpName: "Gender Minorities", sex: "female", colIndex: c });
    } else if (sub === "MALE." || (subUpper.startsWith("MALE") && currentGroup === "Internally Displaced Persons (IDPs)")) {
      kpCols.push({ kpName: "Internally Displaced Persons (IDPs)", sex: "male", colIndex: c });
    } else if (sub === "FEMALE." || (subUpper.startsWith("FEMALE") && currentGroup === "Internally Displaced Persons (IDPs)")) {
      kpCols.push({ kpName: "Internally Displaced Persons (IDPs)", sex: "female", colIndex: c });
    } else if (sub === "MALE-" || (subUpper.startsWith("MALE") && currentGroup === "Persons with Disabilities")) {
      kpCols.push({ kpName: "Persons with Disabilities", sex: "male", colIndex: c });
    } else if (sub === "FEMALE-" || (subUpper.startsWith("FEMALE") && currentGroup === "Persons with Disabilities")) {
      kpCols.push({ kpName: "Persons with Disabilities", sex: "female", colIndex: c });
    } else if (subUpper.startsWith("MALE") && currentGroup && currentGroup !== "TOTAL") {
      kpCols.push({ kpName: currentGroup, sex: "male", colIndex: c });
    } else if (subUpper.startsWith("FEMALE") && currentGroup && currentGroup !== "TOTAL") {
      kpCols.push({ kpName: currentGroup, sex: "female", colIndex: c });
    }

    // 4. Total column
    if (top.toUpperCase() === "TOTAL" || subUpper.includes("PARTICIPANT") || subUpper === "TOTAL") {
      colMap["total"] = c;
    }
  }

  // Validate that essential columns were detected
  if (colMap["community"] === undefined && colMap["date"] === undefined) {
    errors.push(
      `Could not identify Date or Community columns in sheet "${targetSheetName}". Please ensure headers match the Vision In Action template.`,
    );
  }

  const rows: RawRow[] = [];
  let blankRowsIgnored = 0;

  for (let r = startRowIndex; r < raw.length; r++) {
    const row = (raw[r] || []) as unknown[];

    const rawDate = colMap["date"] !== undefined ? row[colMap["date"]] : null;
    const dateStr = parseDateCell(rawDate);

    const rawCommunity = colMap["community"] !== undefined ? row[colMap["community"]] : null;
    const community =
      rawCommunity != null && String(rawCommunity).trim() !== ""
        ? String(rawCommunity).trim().replace(/\s+/g, " ")
        : null;

    const rawThematic = colMap["thematicArea"] !== undefined ? row[colMap["thematicArea"]] : null;
    const thematicArea =
      rawThematic != null && String(rawThematic).trim() !== ""
        ? String(rawThematic).trim()
        : null;

    const rawProject = colMap["project"] !== undefined ? row[colMap["project"]] : null;
    const project =
      rawProject != null && String(rawProject).trim() !== ""
        ? String(rawProject).trim()
        : null;

    const rawAge = colMap["ageGroup"] !== undefined ? row[colMap["ageGroup"]] : null;
    const ageGroup =
      rawAge != null && String(rawAge).trim() !== "" ? String(rawAge).trim() : null;

    const rawAct = colMap["activityType"] !== undefined ? row[colMap["activityType"]] : null;
    const activityType =
      rawAct != null && String(rawAct).trim() !== "" ? String(rawAct).trim() : null;

    const rawDiv =
      colMap["divisionSubdivision"] !== undefined
        ? row[colMap["divisionSubdivision"]]
        : null;
    const divisionSubdivision =
      rawDiv != null && String(rawDiv).trim() !== "" ? String(rawDiv).trim() : null;

    // Sum key populations
    const counts: Record<string, { male: number; female: number }> = {};
    let rawTotalMale = 0;
    let rawTotalFemale = 0;

    for (const kp of kpCols) {
      const cellVal = row[kp.colIndex];
      const val = cellVal != null && !isNaN(Number(cellVal)) ? Math.max(0, Math.floor(Number(cellVal))) : 0;
      if (!counts[kp.kpName]) counts[kp.kpName] = { male: 0, female: 0 };
      counts[kp.kpName][kp.sex] += val;
      if (kp.sex === "male") rawTotalMale += val;
      else rawTotalFemale += val;
    }

    const calculatedTotal = rawTotalMale + rawTotalFemale;

    const rawDeclaredTotal =
      colMap["total"] !== undefined ? row[colMap["total"]] : null;
    const declaredTotal =
      rawDeclaredTotal != null && !isNaN(Number(rawDeclaredTotal))
        ? Number(rawDeclaredTotal)
        : null;

    // Check if this is a completely blank or formula template placeholder row
    // In Vision_In_Action_Reporting_Template.xlsx, rows 2..201 are pre-filled formulas with 0 participants and null dates
    const isBlankRow =
      !dateStr &&
      !community &&
      !thematicArea &&
      !project &&
      calculatedTotal === 0 &&
      (declaredTotal === null || declaredTotal === 0);

    if (isBlankRow) {
      blankRowsIgnored++;
      continue;
    }

    // Row validation flags
    const rowFlags: string[] = [];

    if (!dateStr) {
      rowFlags.push("missing_date");
    }

    if (!community) {
      rowFlags.push("missing_community");
    }

    if (declaredTotal !== null && declaredTotal > 0 && declaredTotal !== calculatedTotal) {
      rowFlags.push("total_mismatch");
    }

    if (calculatedTotal === 0 && (declaredTotal === null || declaredTotal === 0)) {
      rowFlags.push("zero_participants");
    }

    rows.push({
      date: dateStr,
      week:
        colMap["week"] !== undefined && row[colMap["week"]] != null && !isNaN(Number(row[colMap["week"]]))
          ? Number(row[colMap["week"]])
          : null,
      month:
        colMap["month"] !== undefined && row[colMap["month"]] != null
          ? String(row[colMap["month"]]).trim()
          : null,
      divisionSubdivision,
      community,
      thematicArea,
      ageGroup,
      project,
      activityType,
      counts,
      rawTotalMale,
      rawTotalFemale,
      declaredTotal,
      rowIndex: r + 1, // 1-based row index for UI display
      flags: rowFlags,
    });
  }

  if (rows.length === 0 && blankRowsIgnored > 0) {
    warnings.push(
      `Sheet "${targetSheetName}" contains ${blankRowsIgnored} formula template rows, but no session data has been entered yet. Please fill in records on the Data_Entry sheet.`,
    );
  }

  return {
    sheetName: targetSheetName,
    rows,
    errors,
    warnings,
    columnMap: colMap,
    totalRowsScanned: raw.length - startRowIndex,
    blankRowsIgnored,
  };
}
