import type { DocCategory } from "@/lib/portal-queries";

export const ACCEPTED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"] as const;

/** Leading type token of the archive filenames: "MA A102 ...", "BAST A102-...". */
const FILENAME_CATEGORY: Record<string, DocCategory> = {
  ma: "management_agreement",
  bast: "bast",
  mou: "mou",
  cla: "mou",
  ila: "mou",
  la: "lease_agreement",
  lease: "lease_agreement",
  addendum: "addendum",
  resale: "resale_agreement",
  bf: "booking_form",
  booking: "booking_form",
  invoice: "payment_details",
  inv: "payment_details",
  payment: "payment_details",
  pd: "payment_details",
  receipt: "payment_details",
  kvitanciya: "payment_details",
  квитанция: "payment_details",
};

export type ExclusionReason = "личный документ" | "банковские реквизиты" | "служебное письмо" | "не подписан";

const EXCLUSIONS: { reason: ExclusionReason; needles: string[] }[] = [
  { reason: "личный документ", needles: ["passport", "паспорт", "ktp", "visa", "kitas"] },
  { reason: "банковские реквизиты", needles: ["payment details", "bank", "реквизит"] },
  { reason: "служебное письмо", needles: ["warning letter", "revocation"] },
  {
    reason: "не подписан",
    needles: ["draft", "черновик", "for esign", "for e-sign", "void", "cancelled"],
  },
];

export function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1]!.toLowerCase() : "";
}

export function isAccepted(name: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export function detectExclusion(relativePath: string): ExclusionReason | null {
  const haystack = relativePath.toLowerCase();
  for (const rule of EXCLUSIONS) {
    if (rule.needles.some((needle) => haystack.includes(needle))) return rule.reason;
  }
  return null;
}

export function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

export function detectCategory(name: string): DocCategory | null {
  const token = titleFromName(name).split(/[\s_\-.]+/)[0]?.toLowerCase() ?? "";
  return FILENAME_CATEGORY[token] ?? null;
}

export type UnitMatch =
  | { kind: "matched"; code: string }
  | { kind: "ambiguous"; codes: string[] }
  | { kind: "none" };

function codesIn(segment: string, codes: string[]): string[] {
  const hay = segment.toUpperCase();
  const found: string[] = [];
  for (const code of codes) {
    const upper = code.toUpperCase();
    const index = hay.indexOf(upper);
    if (index === -1) continue;
    // reject matches glued to another alphanumeric on the left (e.g. "XD108")
    const before = hay[index - 1];
    if (before && /[A-Z0-9]/.test(before)) continue;
    found.push(code);
  }
  return found;
}

/**
 * Match a relative path against real unit codes. Folder names are searched before
 * the filename, and the longest code always wins ("D108B" over "D108").
 */
export function matchUnit(relativePath: string, unitCodes: string[]): UnitMatch {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.length > 0 ? parts[parts.length - 1]! : relativePath;
  const folders = parts.slice(0, -1);
  const sorted = [...unitCodes].sort((a, b) => b.length - a.length);

  for (const scope of [folders.join("/"), fileName]) {
    if (!scope) continue;
    const found = codesIn(scope, sorted);
    if (found.length === 0) continue;
    // keep only codes that are not a shorter substring of a longer found code
    const distinct = found.filter(
      (code) => !found.some((other) => other !== code && other.toUpperCase().includes(code.toUpperCase())),
    );
    if (distinct.length === 1) return { kind: "matched", code: distinct[0]! };
    return { kind: "ambiguous", codes: distinct };
  }
  return { kind: "none" };
}
