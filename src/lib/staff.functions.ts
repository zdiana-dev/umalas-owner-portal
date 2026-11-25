import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Context = { supabase: { from: (table: string) => any }; userId: string };
type StaffRole = "admin" | "finance" | "luxso";

async function ownRoles(context: Context): Promise<StaffRole[]> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: StaffRole }) => row.role);
}

async function requireRole(context: Context, allowed: StaffRole[]) {
  const roles = await ownRoles(context);
  if (!roles.some((role) => allowed.includes(role))) throw new Error("Forbidden");
  return roles;
}

export const getStaffContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const typed = context as Context;
    const roles = await ownRoles(typed);
    const { data: access, error } = await typed.supabase
      .from("staff_project_access")
      .select("project_id")
      .eq("user_id", typed.userId);
    if (error) throw new Error(error.message);
    return { roles, projectIds: (access ?? []).map((row: { project_id: string }) => row.project_id) };
  });

export const getFinanceWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const typed = context as Context;
    const roles = await requireRole(typed, ["admin", "finance"]);
    const isAdmin = roles.includes("admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let plansQuery = supabaseAdmin.from("payment_plans").select("id, name, plan_date, status, published_at").order("plan_date", { ascending: false });
    if (!isAdmin) plansQuery = plansQuery.in("status", ["published", "completed"]);
    const [reports, units, projects, ownerships, profiles, plans, items] = await Promise.all([
      supabaseAdmin.from("reports").select("id, unit_id, period_label, period_start, due_date, net_payout, currency, is_paid, paid_at, is_published, report_type").eq("report_type", "roi").eq("is_published", true),
      supabaseAdmin.from("units").select("id, code, project_id"),
      supabaseAdmin.from("projects").select("id, name, code").order("sort_order"),
      supabaseAdmin.from("ownerships").select("owner_id, unit_id, end_date"),
      supabaseAdmin.from("profiles").select("user_id, full_name, email"),
      plansQuery,
      supabaseAdmin.from("payment_plan_items").select("id, plan_id, report_id, priority, paid_at, paid_by").order("priority"),
    ]);
    for (const result of [reports, units, projects, ownerships, profiles, plans, items]) {
      if (result.error) throw new Error(result.error.message);
    }
    return { reports: reports.data ?? [], units: units.data ?? [], projects: projects.data ?? [], ownerships: ownerships.data ?? [], profiles: profiles.data ?? [], plans: plans.data ?? [], items: items.data ?? [] };
  });

export const getLuxsoWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin", "luxso"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [reports, units, projects, queued] = await Promise.all([
      typed.supabase.from("reports").select("id, unit_id, period_label, period_start, net_payout, currency, is_paid, no_roi_payment, paid_at, file_path, report_type, is_published").eq("is_published", true).order("period_start", { ascending: false }),
      typed.supabase.from("units").select("id, code, project_id"),
      typed.supabase.from("projects").select("id, name, code, managed_by, mark_url, logo_url").order("sort_order"),
      supabaseAdmin.from("payment_plan_items").select("report_id, payment_plans!inner(status)").in("payment_plans.status", ["published"]).is("paid_at", null),
    ]);
    for (const result of [reports, units, projects, queued]) if (result.error) throw new Error(result.error.message);
    const inProgressReportIds: string[] = [...new Set<string>((queued.data ?? []).map((row: { report_id: string }) => row.report_id))];
    // Owner names only for units the caller can actually see (their project scope).
    const unitIds: string[] = [...new Set<string>((units.data ?? []).map((u: { id: string }) => u.id))];
    const ownerships = unitIds.length > 0
      ? await supabaseAdmin.from("ownerships").select("owner_id, unit_id, end_date").in("unit_id", unitIds)
      : { data: [], error: null };
    if (ownerships.error) throw new Error(ownerships.error.message);
    const ownerIds: string[] = [...new Set<string>((ownerships.data ?? []).map((o: { owner_id: string }) => o.owner_id))];
    const profiles = ownerIds.length > 0
      ? await supabaseAdmin.from("profiles").select("user_id, full_name, email").in("user_id", ownerIds)
      : { data: [], error: null };
    if (profiles.error) throw new Error(profiles.error.message);
    // Hide units owned by internal Magnum Estate accounts (e.g. staff test rooms) from LUXSO.
    const internalOwnerIds = new Set<string>((profiles.data ?? []).filter((p: { email: string | null }) => (p.email ?? "").endsWith("@magnumestate.pro")).map((p: { user_id: string }) => p.user_id));
    const internalUnitIds = new Set<string>((ownerships.data ?? []).filter((o: { owner_id: string; end_date: string | null }) => !o.end_date && internalOwnerIds.has(o.owner_id)).map((o: { unit_id: string }) => o.unit_id));
    const visibleReports = (reports.data ?? []).filter((r: { unit_id: string }) => !internalUnitIds.has(r.unit_id));
    return { reports: visibleReports, units: units.data ?? [], projects: projects.data ?? [], inProgressReportIds, ownerships: ownerships.data ?? [], profiles: profiles.data ?? [] };

  });

