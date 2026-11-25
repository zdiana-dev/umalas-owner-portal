import type { TranslationKey } from "./i18n";

type UnitLike = {
  unit_type?: string | null;
  building?: string | null;
  floor?: number | string | null;
};

/** Quiet one-liner under a unit code, e.g. «1 BR · Блок C, этаж 4». */
export function unitCaption(unit: UnitLike, t: (key: TranslationKey) => string): string {
  const parts: string[] = [];
  if (unit.unit_type) parts.push(unit.unit_type);
  const place: string[] = [];
  if (unit.building) place.push(`${t("unit.building")} ${unit.building}`);
  if (unit.floor != null && unit.floor !== "")
    place.push(`${t("unit.floor").toLowerCase()} ${unit.floor}`);
  if (place.length) parts.push(place.join(", "));
  return parts.join(" · ");
}
