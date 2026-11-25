export type MandiriRate = {
  /** IDR paid by the bank per 1 unit of foreign currency. */
  buy: number;
  /** IDR charged by the bank per 1 unit of foreign currency. */
  sell: number;
};

export type MandiriRates = {
  /** Timestamp string published next to the TT Counter column, e.g. "21/08/26 - 10:20 WIB". */
  updatedAt: string | null;
  rates: Record<string, MandiriRate>;
};

/** "20.370,00" -> 20370 */
function parseIdNumber(raw: string): number {
  return Number(raw.trim().replace(/\./g, "").replace(",", "."));
}

function stripTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
}

/**
 * The counter-rate table has one row per currency with six numeric cells:
 * Special buy/sell, TT Counter buy/sell, Bank Notes buy/sell. We take columns
 * 3 and 4 (TT Counter).
 */
export function parseMandiriTtCounter(html: string): MandiriRates {
  const rates: Record<string, MandiriRate> = {};

  const header = html.match(/TT\s*Counter<\/strong>\s*<br\s*\/?>\s*([^<]+)</i);
  const updatedAt = header?.[1] ? header[1].trim() : null;

  const rowPattern = /<tr>\s*<td[^>]*>\s*([A-Z]{3})\s*<\/td>((?:\s*<td[^>]*>[\s\S]*?<\/td>){6})/g;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(html)) !== null) {
    const code = row[1];
    const cellsRaw = row[2];
    if (!code || !cellsRaw) continue;
    const cells = [...cellsRaw.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
      parseIdNumber(stripTags(match[1] ?? "")),
    );
    const buy = cells[2];
    const sell = cells[3];
    if (!buy || !sell || !Number.isFinite(buy) || !Number.isFinite(sell)) continue;
    rates[code] = { buy, sell };
  }

  return { updatedAt, rates };
}

/** Parse CBR daily XML and return the official RUB per USD rate. */
export function parseCbrUsdRub(xml: string): number | null {
  const usdBlock = xml.match(
    /<Valute[^>]*>[\s\S]*?<CharCode>USD<\/CharCode>[\s\S]*?<\/Valute>/i,
  );
  if (!usdBlock) return null;
  const value = usdBlock[0].match(/<Value>([^<]+)<\/Value>/i);
  if (!value?.[1]) return null;
  const normalized = value[1].replace(/,/g, ".");
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Inject a synthetic RUB rate by crossing Mandiri USD/IDR with CBR USD/RUB. */
export function injectRubRate(rates: MandiriRates, usdRub: number | null): void {
  const usd = rates.rates["USD"];
  if (!usd || !usdRub) return;
  // 1 RUB = (IDR per USD) / (RUB per USD).
  rates.rates["RUB"] = {
    buy: usd.buy / usdRub,
    sell: usd.sell / usdRub,
  };
}

/** Currencies owners actually ask about, in display order. */
export const FX_CURRENCIES = ["USD", "EUR", "SGD", "AUD", "GBP", "RUB", "IDR"] as const;

export type FxDirection = "toIdr" | "fromIdr";

export function convertWithMandiri(
  amount: number,
  currency: string,
  direction: FxDirection,
  rate: MandiriRate,
): number {
  // Bank sells IDR-priced foreign currency at `sell`, buys it at `buy`.
  return direction === "toIdr" ? amount * rate.buy : amount / rate.sell;
}

export function getEffectiveRate(
  rates: Record<string, MandiriRate>,
  code: string,
): MandiriRate | null {
  if (code === "IDR") return { buy: 1, sell: 1 };
  return rates[code] ?? null;
}

/** Convert `amount` of `from` currency into `to` currency using TT counter rates. */
export function convertCurrencyPair(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, MandiriRate>,
): number | null {
  const fromRate = getEffectiveRate(rates, from);
  const toRate = getEffectiveRate(rates, to);
  if (!fromRate || !toRate) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  // Bank buys the source currency from the client, then sells the target currency to the client.
  const idrAmount = amount * fromRate.buy;
  return idrAmount / toRate.sell;
}
