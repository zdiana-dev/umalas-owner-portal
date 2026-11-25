import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { reportsQuery, type ReportRow } from "@/lib/portal-queries";
import { getReportUrl } from "@/lib/files.functions";
import { useOwnerUnits } from "@/lib/selected-unit";
import { SkeletonLines } from "@/components/portal/Figures";
import { NoUnits } from "@/components/portal/NoUnits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Payout calendar — Owner Portal | The Umalas Signature" },
      { name: "description", content: "Calendar of ROI payouts and IPL reports for all your units." },
      { property: "og:title", content: "Payout calendar — The Umalas Signature" },
      { property: "og:description", content: "ROI payouts and IPL reports by month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const copy = {
  ru: {
    title: "Календарь выплат",
    caption: "Все отчёты ROI и IPL по вашим объектам, по месяцам",
    upcoming: "Ожидается",
    received: "Получено",
    ipl: "Отчёт IPL",
    roi: "Выплата ROI",
    paid: "Получено",
    overdue: "Просрочено",
    pending: "Ожидается",
    due: "Срок",
    paidOn: "Выплачено",
    open: "Открыть",
    none: "Пока нет опубликованных отчётов",
    noDate: "Без даты",
  },
  en: {
    title: "Payout calendar",
    caption: "All ROI and IPL reports for your units, by month",
    upcoming: "Expected",
    received: "Received",
    ipl: "IPL report",
    roi: "ROI payout",
    paid: "Received",
    overdue: "Overdue",
    pending: "Expected",
    due: "Due",
    paidOn: "Paid",
    open: "Open",
    none: "No published reports yet",
    noDate: "No date",
  },
};

function keyDate(r: ReportRow) {
  return r.paid_at ?? r.due_date ?? r.period_end ?? r.period_start ?? null;
}

function CalendarPage() {
  const { lang } = useI18n();
  const c = copy[lang];
  const { units, isLoading } = useOwnerUnits();
  const reports = useQuery(reportsQuery());
  const fetchUrl = useServerFn(getReportUrl);

  const rows = useMemo(
    () =>
      (reports.data ?? []).filter(
        (r) => r.is_published && (r.report_type === "roi" || r.report_type === "ipl"),
      ),
    [reports.data],
  );

  const groups = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const d = keyDate(r);
      const k = d ? d.slice(0, 7) : "none";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { up: new Map<string, number>(), got: new Map<string, number>() };
    for (const r of rows) {
      if (r.report_type !== "roi" || r.net_payout == null) continue;
      const m = r.is_paid ? t.got : t.up;
      m.set(r.currency, (m.get(r.currency) ?? 0) + Number(r.net_payout));
    }
    return t;
  }, [rows]);

  const today = new Date().toISOString().slice(0, 10);
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? "";
  const monthLabel = (k: string) =>
    k === "none"
      ? c.noDate
      : new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", { month: "long", year: "numeric" }).format(
          new Date(`${k}-01T00:00:00`),
        );

  async function open(r: ReportRow) {
    try {
      const { url } = await fetchUrl({ data: { id: r.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (!isLoading && units.length === 0) return <NoUnits />;

  const fmtTotals = (m: Map<string, number>) =>
    m.size ? [...m].map(([cur, v]) => formatMoney(v, cur, lang)).join(" · ") : "—";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{c.caption}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-hairline p-5">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{c.upcoming}</p>
          <p className="mt-2 font-serif text-2xl">{fmtTotals(totals.up)}</p>
        </div>
        <div className="rounded-sm border border-hairline p-5">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{c.received}</p>
          <p className="mt-2 font-serif text-2xl">{fmtTotals(totals.got)}</p>
        </div>
      </div>

      {reports.isLoading ? (
        <SkeletonLines />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.none}</p>
      ) : (
        groups.map(([k, list]) => (
          <section key={k} className="space-y-3">
            <h2 className="text-xs tracking-[0.16em] text-muted-foreground uppercase first-letter:uppercase">
              {monthLabel(k)}
            </h2>
            <ul className="divide-y divide-hairline rounded-sm border border-hairline">
              {list.map((r) => {
                const isRoi = r.report_type === "roi";
                const status = !isRoi
                  ? null
                  : r.is_paid
                    ? c.paid
                    : r.due_date && r.due_date < today
                      ? c.overdue
                      : c.pending;
                const statusClass = r.is_paid
                  ? "text-teal-600"
                  : status === c.overdue
                    ? "text-destructive"
                    : "text-muted-foreground";
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: isRoi ? "var(--violet-600)" : "var(--teal-600)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {isRoi ? c.roi : c.ipl} · {unitCode(r.unit_id)} · {r.period_label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.paid_at
                          ? `${c.paidOn}: ${formatDate(r.paid_at, lang)}`
                          : r.due_date
                            ? `${c.due}: ${formatDate(r.due_date, lang)}`
                            : ""}
                        {status ? <span className={`ml-2 ${statusClass}`}>{status}</span> : null}
                      </p>
                    </div>
                    {r.net_payout != null ? (
                      <span className="font-serif text-lg">{formatMoney(Number(r.net_payout), r.currency, lang)}</span>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => open(r)}>
                      {c.open}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
