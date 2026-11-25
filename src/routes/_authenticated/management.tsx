import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { luxsoWorkspaceQuery, staffContextQuery } from "@/lib/staff-queries";
import { getReportUrl } from "@/lib/files.functions";
import { markProjectPayoutPaid } from "@/lib/staff.functions";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { PaidBadge } from "@/components/portal/PaidBadge";
import { DocPreview } from "@/components/portal/DocPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const QUARTERS = [
  { value: "2026-q2", label: "Apr–Jun 2026", from: "2026-04-01", to: "2026-06-30" },
  { value: "2026-q3", label: "Jul–Sep 2026", from: "2026-07-01", to: "2026-09-30" },
  { value: "2026-q4", label: "Oct–Dec 2026", from: "2026-10-01", to: "2026-12-31" },
  { value: "2026-sep-nov", label: "Sep–Nov 2026", from: "2026-09-01", to: "2026-11-30" },
];

export const Route = createFileRoute("/_authenticated/management")({
  validateSearch: (search: Record<string, unknown>): { project?: string | undefined } => ({
    project: typeof search["project"] === "string" ? (search["project"] as string) : undefined,
  }),
  head: () => ({ meta: [
    { title: "Management reports — Owner Portal" },
    { name: "description", content: "Project-scoped ROI reports and payout status for the management team." },
    { property: "og:title", content: "Management reports — Owner Portal" },
    { property: "og:description", content: "Project-scoped ROI reports and payout status for the management team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ManagementPage,
});

function ManagementPage() {
  const { t, lang } = useI18n();
  const staff = useQuery(staffContextQuery());
  const allowed = staff.data?.roles.some((role) => role === "luxso" || role === "admin") === true;
  const canMarkPaid = staff.data?.roles.includes("luxso") === true;
  const workspace = useQuery({ ...luxsoWorkspaceQuery(), enabled: allowed });
  const getUrl = useServerFn(getReportUrl);
  const markPaid = useServerFn(markProjectPayoutPaid);
  const queryClient = useQueryClient();
  const [quarter, setQuarter] = useState("all");
  const [status, setStatus] = useState("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const { project: projectParam } = Route.useSearch();
  if (staff.isLoading || workspace.isLoading) return <SkeletonLines rows={8} />;
  if (!allowed) return <p className="text-sm text-muted-foreground">{t("admin.noAccess")}</p>;
  const data = workspace.data;
  if (!data) return null;
  async function confirmPaid(reportId: string) {
    setBusy(true);
    try {
      await markPaid({ data: { reportId, paidDate: payDate } });
      setPayingId(null);
      await queryClient.invalidateQueries({ queryKey: luxsoWorkspaceQuery().queryKey });
      toast.success(t("rep.paid"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }
  const unitById = new Map(data.units.map((u: any) => [u.id, u]));
  const projectById = new Map(data.projects.map((p: any) => [p.id, p]));
  const inProgress = new Set<string>(((data as any).inProgressReportIds ?? []) as string[]);
  const profileById = new Map((((data as any).profiles ?? []) as any[]).map((p) => [p.user_id, p]));
  const ownersByUnit = new Map<string, string[]>();
  for (const own of ((data as any).ownerships ?? []) as any[]) {
    if (own.end_date) continue;
    const owner = profileById.get(own.owner_id) as any;
    if (!owner) continue;
    ownersByUnit.set(own.unit_id, [...(ownersByUnit.get(own.unit_id) ?? []), owner.full_name || owner.email]);
  }
  const active = QUARTERS.find((q) => q.value === quarter);
  const scoped = (data.reports as any[])
    .filter((report) => !projectParam || (unitById.get(report.unit_id) as any)?.project_id === projectParam)
    .filter((report) => !active || (report.period_start >= active.from && report.period_start <= active.to));
  const statusOf = (report: any) => report.is_paid ? "paid" : inProgress.has(report.id) ? "progress" : "unpaid";
  const isZero = (report: any) => report.net_payout == null || Number(report.net_payout) === 0;
  const counts = { all: scoped.length, paid: 0, progress: 0, unpaid: 0, zero: 0 };
  for (const report of scoped) { counts[statusOf(report) as "paid" | "progress" | "unpaid"] += 1; if (isZero(report)) counts.zero += 1; }
  const rows = scoped
    .filter((report) => status === "all" || (status === "zero" ? isZero(report) : statusOf(report) === status))
    .map((report) => {
      const unit = unitById.get(report.unit_id) as any;
      return { report, unit, project: projectById.get(unit?.project_id) as any, owners: ownersByUnit.get(report.unit_id) ?? [] };
    });
  async function resolve(id: string) { const result = await getUrl({ data: { id } }); return result.url; }
  return <div className="space-y-8">
    <div><SectionTitle note={`${rows.length}`}>{t("staff.managementReports")}</SectionTitle><p className="mt-3 text-xs leading-5 text-muted-foreground">{t("staff.managementHint")}</p></div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="max-w-xs flex-1"><Select value={quarter} onValueChange={setQuarter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("payouts.allPeriods")}</SelectItem>{QUARTERS.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex flex-wrap gap-2">{([
        { value: "all", label: t("rep.all"), count: counts.all },
        { value: "paid", label: t("rep.paid"), count: counts.paid },
        { value: "progress", label: t("staff.inProgress"), count: counts.progress },
        { value: "unpaid", label: t("rep.unpaid"), count: counts.unpaid },
        { value: "zero", label: t("rep.zero"), count: counts.zero },
      ] as const).map((f) => <button key={f.value} type="button" onClick={() => setStatus(f.value)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] transition-colors ${status === f.value ? "border-foreground bg-foreground text-background" : "border-hairline text-muted-foreground hover:text-foreground"}`}>{f.label}<span className={status === f.value ? "opacity-70" : "text-muted-foreground"}>{f.count}</span></button>)}</div>
    </div>
    <ul className="border-t border-hairline">{rows.map(({ report, unit, project, owners }) => <DocPreview key={report.id} id={report.id} title={`${unit?.code ?? "—"} · ${report.period_label}`} fileName={report.file_path} getUrl={resolve} stampPaid={report.is_paid} paidAt={report.paid_at} as="li" className="grid gap-4 border-b border-hairline px-4 py-5 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
      {(open) => <>
        <div><p className="text-sm font-medium">{project?.name} · {unit?.code}</p><p className="mt-1 text-xs text-muted-foreground">{owners.join(", ") || "—"}</p><p className="eyebrow mt-1">{report.report_type}</p></div>
        <span className="text-xs text-muted-foreground">{report.period_label}</span>
        <div className="text-right"><p className="figure text-sm">{report.net_payout != null ? formatMoney(Number(report.net_payout), report.currency, lang) : "—"}</p>{report.paid_at ? <p className="mt-1 text-xs text-muted-foreground">{formatDate(report.paid_at, lang)}</p> : null}</div>
        <div className="flex flex-wrap items-center gap-3">
          {!report.is_paid && inProgress.has(report.id)
            ? <span title={t("staff.inProgressHint")} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-600/25 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-700"><span aria-hidden className="size-1.5 rounded-full bg-amber-600" />{t("staff.inProgress")}</span>
            : <PaidBadge paid={report.is_paid} paidAt={report.paid_at} noRoiPayment={report.no_roi_payment}/>}
          {!report.is_paid && inProgress.has(report.id) ? <span className="hidden text-xs text-muted-foreground sm:inline">{t("staff.inProgressHint")}</span> : null}
          <Button variant="outline" size="sm" onClick={open}><FileText />{t("doc.preview")}</Button>
          {canMarkPaid && !report.is_paid ? (
            payingId === report.id ? (
              <span className="flex items-center gap-2">
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-8 w-[9.5rem] text-xs" />
                <Button size="sm" disabled={busy} onClick={() => void confirmPaid(report.id)}><CheckCircle2 />{t("staff.markPaid")}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPayingId(null)}>×</Button>
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setPayingId(report.id); setPayDate(new Date().toISOString().slice(0, 10)); }}><CheckCircle2 />{t("staff.markPaid")}</Button>
            )
          ) : null}
        </div>
      </>}

    </DocPreview>)}</ul>
  </div>;
}
