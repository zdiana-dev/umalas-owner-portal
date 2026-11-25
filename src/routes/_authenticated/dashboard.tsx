import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CalendarDays, FileText, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { requestMyPasswordReset } from "@/lib/account.functions";
import { formatDate, formatMoney } from "@/lib/format";
import { documentsQuery, profileQuery, projectsQuery, reportsQuery } from "@/lib/portal-queries";
import { useOwnerUnits } from "@/lib/selected-unit";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { NoUnits } from "@/components/portal/NoUnits";
import { PaidBadge } from "@/components/portal/PaidBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Owner dashboard | The Umalas Signature" },
      { name: "description", content: "Your properties, upcoming payments, documents and account access." },
      { property: "og:title", content: "Owner dashboard | The Umalas Signature" },
      { property: "og:description", content: "Your private owner overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { t, lang } = useI18n();
  const { units, select, isLoading } = useOwnerUnits();
  const profile = useQuery(profileQuery());
  const reports = useQuery(reportsQuery());
  const documents = useQuery(documentsQuery());
  const projects = useQuery(projectsQuery());
  const [sending, setSending] = useState(false);
  const sendPasswordLink = useServerFn(requestMyPasswordReset);

  if (isLoading) return <SkeletonLines rows={7} />;
  if (units.length === 0) return <NoUnits />;

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const upcoming = (reports.data ?? [])
    .filter((report) => report.report_type === "roi" && report.is_published && !report.is_paid && !report.paid_at)
    .sort((a, b) => (a.due_date ?? a.period_start ?? "9999").localeCompare(b.due_date ?? b.period_start ?? "9999"));
  const paidRoi = (reports.data ?? [])
    .filter((report) => report.report_type === "roi" && report.is_published && (report.is_paid || report.paid_at))
    .sort((a, b) => (b.paid_at ?? b.period_end ?? "").localeCompare(a.paid_at ?? a.period_end ?? ""));
  const totals = new Map<string, number>();
  for (const report of upcoming) {
    if (report.net_payout == null) continue;
    totals.set(report.currency, (totals.get(report.currency) ?? 0) + Number(report.net_payout));
  }
  const recentDocuments = (documents.data ?? []).slice(0, 5);
  const firstName = profile.data?.full_name.trim().split(/\s+/)[0] ?? "";

  // One cabinet can hold villas from several developments, so units are grouped by project.
  const projectList = projects.data ?? [];
  const sortedUnits = [...units].sort((a, b) => a.code.localeCompare(b.code));
  const unitGroups = [
    ...projectList.map((project) => ({
      key: project.id,
      project,
      units: sortedUnits.filter((unit) => unit.project_id === project.id),
    })),
    {
      key: "none",
      project: null,
      units: sortedUnits.filter((unit) => !projectList.some((p) => p.id === unit.project_id)),
    },
  ].filter((group) => group.units.length > 0);

  async function requestPasswordLink() {
    if (!profile.data?.email) return;
    setSending(true);
    try {
      await sendPasswordLink({ data: { redirectTo: `${window.location.origin}/reset-password` } });
      toast.success(t("ownerDash.resetSent"));
    } catch {
      toast.error(t("ownerDash.resetError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="anim-rise mx-auto w-full max-w-[1100px] space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-violet">{t("ownerDash.welcome")}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="type-display mt-3">{t("ownerDash.title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("ownerDash.overview")}</p>
        </div>
        <Button asChild className="rounded-sm uppercase tracking-[0.12em] sm:mb-1">
          <Link to="/assistant">
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("ownerDash.askQuestion")}
          </Link>
        </Button>
      </header>

      <section>
        <SectionTitle note={`${t("portfolio.count")} ${units.length}`}>{t("ownerDash.units")}</SectionTitle>
        <div className="space-y-8">
          {unitGroups.map((group) => (
            <div key={group.key}>
              {unitGroups.length > 1 || group.project ? (
                <div className="mt-6 flex items-center gap-3 border-b border-hairline pb-3">
                  {group.project?.logo_url ? (
                    <img src={group.project.logo_url} alt="" className="h-6 w-auto" />
                  ) : null}
                  <p className="eyebrow">{group.project?.name ?? t("ownerDash.otherProject")}</p>
                  <span className="text-xs text-muted-foreground">{group.units.length}</span>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.units.map((unit) => (
                  <Link
                    key={unit.id}
                    to="/unit"
                    onClick={() => select(unit.id)}
                    className="surface-card surface-card-hover block rounded-sm border border-hairline px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                  >
                    <p className="font-display text-2xl">{unit.code}</p>
                    <p className="eyebrow mt-3 text-violet">{t("ownerDash.viewUnit")} →</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-violet" aria-hidden />
            <SectionTitle>{t("ownerDash.upcoming")}</SectionTitle>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("ownerDash.upcomingHint")}</p>
          {upcoming.length === 0 ? (
            <p className="mt-6 border-t border-hairline py-5 text-sm text-muted-foreground">{t("ownerDash.noUpcoming")}</p>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-hairline py-4">
                {[...totals].map(([currency, amount]) => (
                  <p key={currency} className="figure text-lg">{formatMoney(amount, currency, lang)}</p>
                ))}
              </div>
              <ul>
                {upcoming.slice(0, 4).map((report) => (
                  <li key={report.id} className="flex items-baseline justify-between gap-4 border-b border-hairline py-4">
                    <div>
                      <p className="text-sm">{unitById.get(report.unit_id)?.code ?? "—"} · {report.period_label}</p>
                      <p className="eyebrow mt-1">{t("ownerDash.due")}: {report.due_date ? formatDate(report.due_date, lang) : t("ownerDash.dateUnset")}</p>
                    </div>
                    {report.net_payout != null ? <p className="shrink-0 text-sm tabular-nums">{formatMoney(Number(report.net_payout), report.currency, lang)}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link to="/reports" className="eyebrow mt-5 inline-flex text-violet hover:underline">{t("ownerDash.viewReports")} →</Link>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-violet" aria-hidden />
            <SectionTitle>{t("ownerDash.documents")}</SectionTitle>
          </div>
          {recentDocuments.length === 0 ? (
            <p className="mt-6 border-t border-hairline py-5 text-sm text-muted-foreground">{t("ownerDash.noDocuments")}</p>
          ) : (
            <ul className="mt-4">
              {recentDocuments.map((document) => (
                <li key={document.id} className="border-b border-hairline py-4">
                  <p className="text-sm">{document.title}</p>
                  <p className="eyebrow mt-1">{document.unit_id ? unitById.get(document.unit_id)?.code ?? "—" : t("scope.all")}{document.issued_date ? ` · ${formatDate(document.issued_date, lang)}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/documents" className="eyebrow mt-5 inline-flex text-violet hover:underline">{t("ownerDash.viewDocuments")} →</Link>
        </section>
      </div>

      <section>
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-positive" aria-hidden />
          <SectionTitle note={`${paidRoi.length}`}>{t("ownerDash.paidRoi")}</SectionTitle>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("ownerDash.paidRoiHint")}</p>
        {paidRoi.length === 0 ? (
          <p className="mt-6 border-t border-hairline py-5 text-sm text-muted-foreground">{t("ownerDash.noPaidRoi")}</p>
        ) : (
          <ul className="mt-5 border-t border-hairline">
            {paidRoi.map((report) => (
              <li
                key={report.id}
                className="relative grid gap-3 border-b border-hairline bg-positive/10 px-5 py-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-positive sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="text-sm">{unitById.get(report.unit_id)?.code ?? "—"} · {report.period_label}</p>
                  <p className="eyebrow mt-1">
                    {t("ownerDash.paidOn")}: {report.paid_at ? formatDate(report.paid_at, lang) : t("ownerDash.dateUnset")}
                  </p>
                </div>
                {report.net_payout != null ? (
                  <p className="figure text-sm">{formatMoney(Number(report.net_payout), report.currency, lang)}</p>
                ) : null}
                <PaidBadge paid paidAt={report.paid_at} />
              </li>
            ))}
          </ul>
        )}
        <Link to="/reports" className="eyebrow mt-5 inline-flex text-violet hover:underline">{t("ownerDash.viewReports")} →</Link>
      </section>

      <section className="border-t border-hairline pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-xl gap-4">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-violet" aria-hidden />
            <div>
              <h2 className="font-display text-xl">{t("ownerDash.access")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("ownerDash.accessHint")}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void requestPasswordLink()} disabled={sending || !profile.data?.email} className="rounded-sm uppercase tracking-[0.12em]">
            {t("ownerDash.sendReset")}
          </Button>
        </div>
      </section>
    </div>
  );
}