import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { inviteStaffMember, revokeStaffMember } from "@/lib/staff.functions";
import { getOwnerLoginLink } from "@/lib/admin.functions";
import { staffMembersQuery } from "@/lib/staff-queries";
import { useI18n } from "@/lib/i18n";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [
    { title: "Staff access — Owner Portal" },
    { name: "description", content: "Manage finance and project-scoped management access." },
    { property: "og:title", content: "Staff access — Owner Portal" },
    { property: "og:description", content: "Manage finance and project-scoped management access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: StaffPage,
});

function StaffPage() {
  const { t } = useI18n();
  const query = useQuery(staffMembersQuery());
  const invite = useServerFn(inviteStaffMember);
  const revoke = useServerFn(revokeStaffMember);
  const loginLinkFn = useServerFn(getOwnerLoginLink);
  const client = useQueryClient();
  const [form, setForm] = useState({ fullName: "", email: "", role: "finance" as "finance" | "luxso", projectId: "" });
  const [busy, setBusy] = useState(false);
  if (query.isLoading) return <SkeletonLines rows={5}/>;
  const data = query.data;
  if (!data) return null;
  const profileById = new Map(data.profiles.map((p: any) => [p.user_id, p]));
  const projectById = new Map(data.projects.map((p: any) => [p.id, p]));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await invite({ data: { fullName: form.fullName, email: form.email, role: form.role, projectIds: form.role === "luxso" && form.projectId ? [form.projectId] : [], redirectTo: "https://clients.theumalas.com/" } });
      await client.invalidateQueries({ queryKey: ["staff-members"] });
      setForm({ fullName: "", email: "", role: "finance", projectId: "" });
      toast.success(t("staff.invited"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); } finally { setBusy(false); }
  }
  async function sendLink(email: string, role: string) {
    if (!email) return;
    try {
      const res = await loginLinkFn({ data: { email, kind: "recovery", redirect_to: role === "finance" ? "https://clients.theumalas.com/finance" : "https://clients.theumalas.com/management" } });
      if (res?.url) {
        try { await navigator.clipboard.writeText(res.url); } catch { /* clipboard unavailable */ }
        toast.success(`${t("staff.loginLink")}: ${res.url}`, { duration: 60000 });
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); }
  }
  async function remove(userId: string) {
    await revoke({ data: { userId } });
    await client.invalidateQueries({ queryKey: ["staff-members"] });
    toast.success(t("staff.revoked"));
  }
  return <div className="space-y-10">
    <section className="space-y-4"><SectionTitle>{t("staff.preview")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/finance">{t("staff.previewFinance")}</Link></Button>
        <Button asChild variant="outline"><Link to="/management">{t("staff.previewLuxso")}</Link></Button>
      </div>
    </section>
    <section className="space-y-6"><SectionTitle>{t("staff.invite")}</SectionTitle>
      <form onSubmit={submit} className="grid gap-4 border-y border-hairline py-6 sm:grid-cols-2">
        <Input required placeholder={t("profile.name")} value={form.fullName} onChange={(e) => setForm((v) => ({...v, fullName: e.target.value}))}/>
        <Input required type="email" placeholder={t("profile.email")} value={form.email} onChange={(e) => setForm((v) => ({...v, email: e.target.value}))}/>
        <Select value={form.role} onValueChange={(role: "finance" | "luxso") => setForm((v) => ({...v, role}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="finance">{t("staff.finance")}</SelectItem><SelectItem value="luxso">{t("staff.management")}</SelectItem></SelectContent></Select>
        {form.role === "luxso" ? <Select value={form.projectId} onValueChange={(projectId) => setForm((v) => ({...v, projectId}))}><SelectTrigger><SelectValue placeholder={t("admin.project")}/></SelectTrigger><SelectContent>{data.projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <div/>}
        <Button disabled={busy || (form.role === "luxso" && !form.projectId)} className="sm:col-span-2 sm:justify-self-start"><ShieldCheck/>{t("staff.sendInvite")}</Button>
      </form>
    </section>
    <section className="space-y-6"><SectionTitle note={`${data.roles.length}`}>{t("staff.current")}</SectionTitle>
      <ul className="border-t border-hairline">{data.roles.map((row: any) => { const profile = profileById.get(row.user_id) as any; const names = data.access.filter((a: any) => a.user_id === row.user_id).map((a: any) => (projectById.get(a.project_id) as any)?.name).filter(Boolean); return <li key={`${row.user_id}-${row.role}`} className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-5"><div><p className="text-sm font-medium">{profile?.full_name || profile?.email}</p><p className="mt-1 text-xs text-muted-foreground">{profile?.email} · {row.role}{names.length ? ` · ${names.join(", ")}` : ""}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => void sendLink(profile?.email ?? "", row.role)}>{t("staff.loginLink")}</Button><Button variant="ghost" size="icon" title={t("staff.revoke")} onClick={() => void remove(row.user_id)}><Trash2/></Button></div></li>; })}</ul>
    </section>
  </div>;
}
