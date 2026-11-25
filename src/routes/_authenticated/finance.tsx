import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { financeWorkspaceQuery, staffContextQuery } from "@/lib/staff-queries";
import { completeQueuedPayout, syncPayoutCalendarNow } from "@/lib/staff.functions";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { PaidBadge } from "@/components/portal/PaidBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const QUARTERS = [
  { value: "2026-q2", label: "Apr–Jun 2026", from: "2026-04-01", to: "2026-06-30" },
  { value: "2026-q3", label: "Jul–Sep 2026", from: "2026-07-01", to: "2026-09-30" },
  { value: "2026-q4", label: "Oct–Dec 2026", from: "2026-10-01", to: "2026-12-31" },
  { value: "2026-sep-nov", label: "Sep–Nov 2026", from: "2026-09-01", to: "2026-11-30" },
];

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [
    { title: "Finance payouts — Owner Portal" },
    { name: "description", content: "Prioritised ROI payment plans and payout history for the finance team." },
    { property: "og:title", content: "Finance payouts — Owner Portal" },
    { property: "og:description", content: "Prioritised ROI payment plans and payout history for the finance team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FinancePage,
});

function FinancePage() {
  const { t, lang } = useI18n();
  const staff = useQuery(staffContextQuery());
  const allowed = staff.data?.roles.some((role) => role === "finance" || role === "admin") === true;
  const workspace = useQuery({ ...financeWorkspaceQuery(), enabled: allowed });
  const complete = useServerFn(completeQueuedPayout);
  const client = useQueryClient();
  const syncCal = useServerFn(syncPayoutCalendarNow);
  const [syncing, setSyncing] = useState(false);
  const [quarter, setQuarter] = useState("all");
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [paidDates, setPaidDates] = useState<Record<string, string>>({});
  if (staff.isLoading || workspace.isLoading) return <SkeletonLines rows={8} />;
  if (!allowed) return <p className="text-sm text-muted-foreground">{t("admin.noAccess")}</p>;
  const data = workspace.data;
  if (!data) return null;
  const unitById = new Map(data.units.map((u: any) => [u.id, u]));
  const projectById = new Map(data.projects.map((p: any) => [p.id, p]));
  const profileById = new Map(data.profiles.map((p: any) => [p.user_id, p]));
  const ownersByUnit = new Map<string, string[]>();
  for (const own of data.ownerships as any[]) {
    if (own.end_date) continue;
    const owner = profileById.get(own.owner_id) as any;
    if (!owner) continue;
    ownersByUnit.set(own.unit_id, [...(ownersByUnit.get(own.unit_id) ?? []), owner.full_name || owner.email]);
  }
  const reportById = new Map(data.reports.map((r: any) => [r.id, r]));
  const activePlans = (data.plans as any[]).filter((p) => p.status === "published");
  const queue = activePlans.flatMap((plan) => (data.items as any[]).filter((item) => item.plan_id === plan.id).map((item) => ({ plan, item, report: reportById.get(item.report_id) as any }))).filter((row) => row.report);
  const active = QUARTERS.find((q) => q.value === quarter);
  const rows = (data.reports as any[])
    .filter((report) => !active || (report.period_start >= active.from && report.period_start <= active.to))
    .map((report) => {
      const unit = unitById.get(report.unit_id) as any;
      return { report, unit, project: projectById.get(unit?.project_id) as any, owners: ownersByUnit.get(report.unit_id) ?? [] };
    });
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const unpaid = rows.filter(({ report }) => !report.is_paid);
  const withDue = unpaid.filter(({ report }) => report.due_date);
  const noDue = unpaid.filter(({ report }) => !report.due_date);
  const dueByDate = new Map<string, typeof withDue>();
  for (const row of withDue) dueByDate.set(row.report.due_date, [...(dueByDate.get(row.report.due_date) ?? []), row]);
  const monthLabel = month.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells: ({ iso: string; day: number } | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, iso: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }),
  ];
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthDue = withDue.filter(({ report }) => report.due_date.startsWith(monthPrefix));
  const monthDueTotal = monthDue.reduce((sum, { report }) => sum + (report.currency === "IDR" && report.net_payout != null ? Number(report.net_payout) : 0), 0);
  async function markPaid(itemId: string) {
    const paidDate = paidDates[itemId] || todayIso;
    try {
      await complete({ data: { itemId, paidDate } });
      await Promise.all([client.invalidateQueries({ queryKey: ["finance-workspace"] }), client.invalidateQueries({ queryKey: ["reports"] })]);
      toast.success(t("staff.markedPaid"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); }
  }
  return <div className="space-y-12">
    <section className="space-y-6">
      <SectionTitle note={`${queue.filter((row) => !row.report.is_paid).length}`}>{t("staff.todayQueue")}</SectionTitle>
      {queue.length === 0 ? <p className="border-t border-hairline py-6 text-sm text-muted-foreground">{t("staff.noQueue")}</p> :
        <ul className="border-t border-hairline">{queue.map(({ plan, item, report }) => {
          const unit = unitById.get(report.unit_id) as any;
          const project = projectById.get(unit?.project_id) as any;
          return <li key={item.id} className="grid gap-4 border-b border-hairline px-4 py-5 sm:grid-cols-[3rem_1fr_auto_auto] sm:items-center">
            <span className="figure text-lg text-violet">{item.priority}</span>
            <div><p className="text-sm font-medium">{project?.name} · {unit?.code}</p><p className="mt-1 text-xs text-muted-foreground">{plan.name} · {report.period_label}</p></div>
            <span className="figure text-sm">{report.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</span>
            {report.is_paid ? <PaidBadge paid paidAt={report.paid_at} /> : <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><span className="whitespace-nowrap">{t("staff.paymentDate")}</span><Input type="date" className="h-8 w-36" value={paidDates[item.id] ?? todayIso} onChange={(event) => setPaidDates((prev) => ({ ...prev, [item.id]: event.target.value }))} /></label>
              <Button size="sm" onClick={() => void markPaid(item.id)}><Check />{t("staff.confirmPaid")}</Button>
            </div>}
          </li>;
        })}</ul>}
    </section>
    <section className="space-y-6">
      <SectionTitle note={monthLabel}>{t("staff.calendar")}</SectionTitle>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
        <span className="min-w-40 text-center text-sm font-medium capitalize">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
        <Button variant="outline" size="sm" className="ml-auto" disabled={syncing} onClick={async () => { setSyncing(true); try { const r = await syncCal(); toast.success(lang === "ru" ? `Google Календарь обновлён: ${r.added} в обработке` : `Google Calendar synced: ${r.added} in progress`); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setSyncing(false); } }}>{lang === "ru" ? "Синхронизировать с Google Календарём" : "Sync to Google Calendar"}</Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline">
        {weekdays.map((day) => <div key={day} className="bg-card px-2 py-2 text-center text-[11px] uppercase tracking-wide text-muted-foreground">{day}</div>)}
        {calendarCells.map((cell, index) => cell == null ? <div key={`empty-${index}`} className="min-h-24 bg-card" /> :
          <div key={cell.iso} className={`min-h-24 bg-card p-2 ${cell.iso === todayIso ? "ring-1 ring-inset ring-violet" : ""}`}>
            <p className="text-xs text-muted-foreground">{cell.day}</p>
            <ul className="mt-1 space-y-1">{(dueByDate.get(cell.iso) ?? []).map(({ report, unit }) => <li key={report.id} className="rounded bg-violet/10 px-1.5 py-1">
              <p className="text-[11px] font-medium leading-tight">{unit?.code}</p>
              <p className="figure text-[11px] leading-tight text-muted-foreground">{report.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</p>
            </li>)}</ul>
          </div>)}
      </div>
      <p className="text-xs text-muted-foreground">{t("staff.dueThisMonth")}: {monthDue.length} · {monthDueTotal > 0 ? formatMoney(monthDueTotal, "IDR", lang) : "—"}</p>
      {noDue.length > 0 ? <div className="space-y-2">
        <p className="eyebrow">{t("staff.noDueDate")} ({noDue.length})</p>
        <ul className="border-t border-hairline">{noDue.map(({ report, unit, project }: any) => <li key={report.id} className="grid gap-2 border-b border-hairline px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <p className="font-medium">{project?.name} · {unit?.code}</p>
          <span className="text-xs text-muted-foreground">{report.period_label}</span>
          <span className="figure">{report.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</span>
        </li>)}</ul>
      </div> : null}
    </section>
    <section className="space-y-6">
      <SectionTitle note={`${rows.length}`}>{t("staff.allPayouts")}</SectionTitle>
      <div className="max-w-xs"><Select value={quarter} onValueChange={setQuarter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("payouts.allPeriods")}</SelectItem>{QUARTERS.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}</SelectContent></Select></div>
      <ul className="border-t border-hairline">{rows.map(({ report, unit, project, owners }) => <li key={report.id} className="grid gap-3 border-b border-hairline px-4 py-4 text-sm sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
        <div><p className="font-medium">{project?.name} · {unit?.code}</p><p className="mt-1 text-xs text-muted-foreground">{owners.join(", ") || "—"}</p></div>
        <span className="text-xs text-muted-foreground">{report.period_label}</span>
        <span className="figure">{report.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</span>
        <div className="flex items-center gap-2">{report.is_paid ? <PaidBadge paid paidAt={report.paid_at} /> : <><Clock3 className="size-4 text-muted-foreground"/><span className="eyebrow">{t("payouts.unpaid")}</span></>}</div>
        {report.paid_at ? <span className="text-xs text-muted-foreground sm:col-start-4">{formatDate(report.paid_at, lang)}</span> : null}
      </li>)}</ul>
    </section>
  </div>;
}
