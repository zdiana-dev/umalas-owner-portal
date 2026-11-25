import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { REPORT_TYPES, reportsQuery, type ReportRow, type ReportType } from "@/lib/portal-queries";
import { getReportUrl, getReportReceiptUrl } from "@/lib/files.functions";
import { logActivity } from "@/lib/activity";
import { stampPaidPdf } from "@/lib/pdf-stamp";
import { useOwnerUnits, useUnitScope } from "@/lib/selected-unit";
import { SkeletonLines } from "@/components/portal/Figures";
import { NoUnits } from "@/components/portal/NoUnits";
import { EmptyState, staggerDelay } from "@/components/portal/EmptyState";
import { UnitHero } from "@/components/portal/UnitHero";
import { FilterTabs } from "@/components/portal/FilterTabs";
import { ScopeTabs } from "@/components/portal/ScopeTabs";
import { PaidBadge } from "@/components/portal/PaidBadge";
import { DocPreview } from "@/components/portal/DocPreview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Quarterly ROI and IPL reports for your units at The Umalas Signature, published by the management team.",
      },
      { property: "og:title", content: "Reports — Owner Portal | The Umalas Signature" },
      { property: "og:description", content: "Quarterly ROI and IPL reports for your units." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const ACCENT: Record<ReportType, string> = {
  roi: "var(--violet-600)",
  ipl: "var(--teal-600)",
  other: "var(--gold-600)",
};

type PaymentFilter = "all" | "paid" | "unpaid" | "no_roi";

function ReportsPage() {
  const { t, lang } = useI18n();
  const { units, selected, select, isLoading, isMulti } = useOwnerUnits();
  const { scope, setScope, crossUnit } = useUnitScope(units, isMulti);
  const scopeUnitId = crossUnit ? undefined : isMulti ? scope : selected?.id;
  const reports = useQuery(reportsQuery(scopeUnitId));
  const fetchUrl = useServerFn(getReportUrl);
  const fetchReceiptUrl = useServerFn(getReportReceiptUrl);
  const [filter, setFilter] = useState<ReportType | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");

  function journal(action: "view" | "download", entityType: "report" | "receipt", report: ReportRow) {
    void logActivity({
      action,
      entityType,
      entityId: report.id,
      title: report.period_label,
      unitCode: units.find((u) => u.id === report.unit_id)?.code ?? null,
    });
  }

  async function download(report: ReportRow) {
    try {
      const { url } = await fetchUrl({ data: { id: report.id } });
      journal("download", "report", report);

      if (report.report_type === "roi" && report.is_paid) {
        const tab = window.open("", "_blank");
        if (!tab) {
          toast.error(t("doc.unavailable"));
          return;
        }
        const stamped = await stampPaidPdf(
          url,
          t("rep.paidStamp"),
          report.paid_at,
          "en",
        );
        const blobUrl = URL.createObjectURL(stamped);
        tab.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }

  async function openReceipt(report: ReportRow) {
    try {
      const { url } = await fetchReceiptUrl({ data: { id: report.id } });
      journal("view", "receipt", report);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }

  /** Signed URL for the in-app viewer (statement). */
  async function resolveUrl(report: ReportRow) {
    const { url } = await fetchUrl({ data: { id: report.id } });
    journal("view", "report", report);
    return url;
  }

  /** Signed URL for the in-app viewer (payment receipt). */
  async function resolveReceiptUrl(report: ReportRow) {
    const { url } = await fetchReceiptUrl({ data: { id: report.id } });
    journal("view", "receipt", report);
    return url;
  }



  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <SkeletonLines rows={5} />
      </div>
    );
  if (!selected) return <NoUnits />;

  const codeOf = (unitId: string) => units.find((u) => u.id === unitId)?.code ?? "—";
  const all = reports.data ?? [];
  const rows = all.filter((r) => {
    const typeMatch = filter === "all" || r.report_type === filter;
    if (!typeMatch) return false;
    if (paymentFilter === "all") return true;
    if (r.report_type !== "roi") return false;
    if (paymentFilter === "no_roi") return r.no_roi_payment;
    return paymentFilter === "paid" ? r.is_paid : !r.is_paid && !r.no_roi_payment;
  });
  const tabs = [
    { value: "all" as const, label: t("rep.all"), count: all.length, alwaysEnabled: true },
    ...REPORT_TYPES.map((type) => ({
      value: type,
      label: t(`rep.${type}` as TranslationKey),
      count: all.filter((r) => r.report_type === type).length,
    })),
  ];
  const paymentTabs = [
    { value: "all" as PaymentFilter, label: t("rep.all"), count: all.length, alwaysEnabled: true },
    { value: "paid" as PaymentFilter, label: t("rep.filterPaid"), count: all.filter((r) => r.report_type === "roi" && r.is_paid).length },
    { value: "unpaid" as PaymentFilter, label: t("rep.filterUnpaid"), count: all.filter((r) => r.report_type === "roi" && !r.is_paid && !r.no_roi_payment).length },
    { value: "no_roi" as PaymentFilter, label: t("rep.noRoiPayment"), count: all.filter((r) => r.report_type === "roi" && r.no_roi_payment).length },
  ];

  // «Все объекты»: one heading per period, one row per unit under it.
  const periods = groupByPeriod(rows);

  return (
    <div className="anim-rise mx-auto w-full max-w-[1100px]">
      {isMulti ? (
        <Link
          to="/portfolio"
          className="eyebrow mb-6 inline-flex items-center gap-2 transition-colors duration-200 hover:text-violet"
        >
          <span aria-hidden>←</span>
          {t("portfolio.back")}
        </Link>
      ) : null}
      <UnitHero
        variant="band"
        title={t("rep.title")}
        unit={{ code: crossUnit ? t("scope.all") : codeOf(scopeUnitId ?? selected.id) }}
      />
      <div className="mt-6 flex justify-end">
        <Button asChild className="w-full rounded-sm uppercase tracking-[0.12em] sm:w-auto">
          <Link to="/assistant">{t("assistant.askButton")}</Link>
        </Button>
      </div>

      {isMulti ? (
        <div className="mt-10">
          <ScopeTabs
            units={units}
            scope={scope}
            onChange={(value) => {
              setScope(value);
              if (value !== "all") select(value);
            }}
            countFor={(unitId: string) => all.filter((r) => r.unit_id === unitId).length}
          />
        </div>
      ) : null}

      {reports.isLoading ? (
        <div className="mt-12">
          <SkeletonLines rows={6} />
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          title={t("rep.empty")}
          hint={
            crossUnit
              ? t("rep.emptyHint").replace("{code}", t("scope.all"))
              : t("rep.emptyHint").replace("{code}", selected.code)
          }
        />
      ) : (
        <div className="mt-12 space-y-8">
          <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
          <FilterTabs tabs={paymentTabs} value={paymentFilter} onChange={setPaymentFilter} />

          {rows.length === 0 ? (
            <EmptyState
              title={t("rep.emptyFilter")}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setPaymentFilter("all");
                  }}
                  className="text-[11px] tracking-[0.12em] text-violet uppercase underline underline-offset-4"
                >
                  {t("rep.showAll")}
                </button>
              }
            />
          ) : crossUnit ? (
            <div className="mt-12 space-y-14">
              {periods.map((period) => (
                <section key={period.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-3">
                    <p className="eyebrow">{period.label}</p>
                    {period.total > 0 ? (
                      <span className="figure text-xs text-muted-foreground">
                        {t("rep.periodTotal")} {formatMoney(period.total, period.currency, lang)}
                      </span>
                    ) : null}
                  </div>
                  <ul>
                    {period.items.map((report, index) => (
                      <ReportRowItem
                        key={report.id}
                        report={report}
                        code={codeOf(report.unit_id)}
                        index={index}
                        lang={lang}
                        onDownload={download}
                        onReceipt={openReceipt}
                        getUrl={resolveUrl}
                        getReceiptUrl={resolveReceiptUrl}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="mt-12">
              {rows.map((report, index) => (
                <ReportRowItem
                  key={report.id}
                  report={report}
                  index={index}
                  lang={lang}
                  onDownload={download}
                  onReceipt={openReceipt}
                  getUrl={resolveUrl}
                  getReceiptUrl={resolveReceiptUrl}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function groupByPeriod(rows: ReportRow[]) {
  const map = new Map<string, { key: string; label: string; items: ReportRow[] }>();
  for (const row of rows) {
    const key = `${row.period_start ?? ""}|${row.period_label}`;
    const group = map.get(key) ?? { key, label: row.period_label, items: [] };
    group.items.push(row);
    map.set(key, group);
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.unit_id.localeCompare(b.unit_id)),
      total: group.items.reduce(
        (sum, r) => sum + (r.is_published ? Number(r.net_payout ?? 0) : 0),
        0,
      ),
      currency: group.items[0]?.currency ?? "IDR",
    }));
}

function ReportRowItem({
  report,
  code,
  index,
  lang,
  onDownload,
  onReceipt,
  getUrl,
  getReceiptUrl,
}: {
  report: ReportRow;
  code?: string;
  index: number;
  lang: "ru" | "en";
  onDownload: (report: ReportRow) => void;
  onReceipt: (report: ReportRow) => void;
  getUrl: (report: ReportRow) => Promise<string>;
  getReceiptUrl: (report: ReportRow) => Promise<string>;
}) {
  const { t } = useI18n();
  return (
    <DocPreview
      id={report.id}
      title={[code, report.period_label].filter(Boolean).join(" · ")}
      subtitle={t(`rep.${report.report_type}` as TranslationKey)}
      fileName={report.file_path}
      getUrl={() => getUrl(report)}
      onDownload={() => onDownload(report)}
      stampPaid={report.report_type === "roi" && report.is_paid}
      paidAt={report.paid_at}
      as="li"
      className="row-brand anim-rise flex flex-wrap items-center justify-between gap-4 py-8 last:border-0"
      style={{
        ...staggerDelay(index),
        ["--row-accent" as string]: ACCENT[report.report_type],
      }}
    >
      {(openPreview) => (
        <>
          <div className="min-w-0">
            <button
              type="button"
              onClick={openPreview}
              className="cursor-zoom-in text-left text-[15px] leading-6 text-foreground transition-colors hover:text-violet"
            >
              {code ? <span className="figure mr-3 text-foreground">{code}</span> : null}
              {code ? (
                <span className="text-muted-foreground">{report.period_label}</span>
              ) : (
                report.period_label
              )}
            </button>
            <p className="eyebrow mt-1">{t(`rep.${report.report_type}` as TranslationKey)}</p>
            {report.payout_note ? (
              <p className="mt-2 max-w-prose whitespace-pre-line text-xs leading-5 text-muted-foreground">{report.payout_note}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {report.report_type === "roi" || report.net_payout != null ? (
              <PaidBadge paid={report.is_paid} paidAt={report.paid_at} noRoiPayment={report.no_roi_payment} />
            ) : null}
            {report.net_payout != null ? (
              <span className="figure text-sm whitespace-nowrap">
                {formatMoney(Number(report.net_payout), report.currency, lang)}
              </span>
            ) : null}
            {report.receipt_path ? (
              <DocPreview
                id={`${report.id}-receipt`}
                title={`${t("rep.receipt")} · ${report.period_label}`}
                fileName={report.receipt_path}
                getUrl={() => getReceiptUrl(report)}
                onDownload={() => onReceipt(report)}
              >
                {(openReceiptPreview) => (
                  <button
                    type="button"
                    onClick={openReceiptPreview}
                    className="text-[11px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep"
                  >
                    {t("rep.receipt")}
                  </button>
                )}
              </DocPreview>
            ) : null}
            <button
              type="button"
              onClick={openPreview}
              className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
            >
              {t("doc.preview")}
            </button>
            <button
              type="button"
              onClick={() => onDownload(report)}
              className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
            >
              {t("rep.download")}
            </button>
          </div>
        </>
      )}
    </DocPreview>
  );
}