export const createPaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(1), planDate: z.string().date(), reportIds: z.array(z.string().uuid()).min(1), publish: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uniqueReportIds = [...new Set(data.reportIds)];
    if (uniqueReportIds.length !== data.reportIds.length) throw new Error("A payout can only appear once in a plan");
    const { data: eligibleReports, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id")
      .in("id", uniqueReportIds)
      .eq("report_type", "roi")
      .eq("is_published", true)
      .eq("is_paid", false);
    if (reportError) throw new Error(reportError.message);
    if ((eligibleReports ?? []).length !== uniqueReportIds.length) throw new Error("One or more ROI payouts are unavailable or already paid");
    const { data: activeItems, error: activeError } = await supabaseAdmin
      .from("payment_plan_items")
      .select("report_id, payment_plans!inner(status)")
      .in("report_id", uniqueReportIds)
      .in("payment_plans.status", ["published"])
      .is("paid_at", null);
    if (activeError) throw new Error(activeError.message);
    if ((activeItems ?? []).length) throw new Error("One or more payouts are already queued in a published plan");
    const { data: plan, error } = await supabaseAdmin.from("payment_plans").insert({
      name: data.name,
      plan_date: data.planDate,
      status: data.publish ? "published" : "draft",
      created_by: typed.userId,
      ...(data.publish ? { published_by: typed.userId, published_at: new Date().toISOString() } : {}),
    }).select("id").single();
    if (error || !plan) throw new Error(error?.message ?? "Could not create payment plan");
    const rows = uniqueReportIds.map((reportId, index) => ({ plan_id: plan.id, report_id: reportId, priority: index + 1 }));
    const inserted = await supabaseAdmin.from("payment_plan_items").insert(rows);
    if (inserted.error) {
      await supabaseAdmin.from("payment_plans").delete().eq("id", plan.id);
      throw new Error(inserted.error.message);
    }
    if (data.publish) await (await import("./payout-calendar.server")).trySyncPayoutCalendar();
    return { id: plan.id };
  });

export const publishPaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error } = await supabaseAdmin
      .from("payment_plans")
      .update({ status: "published", published_by: typed.userId, published_at: new Date().toISOString() })
      .eq("id", data.planId)
      .eq("status", "draft")
      .select("id")
      .single();
    if (error || !plan) throw new Error(error?.message ?? "Draft plan not found or already published");
    await (await import("./payout-calendar.server")).trySyncPayoutCalendar();
    return { ok: true };
  });

export const completeQueuedPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ itemId: z.string().uuid(), paidDate: z.string().date() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["finance"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("complete_payment_plan_item", { _item_id: data.itemId, _paid_by: typed.userId, _paid_at: data.paidDate });
    if (error) throw new Error(error.message);
    await (await import("./payout-calendar.server")).trySyncPayoutCalendar();
    return { ok: true };
  });

/** LUXSO staff mark a payout in their assigned project as paid (they pay owners themselves). */
export const markProjectPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: z.string().uuid(), paidDate: z.string().date() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    const roles = await requireRole(typed, ["admin", "luxso"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id, unit_id, is_paid, is_published, report_type")
      .eq("id", data.reportId)
      .single();
    if (reportError || !report) throw new Error(reportError?.message ?? "Report not found");
    if (report.report_type !== "roi" || !report.is_published) throw new Error("Report is not a published ROI payout");
    if (report.is_paid) throw new Error("Payout is already marked as paid");
    if (!roles.includes("admin")) {
      const { data: unit, error: unitError } = await supabaseAdmin.from("units").select("project_id").eq("id", report.unit_id).single();
      if (unitError || !unit || !unit.project_id) throw new Error(unitError?.message ?? "Unit not found");
      const { data: access, error: accessError } = await supabaseAdmin
        .from("staff_project_access")
        .select("id")
        .eq("user_id", typed.userId)
        .eq("project_id", unit.project_id)
        .maybeSingle();
      if (accessError) throw new Error(accessError.message);
      if (!access) throw new Error("This payout belongs to a project outside your access");
    }
    const paidAt = new Date(`${data.paidDate}T00:00:00Z`).toISOString();
    const { error } = await supabaseAdmin
      .from("reports")
      .update({ is_paid: true, paid_at: paidAt })
      .eq("id", data.reportId)
      .eq("is_paid", false);
    if (error) throw new Error(error.message);
    // If the report is queued in a payment plan, close that item too.
    await supabaseAdmin
      .from("payment_plan_items")
      .update({ paid_by: typed.userId, paid_at: paidAt })
      .eq("report_id", data.reportId)
      .is("paid_at", null);
    await (await import("./payout-calendar.server")).trySyncPayoutCalendar();
    return { ok: true };
  });

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email(), fullName: z.string().trim().min(1), role: z.enum(["finance", "luxso"]), projectIds: z.array(z.string().uuid()).default([]), redirectTo: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    if (data.role === "luxso" && data.projectIds.length === 0) throw new Error("Choose at least one project");
    if (data.role === "finance" && data.projectIds.length > 0) throw new Error("Finance access cannot be project-scoped");
    if (data.projectIds.length) {
      const { data: allowedProjects, error: projectError } = await supabaseAdmin.from("projects").select("id").in("id", [...new Set(data.projectIds)]);
      if (projectError) throw new Error(projectError.message);
      if ((allowedProjects ?? []).length !== new Set(data.projectIds).size) throw new Error("Unknown project");
    }
    let user = null as { id: string } | null;
    for (let page = 1; page <= 20 && !user; page++) {
      const listed = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) throw new Error(listed.error.message);
      user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
      if (listed.data.users.length < 200) break;
    }
    if (!user) {
      const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: data.redirectTo, data: { full_name: data.fullName } });
      if (invited.error || !invited.data.user) throw new Error(invited.error?.message ?? "Could not invite staff member");
      user = invited.data.user;
    }
    const profile = await supabaseAdmin.from("profiles").upsert({ user_id: user.id, full_name: data.fullName, email, preferred_language: "en", role: "owner" }, { onConflict: "user_id" });
    if (profile.error) throw new Error(profile.error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id).in("role", ["finance", "luxso"]);
    const assigned = await supabaseAdmin.from("user_roles").insert({ user_id: user.id, role: data.role });
    if (assigned.error) throw new Error(assigned.error.message);
    await supabaseAdmin.from("staff_project_access").delete().eq("user_id", user.id);
    if (data.role === "luxso" && data.projectIds.length) {
      const access = await supabaseAdmin.from("staff_project_access").insert(data.projectIds.map((projectId) => ({ user_id: user.id, project_id: projectId })));
      if (access.error) throw new Error(access.error.message);
    }
    return { ok: true, invited: true };
  });

