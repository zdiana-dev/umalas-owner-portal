import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/lib/i18n";
import { formatMoney, priceInclVat } from "@/lib/format";

import { documentsQuery, reportsQuery } from "@/lib/portal-queries";
import { unitCaption } from "@/lib/unit-display";
import { useOwnerUnits } from "@/lib/selected-unit";
import { CountUp, SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { NoUnits } from "@/components/portal/NoUnits";
import { staggerDelay } from "@/components/portal/EmptyState";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "My properties — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Your portfolio at The Umalas Signature: total received across all units, cumulative ROI and each unit at a glance.",
      },
      { property: "og:title", content: "My properties — Owner Portal | The Umalas Signature" },
      {
        property: "og:description",
        content: "Total received across your units and each property at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { units, isMulti, isLoading, select } = useOwnerUnits();
  const reports = useQuery(reportsQuery());
  const documents = useQuery(documentsQuery());

  // One unit (or admin): the portfolio screen must never exist for them.
  useEffect(() => {
    if (!isLoading && !isMulti) navigate({ to: "/unit", replace: true });
  }, [isLoading, isMulti, navigate]);

  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <SkeletonLines rows={6} />
      </div>
    );
  if (units.length === 0) return <NoUnits />;
  if (!isMulti) return null;

  const roiRows = (reports.data ?? []).filter(
    (r) => r.report_type === "roi" && r.is_published && r.net_payout != null,
  );
  const currency = roiRows[0]?.currency ?? "IDR";
  const total = roiRows.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0);

  /**
   * ROI is only meaningful when purchase prices are in the same currency as the
   * payouts — the portal never applies an invented exchange rate.
   */
  const sameCurrencyUnits = units.filter(
    (unit) => unit.purchase_price != null && unit.purchase_currency === currency,
  );
  const currencyMatches =
    sameCurrencyUnits.length > 0 &&
    units.every((unit) => unit.purchase_price == null || unit.purchase_currency === currency);
  const invested = currencyMatches
    ? sameCurrencyUnits.reduce(
        (sum, unit) =>
          sum +
          priceInclVat(
            Number(unit.purchase_price),
            unit.is_investment_contract === true,
            unit.vat_rate,
          ),
        0,
      )
    : 0;

  const roi = invested > 0 && roiRows.length > 0 ? (total / invested) * 100 : null;

  const cards = [...units]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((unit) => {
      const unitReports = (reports.data ?? []).filter((r) => r.unit_id === unit.id);
      const unitRoi = unitReports.filter(
        (r) => r.report_type === "roi" && r.is_published && r.net_payout != null,
      );
      return {
        unit,
        received: unitRoi.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0),
        currency: unitRoi[0]?.currency ?? currency,
        reports: unitReports.length,
        documents: (documents.data ?? []).filter((d) => d.unit_id === unit.id).length,
      };
    });

  return (
    <div className="anim-rise mx-auto w-full max-w-[1100px]">
      <SectionTitle note={`${t("portfolio.count")} ${units.length}`}>
        {t("portfolio.title")}
      </SectionTitle>

      <section className="surface-dark rounded-sm px-5 py-7 sm:px-8 sm:py-9">
        <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-end">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
              {t("portfolio.total")}
            </p>
            <p className="figure mt-4 flex flex-wrap items-baseline gap-x-3 text-[2.25rem] leading-none text-cream sm:text-[2.5rem]">
              <CountUp
                value={total}
                render={(n) =>
                  new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(Math.round(n))
                }
              />
              <span className="text-base font-light text-cream/60">{currency}</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-cream/55">
              {t("portfolio.summaryNote")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-gold/25 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
            {roi != null ? (
              <div>
                <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
                  {t("portfolio.roi")}
                </p>
                <p className="figure mt-3 text-xl leading-none text-cream">
                  <CountUp value={roi} render={(n) => `${n.toFixed(1)}%`} />
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
                {t("portfolio.count")}
              </p>
              <p className="figure mt-3 text-xl leading-none text-cream">{units.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2">
        {cards.map((card, index) => (
          <Link
            key={card.unit.id}
            to="/unit"
            onClick={() => select(card.unit.id)}
            className="surface-card surface-card-hover anim-rise block rounded-sm px-5 py-6 sm:px-6"
            style={staggerDelay(index)}
          >
            <p className="font-display text-2xl leading-none">{card.unit.code}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {unitCaption(card.unit, t)}
            </p>

            {card.reports === 0 && card.documents === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">{t("portfolio.preparing")}</p>
            ) : (
              <>
                {card.received > 0 ? (
                  <p className="figure mt-6 text-xl leading-none">
                    {formatMoney(card.received, card.currency, lang)}
                  </p>
                ) : (
                  <p className="mt-6 text-sm text-muted-foreground">{t("portfolio.noReports")}</p>
                )}
                <div className="mt-5 flex items-baseline gap-6 border-t border-hairline pt-4 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  <span>
                    {t("portfolio.docsCount")}{" "}
                    <span className="figure text-foreground">{card.documents}</span>
                  </span>
                  <span>
                    {t("portfolio.reportsCount")}{" "}
                    <span className="figure text-foreground">{card.reports}</span>
                  </span>
                </div>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
