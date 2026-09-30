/**
 * Excel ingestion pipeline for Vision_In_Action_Reporting_Template.xlsx
 *
 * Handles the nested 2-row header structure of the Data_Entry sheet:
 *   Row 0 (parent groups): Sex workers | Gender Minorities | IDP | PWDs | AGY-W | ABY-M | General | TOTAL
 *   Row 1 (sub-columns):   MALE | FEMALE (repeated per group)
 *
 * Standard columns: Date | Week | Month | Division - Subdivision | Communities |
 *                   Thematic Area | Age Group | Project
 */

type RawRow = {
  date: string | null;
  week: number | null;
  month: string | null;
  divisionSubdivision: string | null;
  community: string | null;
  thematicArea: string | null;
  ageGroup: string | null;
  project: string | null;
  counts: Record<string, { male: number; female: number }>;
  rawTotalMale: number;
  rawTotalFemale: number;
  rowIndex: number;
  /** Validation flags */
  flags: string[];
};

export type ParsedSheet = {
  rows: RawRow[];
  errors: string[];
  columnMap: Record<string, number>;
};

/** Key population header labels as they appear in the Excel file */
const KP_GROUP_LABELS: Record<string, string> = {
  "Sex workers": "Sex Workers",
  "Gender Minorities": "Gender Minorities",
  "IDP ": "Internally Displaced Persons (IDPs)",
  "Persons with disabilities": "Persons with Disabilities",
  "AGY-W": "Adolescent Girls & Young Women (AGYW)",
  "ABY-M": "Adolescent & Young Boys/Men (AYBM)",
  General: "General",
};

export async function parseExcelFile(buffer: ArrayBuffer): Promise<ParsedSheet> {
  // Dynamic import — xlsx is only available server-side
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().includes("data") || n.toLowerCase().includes("entry"),
  );

  if (!sheetName) {
    return {
      rows: [],
      errors: ["Could not find a Data_Entry sheet. Found sheets: " + workbook.SheetNames.join(", ")],
      columnMap: {},
    };
  }

  const sheet = workbook.Sheets[sheetName];
  // Get raw 2D array with header rows
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (raw.length < 3) {
    return { rows: [], errors: ["Sheet has fewer than 3 rows — no data found."], columnMap: {} };
  }

  const header0 = raw[0] as (string | null)[];
  const header1 = raw[1] as (string | null)[];

  // Build column map: { fieldName: colIndex }
  const colMap: Record<string, number> = {};
  const kpCols: { kpName: string; sex: "male" | "female"; colIndex: number }[] = [];
  const errors: string[] = [];

  let lastGroup = "";
  for (let c = 0; c < Math.max(header0.length, header1.length); c++) {
    const top = (header0[c] ?? "").toString().trim();
    const sub = (header1[c] ?? "").toString().trim().toUpperCase();

    // Standard scalar columns (row 0 label, no sub-column)
    if (top.toLowerCase().includes("date")) colMap["date"] = c;
    else if (top.toLowerCase().includes("week")) colMap["week"] = c;
    else if (top.toLowerCase().includes("month")) colMap["month"] = c;
    else if (top.toLowerCase().includes("division") || top.toLowerCase().includes("subdivision"))
      colMap["divisionSubdivision"] = c;
    else if (top.toLowerCase() === "communities" || top.toLowerCase() === "community")
      colMap["community"] = c;
    else if (top.toLowerCase().includes("thematic")) colMap["thematicArea"] = c;
    else if (top.toLowerCase().includes("age")) colMap["ageGroup"] = c;
    else if (top.toLowerCase() === "project") colMap["project"] = c;

    // Key population group header
    if (top && KP_GROUP_LABELS[top]) lastGroup = KP_GROUP_LABELS[top];
    if (top && top.toUpperCase() === "TOTAL") lastGroup = "TOTAL";

    // Sub-column: MALE / FEMALE
    if (lastGroup && lastGroup !== "TOTAL" && (sub === "MALE" || sub.startsWith("MALE") || sub === "MEN")) {
      kpCols.push({ kpName: lastGroup, sex: "male", colIndex: c });
    }
    if (lastGroup && lastGroup !== "TOTAL" && (sub === "FEMALE" || sub.startsWith("FEMALE") || sub === "WOMEN")) {
      kpCols.push({ kpName: lastGroup, sex: "female", colIndex: c });
    }
  }

  if (!colMap["community"] && !colMap["date"]) {
    errors.push("Could not identify standard columns. Please ensure the sheet matches the VIAC template.");
  }

  const rows: RawRow[] = [];

  for (let r = 2; r < raw.length; r++) {
    const row = raw[r] as unknown[];
    const rowFlags: string[] = [];

    const rawDate = row[colMap["date"]] ?? null;
    let dateStr: string | null = null;
    if (rawDate instanceof Date) {
      dateStr = rawDate.toISOString().slice(0, 10);
    } else if (typeof rawDate === "string" && rawDate.trim()) {
      dateStr = rawDate.trim();
    } else if (typeof rawDate === "number") {
      // Excel serial date
      const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      dateStr = d.toISOString().slice(0, 10);
    }

    const community = row[colMap["community"]] != null
      ? String(row[colMap["community"]]).trim()
      : null;

    if (!dateStr) rowFlags.push("missing_date");
    if (!community) rowFlags.push("missing_community");

    const counts: Record<string, { male: number; female: number }> = {};
    let rawTotalMale = 0;
    let rawTotalFemale = 0;

    for (const kp of kpCols) {
      const val = Number(row[kp.colIndex] ?? 0) || 0;
      if (!counts[kp.kpName]) counts[kp.kpName] = { male: 0, female: 0 };
      counts[kp.kpName][kp.sex] += val;
      if (kp.sex === "male") rawTotalMale += val;
      else rawTotalFemale += val;
    }

    // Validate: total must match sum of KP counts
    const declaredTotal = Number(row[header0.length - 1] ?? 0) || 0;
    if (declaredTotal > 0 && declaredTotal !== rawTotalMale + rawTotalFemale) {
      rowFlags.push("total_mismatch");
    }

    rows.push({
      date: dateStr,
      week: row[colMap["week"]] != null ? Number(row[colMap["week"]]) : null,
      month: row[colMap["month"]] != null ? String(row[colMap["month"]]).trim() : null,
      divisionSubdivision: row[colMap["divisionSubdivision"]] != null
        ? String(row[colMap["divisionSubdivision"]]).trim()
        : null,
      community,
      thematicArea: row[colMap["thematicArea"]] != null
        ? String(row[colMap["thematicArea"]]).trim()
        : null,
      ageGroup: row[colMap["ageGroup"]] != null
        ? String(row[colMap["ageGroup"]]).trim()
        : null,
      project: row[colMap["project"]] != null
        ? String(row[colMap["project"]]).trim()
        : null,
      counts,
      rawTotalMale,
      rawTotalFemale,
      rowIndex: r,
      flags: rowFlags,
    });
  }

  return { rows, errors, columnMap: colMap };
}