export const getStaffMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [roles, profiles, access, projects] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["finance", "luxso"]),
      supabaseAdmin.from("profiles").select("user_id, full_name, email"),
      supabaseAdmin.from("staff_project_access").select("user_id, project_id"),
      supabaseAdmin.from("projects").select("id, name, code").order("sort_order"),
    ]);
    for (const result of [roles, profiles, access, projects]) if (result.error) throw new Error(result.error.message);
    return { roles: roles.data ?? [], profiles: profiles.data ?? [], access: access.data ?? [], projects: projects.data ?? [] };
  });

export const revokeStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await supabaseAdmin.from("staff_project_access").delete().eq("user_id", data.userId);
    if (access.error) throw new Error(access.error.message);
    const roles = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).in("role", ["finance", "luxso"]);
    if (roles.error) throw new Error(roles.error.message);
    return { ok: true };
  });

/** Sends a branded English login email to a finance or luxso staff member. */
export const sendStaffLoginEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().trim().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const typed = context as Context;
    await requireRole(typed, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const profile = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .eq("email", email)
      .maybeSingle();
    if (profile.error || !profile.data) throw new Error(profile.error?.message ?? "Staff member not found");

    const rolesResult = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.data.user_id)
      .in("role", ["finance", "luxso"]);
    if (rolesResult.error) throw new Error(rolesResult.error.message);
    const staffRoles = (rolesResult.data ?? []).map((row: { role: string }) => row.role);
    if (staffRoles.length === 0) throw new Error("User has no staff role");
    const isFinance = staffRoles.includes("finance");

    let user: { id: string; email_confirmed_at?: string | null } | null = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const users = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (users.error) throw new Error(users.error.message);
      const match = users.data.users.find((item) => item.email?.toLowerCase() === email);
      if (match) user = { id: match.id, email_confirmed_at: match.email_confirmed_at ?? null };
      if (users.data.users.length < 200) break;
    }
    if (!user) throw new Error("User not found");

    const homePath = isFinance ? "/finance" : "/management";
    const roleLabel = isFinance ? "finance workspace" : "management reports workspace";
    const redirectTo = `https://clients.theumalas.com${homePath}`;
    const metadata = {
      full_name: profile.data.full_name,
      invite_subject: "Your owner portal staff access — login instructions",
      invite_heading: `${profile.data.full_name}, your staff access is ready`,
      invite_body: [
        `Your ${roleLabel} on the owner portal is ready.`,
        "",
        "How to sign in:",
        `1. Open your personal link using the button below. This link is only for ${email}.`,
        "2. Set and confirm a password of at least 8 characters.",
        `3. You will enter your ${roleLabel}.`,
        `4. Next time, open https://clients.theumalas.com${homePath}, enter ${email} and your password, then select “Sign in with password”.`,
        "5. If you have any questions, please contact the portal administrator.",
      ].join("\n"),
      invite_button_label: "Set password and sign in",
      invite_footer: "This personal link expires after a while. If it no longer works, please request a new one.",
      invite_lang: "en",
      invite_brand: "The Umalas Signature",
    };
    const updated = await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    if (updated.error) throw new Error(updated.error.message);

    if (user.email_confirmed_at) {
      const sent = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
      if (sent.error) throw new Error(sent.error.message);
    } else {
      const sent = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata });
      if (sent.error) throw new Error(sent.error.message);
    }
    return { ok: true as const, email, role: isFinance ? "finance" : "luxso" };
  });

export const syncPayoutCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context as Context, ["admin", "finance"]);
    return (await import("./payout-calendar.server")).syncPayoutCalendar();
  });
