import { type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import {
  formatDate,
  formatMoney,
  priceInclVat,
  vatAmount,
  vatRateOf,
} from "@/lib/format";
import { CountUp, Fact } from "@/components/portal/Figures";
import { cn } from "@/lib/utils";

type UnitLike = {
  code: string;
  building?: string | null;
  floor?: string | number | null;
  unit_type?: string | null;
  purchase_price?: number | string | null;
  purchase_currency: string;
  purchase_date?: string | null;
  coefficient?: number | string | null;
  is_investment_contract?: boolean;
  vat_rate?: number | string | null;
};

export function Panel({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "surface-card surface-card-hover rounded-sm px-4 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      {title ? <p className="eyebrow mb-4 sm:mb-5">{title}</p> : null}
      {children}
    </section>
  );
}

export function KeyFigure({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className="figure mt-2 text-3xl leading-[1.05] break-words sm:text-4xl md:text-5xl">
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function UnitCard({
  unit,
  received,
  currency,
  hasSummary,
  footer,
}: {
  unit: UnitLike;
  received: number;
  currency: string;
  hasSummary: boolean;
  footer?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const price = unit.purchase_price != null ? Number(unit.purchase_price) : null;
  const isInvestmentContract = unit.is_investment_contract === true;
  const rate = vatRateOf(unit.vat_rate, isInvestmentContract);
  const rateLabel = Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
  const money = (v: number | null) =>
    v != null ? formatMoney(v, unit.purchase_currency, lang) : t("common.none");

  return (
    <div className="space-y-10 sm:space-y-16">
      {hasSummary && (
        <section className="surface-dark rounded-sm px-5 py-7 sm:px-8 sm:py-9">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
              {t("unit.received")}
            </p>
            <p className="figure mt-4 flex flex-wrap items-baseline gap-x-3 text-[2.25rem] leading-none text-cream sm:text-[2.5rem]">
              <CountUp
                value={received}
                render={(n) => new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(Math.round(n))}
              />
              <span className="text-base font-light text-cream/60">{currency}</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-cream/55">{t("unit.summaryNote")}</p>
          </div>
        </section>
      )}


      <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
        <Panel title={t("unit.sectionAbout")}>
          <div className="grid gap-y-0.5">
            <Fact label={t("unit.switch")} value={unit.code} />
            <Fact label={t("unit.type")} value={unit.unit_type ?? t("common.none")} />
            <Fact label={t("unit.building")} value={unit.building ?? t("common.none")} />
            <Fact label={t("unit.floor")} value={unit.floor ?? t("common.none")} />
            <Fact
              label={t("unit.coefficient")}
              value={
                unit.coefficient != null ? Number(unit.coefficient).toFixed(2) : t("common.none")
              }
            />
          </div>
        </Panel>

        <Panel title={t("unit.sectionPurchase")}>
          <div className="grid gap-y-0.5">
            <Fact label={t("unit.price")} value={money(price)} />
            {!isInvestmentContract && (
              <>
                <Fact
                  label={`${t("unit.vat")} (${rateLabel}%)`}
                  value={money(price != null ? vatAmount(price, false, unit.vat_rate) : null)}
                />
                <Fact
                  label={t("unit.priceTotal")}
                  value={money(price != null ? priceInclVat(price, false, unit.vat_rate) : null)}
                />
              </>
            )}
            {isInvestmentContract && (
              <Fact
                label={t("unit.contractType")}
                value={t("unit.investmentContract")}
              />
            )}
            <Fact label={t("unit.purchaseDate")} value={formatDate(unit.purchase_date, lang)} />
          </div>
        </Panel>
      </div>

      {footer}
    </div>
  );
}
