import { createServerFn } from "@tanstack/react-start";

import { injectRubRate, parseCbrUsdRub, parseMandiriTtCounter, type MandiriRates } from "./mandiri-rates";

export type { MandiriRates } from "./mandiri-rates";

/**
 * Bank Mandiri publishes its counter rates as server-rendered HTML; there is no
 * public JSON endpoint. Fetched server-side so the browser never hits a
 * cross-origin page, and cached briefly since the TT counter moves a few times
 * a day at most.
 *
 * RUB is not listed by Mandiri, so we cross-rate it via USD using the Central
 * Bank of Russia's official daily rate.
 */
export const getMandiriRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<MandiriRates> => {
    // Both sources are third-party sites: a network failure must degrade to
    // "rates unavailable" in the UI, never crash the page.
    const load = async (url: string, accept: string): Promise<string | null> => {
      try {
        const response = await fetch(url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            accept,
          },
        });
        if (!response.ok) return null;
        return await response.text();
      } catch {
        return null;
      }
    };

    const [mandiriHtml, cbrXml] = await Promise.all([
      load("https://www.bankmandiri.co.id/en/kurs", "text/html"),
      load("https://www.cbr.ru/scripts/XML_daily.asp", "application/xml"),
    ]);

    if (!mandiriHtml) return { updatedAt: null, rates: {} };

    const rates = parseMandiriTtCounter(mandiriHtml);
    if (cbrXml) injectRubRate(rates, parseCbrUsdRub(cbrXml));

    return rates;
  },
);

