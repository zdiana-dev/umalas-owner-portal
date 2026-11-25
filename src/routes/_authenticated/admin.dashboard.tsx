import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { dashboardStats } from "@/lib/admin.functions";
import { SectionTitle, SkeletonLines, Stat } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t, lang } = useI18n();
  const fetchStats = useServerFn(dashboardStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchStats(),
  });

  if (error) {
    return <p className="text-sm text-rose">{error instanceof Error ? error.message : t("common.error")}</p>;
  }
  if (isLoading || !data) {
    return <SkeletonLines rows={8} />;
  }


  const moment = (value: string) =>
    new Date(value).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <SectionTitle>{t("dash.title")}</SectionTitle>
        <p className="text-xs leading-5 text-muted-foreground">{t("dash.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("dash.ownersTotal")} value={String(data.owners.total)} />
        <Stat label={t("dash.signedIn30")} value={String(data.owners.signedIn30)} />
        <Stat label={t("dash.signedInEver")} value={String(data.owners.signedInEver)} />
        <Stat label={t("dash.never")} value={String(data.owners.never)} />
      </div>
      <p className="eyebrow text-muted-foreground">
        {t("dash.unitsTotal")}: {data.unitsTotal} · {t("dash.withoutUnits")}: {data.owners.withoutUnits}
      </p>

      <section className="space-y-5">
        <SectionTitle>{t("dash.payoutUnits")}</SectionTitle>
        {data.payoutUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dash.noPayouts")}</p>
        ) : (
          <ul className="border-t border-hairline">
            {data.payoutUnits.map((unit) => (
              <li
                key={unit.code}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-4 text-sm"
              >
                <span className="figure">{unit.code}</span>
                <span className="text-xs text-muted-foreground">
                  {unit.reports} {t("dash.reports")} · {unit.paid}/{unit.reports} {t("dash.paid")}
                  {unit.lastPeriod ? ` · ${unit.lastPeriod}` : ""}
                </span>
                <span className="figure">{formatMoney(unit.total, unit.currency, lang)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-5">
        <SectionTitle>{t("dash.whoActive")}</SectionTitle>
        {data.active.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dash.noActivity")}</p>
        ) : (
          <ul className="border-t border-hairline">
            {data.active.map((person) => (
              <li
                key={person.user_id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-4 text-sm"
              >
                <div className="min-w-0">
                  <p>{person.name || person.email}</p>
                  <p className="eyebrow mt-1 text-muted-foreground">
                    {[person.email, person.units.join(", ")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {person.logins} {t("dash.logins")} · {person.views} {t("dash.views")} · {person.downloads}{" "}
                  {t("dash.downloads")}
                </span>
                <span className="figure text-xs whitespace-nowrap text-muted-foreground">
                  {moment(person.last)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
