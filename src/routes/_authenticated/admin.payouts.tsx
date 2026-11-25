import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { allProfilesQuery, ownershipsQuery, projectsQuery, reportsQuery, unitsQuery } from "@/lib/portal-queries";
import { createPaymentPlan, getFinanceWorkspace, publishPaymentPlan } from "@/lib/staff.functions";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { PaidBadge } from "@/components/portal/PaidBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [
    { title: "ROI payouts — The Umalas Signature" },
    { name: "description", content: "ROI payout status and finance payment plans." },
    { property: "og:title", content: "ROI payouts — The Umalas Signature" },
    { property: "og:description", content: "ROI payout status and finance payment plans." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: AdminPayouts,
});

function AdminPayouts() {
  const { t, lang } = useI18n();
  const reports = useQuery(reportsQuery());
  const units = useQuery(unitsQuery());
  const ownerships = useQuery(ownershipsQuery());
  const profiles = useQuery(allProfilesQuery());
  const projects = useQuery(projectsQuery());
  const createPlan = useServerFn(createPaymentPlan);
  const publishPlan = useServerFn(publishPaymentPlan);
  const fetchWorkspace = useServerFn(getFinanceWorkspace);
  const workspace = useQuery({ queryKey: ["finance-workspace"], queryFn: () => fetchWorkspace() });
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [period, setPeriod] = useState("all");
  const [project, setProject] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const unitById = new Map((units.data ?? []).map((u) => [u.id, u]));
    const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
    const nameById = new Map((profiles.data ?? []).map((p) => [p.user_id, p.full_name || p.email]));
    const ownersByUnit = new Map<string, string[]>();
    for (const own of ownerships.data ?? []) {
      if (own.end_date) continue;
      const list = ownersByUnit.get(own.unit_id) ?? [];
      const name = nameById.get(own.owner_id);
      if (name && !list.includes(name)) list.push(name);
      ownersByUnit.set(own.unit_id, list);
    }
    return (reports.data ?? []).filter((r) => r.report_type === "roi" && r.is_published).map((r) => {
      const unit = unitById.get(r.unit_id);
      return { id: r.id, code: unit?.code ?? "—", projectId: unit?.project_id ?? "", project: projectById.get(unit?.project_id ?? "")?.name ?? "—", owners: ownersByUnit.get(r.unit_id) ?? [], period: r.period_label, start: r.period_start ?? "", amount: r.net_payout, currency: r.currency, paid: r.is_paid || Boolean(r.paid_at), paidAt: r.paid_at };
    });
  }, [reports.data, units.data, projects.data, ownerships.data, profiles.data]);

  if (reports.isLoading || units.isLoading || ownerships.isLoading || profiles.isLoading || projects.isLoading) return <SkeletonLines rows={8} />;
  const needle = search.trim().toLowerCase();
  const quarterOptions = [
    { value: "2026-q2", label: "Apr–Jun 2026", from: "2026-04-01", to: "2026-06-30" },
    { value: "2026-q3", label: "Jul–Sep 2026", from: "2026-07-01", to: "2026-09-30" },
    { value: "2026-q4", label: "Oct–Dec 2026", from: "2026-10-01", to: "2026-12-31" },
    { value: "2026-sep-nov", label: "Sep–Nov 2026", from: "2026-09-01", to: "2026-11-30" },
  ];
  const quarter = quarterOptions.find((option) => option.value === period);
  const visible = rows.filter((row) => (!onlyUnpaid || !row.paid) && (project === "all" || row.projectId === project) && (!quarter || (row.start >= quarter.from && row.start <= quarter.to)) && (!needle || `${row.code} ${row.project} ${row.period} ${row.owners.join(" ")}`.toLowerCase().includes(needle)));
  const pendingCount = visible.filter((row) => !row.paid).length;
  const selectedRows = selected.map((id) => rows.find((row) => row.id === id)).filter(Boolean) as NonNullable<ReturnType<typeof rows.find>>[];
  const selectedTotals = new Map<string, number>();
  for (const row of selectedRows) {
    if (row.amount != null) selectedTotals.set(row.currency, (selectedTotals.get(row.currency) ?? 0) + Number(row.amount));
  }
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function move(index: number, direction: -1 | 1) {
    setSelected((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; const currentValue = next[index]; const targetValue = next[target]; if (!currentValue || !targetValue) return current; next[index] = targetValue; next[target] = currentValue; return next; });
  }
  async function savePlan(publish: boolean) {
    if (selected.length === 0) return;
    const name = new Date().toISOString().slice(0, 10);
    setBusy(true);
    try {
      await createPlan({ data: { name, planDate, reportIds: selected, publish } });
      setSelected([]);
      await client.invalidateQueries({ queryKey: ["finance-workspace"] });
      toast.success(publish ? t("staff.planPublished") : t("staff.planSaved"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); } finally { setBusy(false); }
  }
  async function publishDraft(planId: string) {
    setBusy(true);
    try {
      await publishPlan({ data: { planId } });
      await client.invalidateQueries({ queryKey: ["finance-workspace"] });
      toast.success(t("staff.planPublished"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); } finally { setBusy(false); }
  }

  const draftPlans = (workspace.data?.plans ?? []).filter((plan) => plan.status === "draft");
  const sentPlans = (workspace.data?.plans ?? []).filter((plan) => plan.status === "published" || plan.status === "completed");
  const publishedPlanIds = new Set((workspace.data?.plans ?? []).filter((plan) => plan.status === "published").map((plan) => plan.id));
  const inProgressReportIds = new Set((workspace.data?.items ?? []).filter((item) => publishedPlanIds.has(item.plan_id)).map((item) => item.report_id));
  const reportById = new Map((workspace.data?.reports ?? []).map((report) => [report.id, report]));
  const unitByIdWs = new Map((workspace.data?.units ?? []).map((unit) => [unit.id, unit]));

  return <div className="space-y-10">
    <div className="space-y-3"><SectionTitle note={`${visible.length} · ${t("payouts.unpaid")}: ${pendingCount}`}>{t("admin.payouts")}</SectionTitle><p className="text-xs leading-5 text-muted-foreground">{t("payouts.subtitle")}</p></div>
    {draftPlans.length > 0 ? <section className="space-y-4">
      <p className="eyebrow">{t("payouts.draftPlans")}</p>
      {draftPlans.map((plan) => {
        const planItems = (workspace.data?.items ?? []).filter((item) => item.plan_id === plan.id);
        return <div key={plan.id} className="space-y-2 border-y border-hairline bg-cream/30 px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="figure">{plan.name} · {plan.plan_date}</p>
            <Button disabled={busy} onClick={() => void publishDraft(plan.id)}><CalendarPlus/>{t("staff.publish")}</Button>
          </div>
          <ul className="space-y-1 text-sm">{planItems.map((item, index) => {
            const report = reportById.get(item.report_id);
            const unit = report ? unitByIdWs.get(report.unit_id) : undefined;
            return <li key={item.id} className="flex items-center gap-3 border-b border-hairline py-1.5 last:border-0"><span className="figure w-6 text-violet">{index + 1}</span><span className="min-w-0 flex-1 truncate">{unit?.code ?? "—"} · {lastNames(rows.find((r) => r.id === item.report_id)?.owners ?? [])} · {report?.period_label ?? "—"}</span><span className="figure whitespace-nowrap">{report?.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</span></li>;
          })}</ul>
        </div>;
      })}
    </section> : null}
    {sentPlans.length > 0 ? <section className="space-y-4">
      <p className="eyebrow">{t("payouts.sentPlans")}</p>
      {sentPlans.map((plan) => {
        const planItems = (workspace.data?.items ?? []).filter((item) => item.plan_id === plan.id);
        const total = planItems.reduce((sum, item) => sum + Number(reportById.get(item.report_id)?.net_payout ?? 0), 0);
        const paidCount = planItems.filter((item) => item.paid_at).length;
        return <div key={plan.id} className="space-y-2 border-y border-hairline px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="figure">{plan.name} · {plan.plan_date}</p>
            <p className="eyebrow">{plan.status === "completed" ? t("staff.planCompleted") : t("staff.planSent")} · {paidCount}/{planItems.length} · <span className="figure">{formatMoney(total, "IDR", lang)}</span></p>
          </div>
          <ul className="space-y-1 text-sm">{planItems.map((item, index) => {
            const report = reportById.get(item.report_id);
            const unit = report ? unitByIdWs.get(report.unit_id) : undefined;
            return <li key={item.id} className="flex items-center gap-3 border-b border-hairline py-1.5 last:border-0"><span className="figure w-6 text-violet">{index + 1}</span><span className="min-w-0 flex-1 truncate">{unit?.code ?? "—"} · {lastNames(rows.find((r) => r.id === item.report_id)?.owners ?? [])} · {report?.period_label ?? "—"}</span><span className="figure whitespace-nowrap">{report?.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</span>{item.paid_at ? <PaidBadge paid paidAt={item.paid_at}/> : <span className="eyebrow inline-flex items-center gap-1.5 text-amber-700"><span className="inline-block size-1.5 rounded-full bg-amber-500"/>{t("staff.inProgress")}</span>}</li>;
          })}</ul>
        </div>;
      })}
    </section> : null}
    {selected.length > 0 ? <section className="space-y-5 border-y border-hairline bg-cream/30 px-4 py-6">
      <div className="grid gap-3 sm:grid-cols-[12rem_auto_auto] sm:items-end">
        <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)}/>
        <Button variant="outline" disabled={busy || selected.length === 0} onClick={() => void savePlan(false)}>{t("staff.saveDraft")}</Button>
        <Button disabled={busy || selected.length === 0} onClick={() => void savePlan(true)}><CalendarPlus/>{t("staff.publishPlan")}</Button>
      </div>
      <ol className="space-y-2">{selectedRows.map((row, index) => row ? <li key={row.id} className="flex items-center gap-3 border-b border-hairline py-2 text-sm"><span className="figure w-6 text-violet">{index + 1}</span><span className="min-w-0 flex-1 truncate">{row.project} · {row.code} · {row.period}</span><span className="figure whitespace-nowrap">{row.amount != null ? formatMoney(Number(row.amount), row.currency, lang) : "—"}</span><Button variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} title={t("staff.moveUp")}><ArrowUp/></Button><Button variant="ghost" size="icon" disabled={index === selectedRows.length - 1} onClick={() => move(index, 1)} title={t("staff.moveDown")}><ArrowDown/></Button></li> : null)}</ol>
      <div className="flex items-center justify-end gap-4"><span className="eyebrow">{t("payouts.planTotal")}</span><span className="figure text-base">{[...selectedTotals.entries()].map(([currency, total]) => formatMoney(total, currency, lang)).join(" + ")}</span></div>
    </section> : null}
    <div className="flex flex-wrap items-center gap-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.search")} className="max-w-xs"/>
      <Select value={project} onValueChange={setProject}><SelectTrigger className="w-[13rem]"><SelectValue placeholder={t("payouts.allProjects")}/></SelectTrigger><SelectContent><SelectItem value="all">{t("payouts.allProjects")}</SelectItem>{(projects.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[15rem]"><SelectValue placeholder={t("payouts.allPeriods")}/></SelectTrigger><SelectContent><SelectItem value="all">{t("payouts.allPeriods")}</SelectItem>{quarterOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={onlyUnpaid} onCheckedChange={(checked) => setOnlyUnpaid(Boolean(checked))}/>{t("payouts.onlyUnpaid")}</label></div>
    {visible.length === 0 ? <p className="border-t border-hairline py-5 text-sm text-muted-foreground">{t("payouts.empty")}</p> : <ul className="border-t border-hairline">{visible.map((row) => <li key={row.id} className={["relative grid gap-3 border-b border-hairline px-4 py-4 text-sm transition-colors sm:grid-cols-[auto_1fr_1fr_auto_auto] sm:items-center", row.paid ? "bg-positive/10 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-positive" : ""].join(" ")}>
      <Checkbox disabled={row.paid} checked={selected.includes(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`${row.project} ${row.code}`}/>
      <div><p className="figure">{row.project} · {row.code}</p><p className="eyebrow mt-1">{row.owners.join(", ") || "—"}</p></div>
      <span className="text-xs text-muted-foreground">{row.period}</span><span className="figure">{row.amount != null ? formatMoney(Number(row.amount), row.currency, lang) : "—"}</span>
      {row.paid ? <PaidBadge paid paidAt={row.paidAt}/> : inProgressReportIds.has(row.id) ? <span className="eyebrow inline-flex items-center gap-1.5 text-amber-700"><span className="inline-block size-1.5 rounded-full bg-amber-500"/>{t("staff.inProgress")}</span> : <span className="eyebrow text-violet">{t("payouts.unpaid")}</span>}
    </li>)}</ul>}
  </div>;
}

function lastNames(owners: string[]): string {
  const names = owners.flatMap((o) => o.split(/\s*&\s*/)).map((n) => n.trim().split(/\s+/).pop() ?? "").filter(Boolean);
  return names.join(", ") || "—";
}
