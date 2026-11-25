import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight } from "lucide-react";

import { getMandiriRates } from "@/lib/fx.functions";
import {
  convertCurrencyPair,
  FX_CURRENCIES,
  getEffectiveRate,
} from "@/lib/mandiri-rates";
import { useI18n } from "@/lib/i18n";
import { SectionTitle } from "@/components/portal/Figures";

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm tabular-nums outline-none focus:border-violet";

function formatNumber(value: number, lang: string, decimals = 2) {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCurrency(value: number, lang: string, code: string) {
  const decimals = code === "IDR" || code === "RUB" ? 0 : 2;
  return `${formatNumber(value, lang, decimals)} ${code}`;
}

export function CurrencyConverter() {
  const { t, lang } = useI18n();
  const fetchRates = useServerFn(getMandiriRates);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mandiri-rates"],
    queryFn: () => fetchRates(),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const allRates = data?.rates ?? {};

  const currencies = useMemo(() => {
    const available = data ? [...Object.keys(data.rates).filter((c) => c !== "IDR"), "IDR"] : [];
    const preferred = FX_CURRENCIES.filter((code) => available.includes(code));
    const rest = available.filter((code) => !preferred.includes(code as never)).sort();
    return [...preferred, ...rest];
  }, [data]);

  const [fromCurrency, setFromCurrency] = useState("IDR");
  const [toCurrency, setToCurrency] = useState("USD");
  const [amount, setAmount] = useState("100000000");

  const numericAmount = Number(amount.replace(/\s/g, "").replace(",", "."));
  const result = convertCurrencyPair(numericAmount, fromCurrency, toCurrency, allRates);

  const fromRate = getEffectiveRate(allRates, fromCurrency);
  const toRate = getEffectiveRate(allRates, toCurrency);
  const crossRate =
    fromRate && toRate && Number.isFinite(toRate.sell) && toRate.sell !== 0
      ? fromRate.buy / toRate.sell
      : null;

  function swap() {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  return (
    <div className="space-y-6 border-t border-hairline pt-10">
      <SectionTitle>{t("fx.title")}</SectionTitle>

      <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
        {t("fx.subtitle")}
      </p>

      {isError || (data && Object.keys(data.rates).length === 0) ? (
        <p className="text-sm text-rose">{t("fx.error")}</p>

      ) : isLoading ? (
        <div className="h-24 w-full animate-pulse bg-muted/50" />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr]">
            <label className="block">
              <span className="eyebrow">{t("fx.from")}</span>
              <div className="mt-2 flex gap-3">
                <input
                  className={`${field} flex-1`}
                  value={amount}
                  inputMode="decimal"
                  maxLength={18}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d.,\s]/g, ""))}
                />
                <select
                  className={`${field} w-24`}
                  value={fromCurrency}
                  onChange={(event) => setFromCurrency(event.target.value)}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="flex items-end justify-center sm:pb-2">
              <button
                type="button"
                onClick={swap}
                className="flex size-10 items-center justify-center rounded-full border border-hairline text-violet transition-colors hover:border-violet hover:bg-violet/5"
                aria-label={t("fx.direction")}
              >
                <ArrowLeftRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <label className="block">
              <span className="eyebrow">{t("fx.to")}</span>
              <select
                className={field}
                value={toCurrency}
                onChange={(event) => setToCurrency(event.target.value)}
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="surface-dark px-6 py-6 sm:px-8">
            <span className="eyebrow text-cream/60">{t("fx.result")}</span>
            <p className="mt-2 font-display text-2xl tabular-nums text-cream sm:text-3xl">
              {result === null ? "—" : formatCurrency(result, lang, toCurrency)}
            </p>
            {crossRate ? (
              <p className="mt-3 text-[11px] tracking-[0.08em] text-cream/60 uppercase">
                {t("fx.rateUsed")}: 1 {fromCurrency} ={" "}
                {formatNumber(crossRate, lang, fromCurrency === "IDR" || toCurrency === "IDR" ? 2 : 4)} {toCurrency}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 text-[11px] tracking-[0.08em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="uppercase">{t("fx.source")}</span>
              <a
                href="https://www.bankmandiri.co.id/en/kurs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet underline-offset-2 hover:underline"
              >
                {t("fx.sourceMandiri")}
              </a>
              <span className="text-hairline">·</span>
              <a
                href="https://www.cbr.ru/scripts/XML_daily.asp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet underline-offset-2 hover:underline"
              >
                {t("fx.sourceCbr")}
              </a>
            </div>
            {data?.updatedAt ? (
              <span className="uppercase tabular-nums">
                {t("fx.lastUpdated")}: {data.updatedAt}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
