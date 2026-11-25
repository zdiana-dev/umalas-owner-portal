import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/lib/i18n";
import { reportsQuery } from "@/lib/portal-queries";
import { useOwnerUnits } from "@/lib/selected-unit";
import { SkeletonLines } from "@/components/portal/Figures";
import { UnitCard } from "@/components/portal/UnitCard";
import { NoUnits } from "@/components/portal/NoUnits";
import { UnitHero } from "@/components/portal/UnitHero";
import { PayoutCalendar } from "@/components/portal/PayoutCalendar";

export const Route = createFileRoute("/_authenticated/unit")({
  head: () => ({
    meta: [
      { title: "My unit — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Your unit at The Umalas Signature: key facts, total received to date and cumulative ROI from published reports.",
      },
      { property: "og:title", content: "My unit — Owner Portal | The Umalas Signature" },
      {
        property: "og:description",
        content: "Unit details and returns from published owner reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitPage,
});

function UnitPage() {
  const { t, lang } = useI18n();
  const search = Route.useSearch() as { unitId?: string };
  const { units, selected, select, isLoading, isMulti } = useOwnerUnits(search.unitId);
  const reports = useQuery(reportsQuery(selected?.id));

  if (isLoading)
    return (
      <div className="space-y-10">
        <SkeletonLines rows={5} />
      </div>
    );
  if (!selected) return <NoUnits />;

  const roiReports = (reports.data ?? []).filter(
    (r) => r.report_type === "roi" && r.is_published && r.net_payout != null,
  );
  const received = roiReports.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0);
  const currency = roiReports[0]?.currency ?? "IDR";
  const hasSummary = roiReports.length > 0;


  return (
    <div className="anim-rise space-y-10 sm:space-y-16">
      <div className="space-y-6">
        {isMulti ? (
          <Link
            to="/portfolio"
            className="eyebrow inline-flex items-center gap-2 transition-colors duration-200 hover:text-violet"
          >
            <span aria-hidden>←</span>
            {t("portfolio.back")}
          </Link>
        ) : null}
        <UnitHero
          unit={selected}
          units={isMulti ? units : undefined}
          onSelect={isMulti ? select : undefined}
        />
      </div>


      <UnitCard
        unit={selected}
        received={received}
        currency={currency}
        hasSummary={hasSummary}
        footer={
          <div className="pt-2">
            <span className="eyebrow">{t("brand.company")}</span>
          </div>
        }
      />

      <PayoutCalendar reports={reports.data ?? []} lang={lang} />
    </div>
  );
}

