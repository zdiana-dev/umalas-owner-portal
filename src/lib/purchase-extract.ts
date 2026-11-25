/**
 * Pure parsers that pull purchase facts (price, currency, VAT rate, date) out of
 * contract text extracted from a PDF. Kept separate from the server function so
 * they can be reasoned about and tested on their own.
 */

export type PurchaseFacts = {
  price: number | null;
  currency: string | null;
  vatRate: number | null;
  /** ISO yyyy-mm-dd */
  date: string | null;
};

const PRICE_LABELS = [
  "total purchase price",
  "total price",
  "purchase price",
  "sale price",
  "selling price",
  "price of the unit",
  "harga jual",
  "harga",
  "цена покупки",
  "стоимость юнита",
  "стоимость",
  "цена",
];

const MONTHS: Record<string, number> = {
  january: 1, februari: 2, february: 2, march: 3, maret: 3, april: 4, may: 5, mei: 5,
  june: 6, juni: 6, july: 7, juli: 7, august: 8, agustus: 8, september: 9,
  october: 10, oktober: 10, november: 11, december: 12, desember: 12, januari: 1,
  январь: 1, января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6, июля: 7,
  августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

function flatten(text: string) {
  return text.replace(/\s+/g, " ");
}

/** Turns "1.595.000.000", "1,595,000,000" or "1 595 000 000" into a number. */
function toAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  // Drop a decimal tail like ",00" / ".00" before stripping separators.
  const withoutCents = trimmed.replace(/[.,]\d{2}$/, (m) =>
    /^[.,]\d{2}$/.test(m) && trimmed.replace(/[^\d]/g, "").length > 5 ? "" : m,
  );
  const digits = withoutCents.replace(/[^\d]/g, "");
  if (digits.length < 4) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Largest labelled amount in the text — contracts repeat the price in figures and words. */
export function parsePrice(text: string): { price: number | null; currency: string | null } {
  const flat = flatten(text);
  const lower = flat.toLowerCase();
  let best: number | null = null;
  let currency: string | null = null;

  for (const label of PRICE_LABELS) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(label, from);
      if (at === -1) break;
      from = at + label.length;
      const window = flat.slice(from, from + 120);
      const match = window.match(/(IDR|USD|EUR|Rp\.?|\$|€)?\s*([\d][\d.,\s]{3,}\d)/i);
      if (!match) continue;
      const amount = toAmount(match[2] ?? "");
      if (amount == null) continue;
      if (best == null || amount > best) {
        best = amount;
        const sign = (match[1] ?? "").toLowerCase();
        currency = sign.startsWith("rp") || sign === "idr"
          ? "IDR"
          : sign === "$" || sign === "usd"
            ? "USD"
            : sign === "€" || sign === "eur"
              ? "EUR"
              : currency;
      }
    }
  }

  if (best == null) {
    // No label matched: fall back to the largest Rupiah-tagged figure in the document.
    const rupiah = [...flat.matchAll(/(?:IDR|Rp\.?)\s*([\d][\d.,\s]{6,}\d)/gi)];
    for (const m of rupiah) {
      const amount = toAmount(m[1] ?? "");
      if (amount != null && (best == null || amount > best)) {
        best = amount;
        currency = "IDR";
      }
    }
  }

  return { price: best, currency };
}

/** VAT / PPN / НДС percentage stated in the contract. */
export function parseVatRate(text: string): number | null {
  const flat = flatten(text);
  const match = flat.match(
    /(?:VAT|PPN|НДС)[^%\d]{0,20}(\d{1,2}(?:[.,]\d{1,2})?)\s*%|(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:VAT|PPN|НДС)/i,
  );
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 30 ? value : null;
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Contract / purchase date, preferring an explicitly labelled one. */
export function parsePurchaseDate(text: string): string | null {
  const flat = flatten(text);
  const labelled = flat.match(
    /(?:purchase date|date of purchase|tanggal|dated|дата покупки|дата договора)[^\d]{0,20}([^,;\n]{6,30})/i,
  );
  const candidates = labelled?.[1] ? [labelled[1], flat] : [flat];

  for (const scope of candidates) {
    const named = scope.match(
      /(\d{1,2})[\s.]+([A-Za-zА-Яа-я]{3,12})[\s.,]+(\d{4})/,
    );
    if (named) {
      const month = MONTHS[(named[2] ?? "").toLowerCase()];
      if (month) {
        const value = iso(Number(named[3]), month, Number(named[1]));
        if (value) return value;
      }
    }
    const numeric = scope.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (numeric) {
      const value = iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
      if (value) return value;
    }
    const isoLike = scope.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoLike) {
      const value = iso(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
      if (value) return value;
    }
  }
  return null;
}

export function parsePurchaseFacts(text: string): PurchaseFacts {
  const { price, currency } = parsePrice(text);
  return {
    price,
    currency,
    vatRate: parseVatRate(text),
    date: parsePurchaseDate(text),
  };
}
