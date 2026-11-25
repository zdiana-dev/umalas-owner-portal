import type { Lang } from "./i18n";

const locales: Record<Lang, string> = { ru: "ru-RU", en: "en-US" };

export function formatMoney(value: number, currency = "IDR", lang: Lang = "ru"): string {
  const amount = new Intl.NumberFormat(locales[lang], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `${amount} ${currency}`;
}

export function formatNumber(value: number, lang: Lang = "ru", digits = 1): string {
  return new Intl.NumberFormat(locales[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export const DEFAULT_VAT_RATE = 10;

/** VAT rate in percent for a unit; investment contracts carry none. */
export function vatRateOf(
  vatRate?: number | string | null,
  isInvestmentContract = false,
): number {
  if (isInvestmentContract) return 0;
  const value = vatRate != null ? Number(vatRate) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_VAT_RATE;
}

export function vatAmount(
  price: number,
  isInvestmentContract = false,
  vatRate?: number | string | null,
): number {
  return price * (vatRateOf(vatRate, isInvestmentContract) / 100);
}
export function priceInclVat(
  price: number,
  isInvestmentContract = false,
  vatRate?: number | string | null,
): number {
  return price + vatAmount(price, isInvestmentContract, vatRate);
}


export function formatPercent(value: number, lang: Lang = "ru", digits = 1): string {
  return `${formatNumber(value, lang, digits)} %`;
}

export function formatDate(value: string | null | undefined, lang: Lang = "ru"): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locales[lang], {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatMonth(value: string, lang: Lang = "ru"): string {
  return new Intl.DateTimeFormat(locales[lang], { year: "numeric", month: "long" }).format(
    new Date(value),
  );
}

export function formatMonthShort(value: string, lang: Lang = "ru"): string {
  return new Intl.DateTimeFormat(locales[lang], { year: "2-digit", month: "short" }).format(
    new Date(value),
  );
}

/** Compact axis/table label for a reporting period, e.g. "Q2 26" or "Apr 26". */
export function shortPeriodLabel(
  periodStart: string,
  periodType: string,
  lang: Lang = "ru",
): string {
  const date = new Date(periodStart);
  if (periodType === "quarter") {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${lang === "ru" ? "К" : "Q"}${quarter} ${year}`;
  }
  return formatMonthShort(periodStart, lang);
}

/** Days covered by a period, inclusive — used for annualising returns. */
export function periodDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}
