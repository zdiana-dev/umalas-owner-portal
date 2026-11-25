/**
 * Browser-side parsing and validation for the bulk units & owners CSV.
 * Nothing here touches the database: the preview is computed locally so the
 * admin sees every row, its status and every problem before anything is written.
 */

export const IMPORT_COLUMNS = [
  "unit_code",
  "building",
  "floor",
  "unit_type",
  "coefficient",
  "owner_full_name",
  "owner_email",
  "owner_phone",
  "owning_company",
  "ma_number",
  "ma_signed_date",
  "ma_start",
  "ma_end",
  "ma_status",
  "ready_to_invite",
  "source",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export type RawRow = Record<ImportColumn, string> & { __line: number };

export type RowStatus = "new_unit" | "update_unit" | "skipped";
export type OwnerStatus = "new_owner" | "existing_owner" | "no_owner";

export type PreviewRow = {
  line: number;
  unit_code: string;
  building: string | null;
  floor: number | null;
  unit_type: string | null;
  coefficient: number | null;
  ma_number: string | null;
  ma_start: string | null;
  ma_end: string | null;
  owner_full_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  unitStatus: RowStatus;
  ownerStatus: OwnerStatus;
  notes: string[];
  skipReason: string | null;
};

export type Preview = {
  rows: PreviewRow[];
  malformed: { line: number; reason: string; raw: string }[];
  totals: {
    unitsToCreate: number;
    unitsToUpdate: number;
    ownersToInvite: number;
    ownersExisting: number;
    skipped: number;
    multiUnitOwners: number;
  };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Minimal RFC4180 splitter: handles quoted fields, doubled quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === "\\" && (src[i + 1] === "," || src[i + 1] === ";")) {
      // The client's export uses "\," inside a cell to list several emails or
      // phones for one owner. Keep it inside the cell instead of splitting.
      cell += ` ${src[i + 1]} `;
      i += 1;
    } else if (ch === "," || ch === ";") {

      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function num(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Accepts YYYY-MM-DD, DD.MM.YYYY and "23 Mar 2026" / "23 March 2026". */
export function normalizeDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const dotted = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(raw);
  if (dotted) {
    const [, d, m, y] = dotted;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const named = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(raw);
  if (named) {
    const [, d, monthName, y] = named;
    const i = MONTHS.findIndex((m) => monthName!.toLowerCase().startsWith(m));
    if (i >= 0) {
      return `${y}-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const EMAIL_ANY = /[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}/g;
const PHONE = /^\+?[\d(][\d\s()+\-.]{6,}$/;

/**
 * The real archive export is not column-perfect: extra "\," values shift the
 * tail of a row, so emails, phones, MA numbers and MA dates can land in the
 * wrong column. The first six columns are reliable; everything after them is
 * recognised by shape so no row is dropped or mis-read.
 */
function extractTail(tail: string[]) {
  const joined = tail.join(" ");
  const emails = (joined.match(EMAIL_ANY) ?? []).map((e) => e.toLowerCase());
  const phones: string[] = [];
  const dates: string[] = [];
  let maNumber: string | null = null;
  for (const cellRaw of tail) {
    const cell = cellRaw.trim();
    if (!cell) continue;
    if (!maNumber && /^No\.?\s*\d+/i.test(cell)) {
      maNumber = cell;
      continue;
    }
    const iso = normalizeDate(cell);
    if (iso) {
      dates.push(iso);
      continue;
    }
    for (const part of cell.split(/\s[,;]\s/)) {
      const p = part.trim();
      if (p && !p.includes("@") && PHONE.test(p)) phones.push(p);
    }
  }
  // The export repeats the signed date and the start date, so collapse
  // duplicates: the earliest distinct date is the start, the latest the end.
  const unique = [...new Set(dates)].sort();
  return {
    email: emails[0] ?? null,
    extraEmails: emails.slice(1),
    phone: phones[0] ?? null,
    maNumber,
    maStart: unique[0] ?? null,
    maEnd: unique.length > 1 ? unique[unique.length - 1]! : null,
  };
}


export type ExistingState = {
  unitCodes: Set<string>;
  ownerEmails: Set<string>;
};


export function buildPreview(text: string, existing: ExistingState, labels: Labels): Preview {
  const table = parseCsv(text);
  const malformed: Preview["malformed"] = [];
  if (table.length === 0) {
    return {
      rows: [],
      malformed: [{ line: 1, reason: labels.emptyFile, raw: "" }],
      totals: {
        unitsToCreate: 0,
        unitsToUpdate: 0,
        ownersToInvite: 0,
        ownersExisting: 0,
        skipped: 0,
        multiUnitOwners: 0,
      },
    };
  }

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    if (!index.has(name)) index.set(name, i);
  });
  const missing = IMPORT_COLUMNS.filter((c) => !index.has(c));

  const rows: PreviewRow[] = [];
  const seenCodes = new Set<string>();
  const emailCounts = new Map<string, number>();
  const newEmails = new Set<string>();

  for (let r = 1; r < table.length; r += 1) {
    const cells = table[r]!;
    const line = r + 1;
    const get = (name: ImportColumn) => {
      const i = index.get(name);
      return i == null ? "" : (cells[i] ?? "").trim();
    };
    const code = get("unit_code").toUpperCase();
    if (!code) {
      malformed.push({ line, reason: labels.noUnitCode, raw: cells.join(",") });
      continue;
    }

    const notes: string[] = [];
    let skipReason: string | null = null;
    if (seenCodes.has(code)) skipReason = labels.duplicateInFile;
    seenCodes.add(code);

    const ownerIdx = index.get("owner_full_name") ?? 5;
    const tail = extractTail(cells.slice(ownerIdx + 1));
    const emailRaw = (tail.email ?? get("owner_email")).toLowerCase();
    let ownerStatus: OwnerStatus = "no_owner";
    let email: string | null = null;
    if (!emailRaw) {
      notes.push(labels.noEmail);
    } else if (!EMAIL.test(emailRaw)) {
      notes.push(labels.badEmail);
    } else {
      email = emailRaw;
      emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
      if (existing.ownerEmails.has(email)) {
        ownerStatus = "existing_owner";
      } else {
        ownerStatus = "new_owner";
        newEmails.add(email);
      }
    }
    if (tail.extraEmails.length > 0) {
      notes.push(`${labels.extraEmails}: ${tail.extraEmails.join(", ")}`);
    }

    const fullName = get("owner_full_name");
    if (email && !fullName) notes.push(labels.noName);

    const coefficient = num(get("coefficient"));
    if (get("coefficient") && coefficient == null) notes.push(labels.badCoefficient);
    const floor = num(get("floor"));

    rows.push({
      line,
      unit_code: code,
      building: get("building") || null,
      floor: floor == null ? null : Math.round(floor),
      unit_type: get("unit_type") || null,
      coefficient,
      ma_number: tail.maNumber,
      ma_start: tail.maStart,
      ma_end: tail.maEnd,
      owner_full_name: fullName || null,
      owner_email: email,
      owner_phone: tail.phone,

      unitStatus: skipReason
        ? "skipped"
        : existing.unitCodes.has(code)
          ? "update_unit"
          : "new_unit",
      ownerStatus: skipReason ? "no_owner" : ownerStatus,
      notes,
      skipReason,
    });
  }

  if (missing.length > 0) {
    malformed.unshift({
      line: 1,
      reason: `${labels.missingColumns}: ${missing.join(", ")}`,
      raw: header.join(","),
    });
  }

  const multiUnitOwners = [...emailCounts.values()].filter((n) => n > 1).length;
  return {
    rows,
    malformed,
    totals: {
      unitsToCreate: rows.filter((r) => r.unitStatus === "new_unit").length,
      unitsToUpdate: rows.filter((r) => r.unitStatus === "update_unit").length,
      ownersToInvite: newEmails.size,
      ownersExisting: new Set(
        rows.filter((r) => r.ownerStatus === "existing_owner").map((r) => r.owner_email),
      ).size,
      skipped: rows.filter((r) => r.unitStatus === "skipped").length + malformed.length,
      multiUnitOwners,
    },
  };
}

export type Labels = {
  emptyFile: string;
  missingColumns: string;
  noUnitCode: string;
  duplicateInFile: string;
  noEmail: string;
  badEmail: string;
  noName: string;
  badCoefficient: string;
  extraEmails: string;

};

export const SAMPLE_CSV = [
  IMPORT_COLUMNS.join(","),
  "A102,A,2,1 BR,1.03,Yessen Musrepov,yessen@example.com,+7 700 000 00 00,,MA-A102,23.03.2026,2026-04-01,2031-03-31,signed,yes,archive",
  "B305,B,3,2 BR,1.75,Anna Petrova,anna@example.com,,Petrova Holding,MA-B305,11.11.2025,2025-12-01,2030-11-30,signed,no,archive",
].join("\n");
