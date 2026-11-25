import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paymentStatusUpdate } from "@/lib/report-payment-status";

import { dictionaries } from "@/lib/i18n";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_INVITE_TEMPLATES,
  renderInviteTemplate,
  type InviteTemplate,
  type InviteVars,
} from "@/lib/invite-template";

/** Reads the admin-edited template for a language (falling back to the built-in one). */
async function loadInviteTemplate(
  admin: { from: (table: string) => any },
  lang: "ru" | "en",
): Promise<InviteTemplate> {
  const { data } = await admin
    .from("email_templates")
    .select("lang, subject, heading, body, button_label, footer")
    .eq("lang", lang)
    .maybeSingle();
  return (data as InviteTemplate | null) ?? DEFAULT_INVITE_TEMPLATES[lang];
}

/** Rendered strings are attached to the invite so the email uses the admin's text. */
async function renderStoredInvite(
  admin: { from: (table: string) => any },
  lang: "ru" | "en",
  vars: InviteVars,
) {
  const template = await loadInviteTemplate(admin, lang);
  const rendered = renderInviteTemplate(template, vars);
  return {
    invite_subject: rendered.subject,
    invite_heading: rendered.heading,
    invite_body: rendered.body,
    invite_button_label: rendered.button_label,
    invite_footer: rendered.footer,
    invite_lang: lang,
  };
}

type AuthedContext = { supabase: { from: (table: string) => any }; userId: string };

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase
    .from("profiles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (data?.role !== "admin") throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const nullableDate = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

export const saveUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        code: z.string().trim().min(1),
        project_id: z.string().uuid().nullish(),
        building: z.string().trim().nullish(),
        floor: z.number().int().nullish(),
        unit_type: z.string().trim().nullish(),
        purchase_price: z.number().nullish(),
        purchase_currency: z.string().trim().min(1).default("IDR"),
        purchase_date: nullableDate,
        coefficient: z.number().nullish(),
        is_investment_contract: z.boolean().default(false),
        vat_rate: z.number().min(0).max(100).nullish(),
        ma_number: z.string().trim().nullish(),
        ma_start: nullableDate,
        ma_end: nullableDate,
        rental_pool_start: nullableDate,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const row = {
      code: data.code,
      // Omitted on partial saves (price editor) so the project link is never wiped.
      ...(data.project_id ? { project_id: data.project_id } : {}),
      building: data.building ?? null,
      floor: data.floor ?? null,
      unit_type: data.unit_type ?? null,
      purchase_price: data.purchase_price ?? null,
      purchase_currency: data.purchase_currency,
      purchase_date: data.purchase_date,
      coefficient: data.coefficient ?? null,
      is_investment_contract: data.is_investment_contract,
      ...(data.vat_rate != null ? { vat_rate: data.vat_rate } : {}),
      ma_number: data.ma_number ?? null,
      ma_start: data.ma_start,
      ma_end: data.ma_end,
      // Omitted on partial saves so the pool date is never wiped.
      ...(data.rental_pool_start !== undefined
        ? { rental_pool_start: data.rental_pool_start }
        : {}),
    };
    const result = data.id
      ? await admin.from("units").update(row).eq("id", data.id).select("id").single()
      : await admin.from("units").insert(row).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { id: result.data.id as string };
  });

export const createOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        full_name: z.string().trim().min(1),
        email: z.string().trim().email(),
        phone: z.string().trim().nullish(),
        password: z.string().min(8),
        language: z.enum(["ru", "en"]).default("ru"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const created = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Could not create owner");
    }
    const userId = created.data.user.id;
    const profile = await admin.from("profiles").upsert(
      {
        user_id: userId,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        preferred_language: data.language,
        role: "owner",
      },
      { onConflict: "user_id" },
    );
    if (profile.error) throw new Error(profile.error.message);

    const greeting = dictionaries[data.language]["messages.greeting"];
    await admin.from("messages").insert({
      owner_id: userId,
      sender_id: userId,
      from_admin: true,
      unit_id: null,
      body: greeting,
    });

    return { user_id: userId };
  });

export const linkOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        owner_id: z.string().uuid(),
        unit_id: z.string().uuid(),
        start_date: nullableDate,
        end_date: nullableDate,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { error } = await admin.from("ownerships").insert({
      owner_id: data.owner_id,
      unit_id: data.unit_id,
      start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: data.end_date,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unlinkOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { error } = await admin.from("ownerships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Publish / unpublish a single document or report from the admin unit view. */
export const setPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        kind: z.enum(["document", "report"]),
        id: z.string().uuid(),
        publish: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const table = data.kind === "report" ? "reports" : "documents";
    const { error } = await admin
      .from(table)
      .update({ is_published: data.publish })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/** Mark a report (payout invoice) as paid / not paid. Admin only. */
export const setReportPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { error } = await admin
      .from("reports")
      .update({ is_paid: data.paid, paid_at: data.paid ? new Date().toISOString() : null, no_roi_payment: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** One upload form for both documents and reports; several files per submit. */
export const setReportPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), status: z.enum(["paid", "unpaid", "no_roi"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (roleError || !role) throw new Error("Forbidden");
    const { data: report, error } = await context.supabase.from("reports").select("report_type, net_payout").eq("id", data.id).single();
    if (error || !report) throw new Error("Report unavailable");
    const update = paymentStatusUpdate(data.status, report, new Date().toISOString());
    let query = context.supabase.from("reports").update(update).eq("id", data.id);
    if (data.status === "no_roi") query = query.eq("net_payout", 0).eq("report_type", "roi");
    const result = await query.select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

/** One upload form for both documents and reports; several files per submit. */
export const uploadFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        unit_id: z.string().uuid(),
        kind: z.enum(["document", "report"]),
        category: z.string().trim().min(1).default("other"),
        title: z.string().trim().nullish(),
        report_type: z.enum(["roi", "ipl", "other"]).default("roi"),
        period_label: z.string().trim().default(""),
        period_start: nullableDate,
        period_end: nullableDate,
        issued_date: nullableDate,
        net_payout: z.number().nullish(),
        currency: z.string().trim().min(1).default("IDR"),
        publish: z.boolean().default(false),
        files: z
          .array(
            z.object({
              name: z.string().min(1),
              contentType: z.string().min(1),
              contentBase64: z.string().min(1),
              /** Bulk import: per-file overrides so one request can span units / categories. */
              unit_id: z.string().uuid().nullish(),
              category: z.string().trim().nullish(),
              title: z.string().trim().nullish(),
            }),
          )
          .min(1),

      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const bucket = data.kind === "report" ? "reports" : "documents";
    const created: string[] = [];

    for (const file of data.files) {
      const unitId = file.unit_id ?? data.unit_id;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${unitId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
      const upload = await admin.storage
        .from(bucket)
        .upload(path, Buffer.from(file.contentBase64, "base64"), {
          contentType: file.contentType,
          upsert: false,
        });
      if (upload.error) throw new Error(upload.error.message);

      if (data.kind === "report") {
        let detectedPayout = data.net_payout ?? null;
        if (
          detectedPayout == null &&
          data.report_type === "roi" &&
          (file.contentType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
        ) {
          try {
            const [{ extractText, getDocumentProxy }, { parsePayout }] = await Promise.all([
              import("unpdf"),
              import("@/lib/payout-extract"),
            ]);
            const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(file.contentBase64, "base64")));
            const { text } = await extractText(pdf, { mergePages: true });
            detectedPayout = parsePayout(Array.isArray(text) ? text.join("\n") : String(text));
          } catch {
            // Keep the report upload available when a scanned or damaged PDF cannot be read.
          }
        }
        const insert = await admin
          .from("reports")
          .insert({
            unit_id: unitId,
            report_type: data.report_type,
            period_label: data.period_label || safeName,
            period_start: data.period_start,
            period_end: data.period_end,
            file_path: path,
            net_payout: detectedPayout,
            currency: data.currency,
            is_published: data.publish,
          })
          .select("id")
          .single();
        if (insert.error) throw new Error(insert.error.message);
        created.push(insert.data.id as string);
      } else {
        const insert = await admin
          .from("documents")
          .insert({
            unit_id: unitId,
            category: (file.category ?? data.category) as never,
            title:
              file.title?.trim() ||
              (data.files.length === 1 ? data.title?.trim() : "") ||
              file.name.replace(/\.[^.]+$/, ""),
            file_path: path,
            issued_date: data.issued_date,
            is_published: data.publish,
          })
          .select("id")
          .single();
        if (insert.error) throw new Error(insert.error.message);
        created.push(insert.data.id as string);
      }
    }

    // Journal: record every upload so the admin activity log shows who added what.
    try {
      const unitIds = [
        ...new Set(data.files.map((f) => f.unit_id ?? data.unit_id).filter(Boolean)),
      ] as string[];
      const codes = new Map<string, string>();
      if (unitIds.length) {
        const { data: units } = await admin.from("units").select("id, code").in("id", unitIds);
        for (const unit of units ?? []) codes.set(unit.id as string, unit.code as string);
      }
      const entries = data.files.map((file) => {
        const unitId = file.unit_id ?? data.unit_id;
        return {
          user_id: (context as AuthedContext).userId,
          action: "upload",
          entity_type: data.kind,
          title:
            file.title?.trim() ||
            (data.kind === "report" ? data.period_label : "") ||
            file.name.replace(/\.[^.]+$/, ""),
          unit_code: unitId ? (codes.get(unitId) ?? null) : null,
        };
      });
      if (entries.length) await admin.from("activity_log").insert(entries);
    } catch {
      // journal is best-effort
    }

    return { ids: created };
  });

/** Delete a document or report row together with its stored file. Admin only. */
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ kind: z.enum(["document", "report"]), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const table = data.kind === "report" ? "reports" : "documents";
    const bucket = data.kind === "report" ? "reports" : "documents";
    const { data: row, error: readError } = await admin
      .from(table)
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const { error } = await admin.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.file_path) await admin.storage.from(bucket).remove([row.file_path as string]);
    return { ok: true };
  });

/** Edit the metadata of one document or report. Admin only. */
export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        kind: z.enum(["document", "report"]),
        id: z.string().uuid(),
        title: z.string().trim().min(1).optional(),
        period_label: z.string().trim().min(1).optional(),
        category: z.string().trim().min(1).optional(),
        issued_date: nullableDate.optional(),
        due_date: nullableDate.optional(),
        report_type: z.enum(["roi", "ipl", "other"]).optional(),
        net_payout: z
          .union([z.number(), z.string()])
          .nullish()
          .transform((value) =>
            value === null || value === undefined || value === "" ? null : Number(value),
          )
          .optional(),
        currency: z.string().trim().min(1).optional(),
        payout_note: z
          .string()
          .max(2000)
          .nullish()
          .transform((v) => (v === undefined ? undefined : v == null || v.trim() === "" ? null : v.trim()))
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { kind, id, ...rest } = data;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await admin
      .from(kind === "report" ? "reports" : "documents")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Publish every unpublished document of a single unit (post bulk-import step). */

export const publishUnitDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ unit_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { data: rows, error } = await admin
      .from("documents")
      .update({ is_published: true })
      .eq("unit_id", data.unit_id)
      .eq("is_published", false)
      .select("id");
    if (error) throw new Error(error.message);
    return { count: (rows ?? []).length };
  });

/**
 * Admin dashboard: sign-in coverage, payouts per unit and who has been active
 * lately. One round trip so the screen renders in a single pass.
 */
export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [profiles, ownerships, units, reports, activity] = await Promise.all([
      admin.from("profiles").select("user_id, full_name, email, role"),
      admin.from("ownerships").select("owner_id, unit_id, end_date"),
      admin.from("units").select("id, code"),
      admin
        .from("reports")
        .select("unit_id, report_type, net_payout, currency, is_published, is_paid, period_label, period_start"),
      admin
        .from("activity_log")
        .select("user_id, action, created_at, unit_code")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    for (const result of [profiles, ownerships, units, reports, activity]) {
      if (result.error) throw new Error(result.error.message);
    }

    // Paged sign-in data: large single pages fail on the auth admin API.
    const authRows: Array<{ id: string; last_sign_in_at: string | null }> = [];
    for (let page = 1; page <= 20; page += 1) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) throw new Error(listed.error.message);
      const batch = listed.data.users ?? [];
      authRows.push(
        ...batch.map((u) => ({ id: u.id, last_sign_in_at: u.last_sign_in_at ?? null })),
      );
      if (batch.length < 200) break;
    }

    type P = { user_id: string; full_name: string | null; email: string; role: string };
    const owners = (profiles.data as P[]).filter((p) => p.role !== "admin");
    const auth = new Map(
      authRows.map((u) => [u.id, { last_sign_in_at: u.last_sign_in_at }] as const),
    );

    const links = (ownerships.data as Array<{ owner_id: string; unit_id: string; end_date: string | null }>).filter(
      (o) => !o.end_date || String(o.end_date) > today,
    );
    const codeById = new Map((units.data as Array<{ id: string; code: string }>).map((u) => [u.id, u.code]));
    const unitsByOwner = new Map<string, string[]>();
    for (const link of links) {
      const list = unitsByOwner.get(link.owner_id) ?? [];
      list.push(codeById.get(link.unit_id) ?? "—");
      unitsByOwner.set(link.owner_id, list);
    }

    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const signedInEver = owners.filter((o) => auth.get(o.user_id)?.last_sign_in_at).length;
    const signedIn30 = owners.filter((o) => {
      const at = auth.get(o.user_id)?.last_sign_in_at;
      return at ? new Date(at).getTime() >= monthAgo : false;
    }).length;

    // Payouts per unit, published ROI reports only (what owners actually see).
    type R = {
      unit_id: string;
      report_type: string;
      net_payout: number | null;
      currency: string;
      is_published: boolean;
      is_paid: boolean;
      period_label: string;
      period_start: string | null;
    };
    const payoutUnits = new Map<
      string,
      { code: string; total: number; currency: string; reports: number; paid: number; lastPeriod: string | null }
    >();
    for (const row of reports.data as R[]) {
      if (row.report_type !== "roi" || !row.is_published || row.net_payout == null) continue;
      const code = codeById.get(row.unit_id) ?? "—";
      const entry =
        payoutUnits.get(row.unit_id) ??
        { code, total: 0, currency: row.currency, reports: 0, paid: 0, lastPeriod: null };
      entry.total += Number(row.net_payout);
      entry.reports += 1;
      if (row.is_paid) entry.paid += 1;
      if (!entry.lastPeriod) entry.lastPeriod = row.period_label;
      payoutUnits.set(row.unit_id, entry);
    }

    type A = { user_id: string; action: string; created_at: string; unit_code: string | null };
    const active = new Map<
      string,
      { user_id: string; name: string; email: string; units: string[]; views: number; downloads: number; logins: number; last: string }
    >();
    const nameById = new Map(owners.map((o) => [o.user_id, o] as const));
    for (const row of activity.data as A[]) {
      const person = nameById.get(row.user_id);
      if (!person) continue;
      const entry =
        active.get(row.user_id) ??
        {
          user_id: row.user_id,
          name: person.full_name || "",
          email: person.email,
          units: unitsByOwner.get(row.user_id) ?? [],
          views: 0,
          downloads: 0,
          logins: 0,
          last: row.created_at,
        };
      if (row.action === "download") entry.downloads += 1;
      else if (row.action === "login") entry.logins += 1;
      else if (row.action === "view") entry.views += 1;
      if (row.created_at > entry.last) entry.last = row.created_at;
      active.set(row.user_id, entry);
    }

    return {
      owners: {
        total: owners.length,
        signedInEver,
        signedIn30,
        never: owners.length - signedInEver,
        withoutUnits: owners.filter((o) => !unitsByOwner.has(o.user_id)).length,
      },
      unitsTotal: (units.data as unknown[]).length,
      payoutUnits: [...payoutUnits.values()].sort((a, b) => a.code.localeCompare(b.code)),
      active: [...active.values()].sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, 25),
    };
  });

/** Owners administration: invite, edit, re-invite / reset, link & close ownerships. */

/** Owners administration: invite, edit, re-invite / reset, link & close ownerships. */
export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const profiles = await admin
      .from("profiles")
      .select("user_id, full_name, email, phone, preferred_language, role")
      .order("full_name");
    if (profiles.error) throw new Error(profiles.error.message);

    const ownerships = await admin
      .from("ownerships")
      .select("id, owner_id, unit_id, start_date, end_date");
    if (ownerships.error) throw new Error(ownerships.error.message);

    // Login metadata is optional: if the auth service fails, still show owners.
    const users: Array<import("@supabase/supabase-js").User> = [];
    try {
      for (let page = 1; page <= 20; page++) {
        const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (res.error) {
          console.error("listOwners: listUsers failed", res.error.message);
          break;
        }
        users.push(...(res.data.users ?? []));
        if ((res.data.users ?? []).length < 200) break;
      }
    } catch (e) {
      console.error("listOwners: listUsers threw", e);
    }
    const byId = new Map(
      users.map(
        (u) =>
          [
            u.id,
            {
              last_sign_in_at: u.last_sign_in_at ?? null,
              created_at: u.created_at ?? null,
              invited_at: (u as { invited_at?: string | null }).invited_at ?? null,
              confirmed_at: u.email_confirmed_at ?? null,
              recovery_sent_at:
                (u as { recovery_sent_at?: string | null }).recovery_sent_at ?? null,
            },
          ] as const,
      ),
    );

    const today = new Date().toISOString().slice(0, 10);
    return {
      owners: (profiles.data as Array<{
        user_id: string;
        full_name: string | null;
        email: string;
        phone: string | null;
        preferred_language: string;
        role: string;
      }>).map((p) => {
        const links = (
          ownerships.data as Array<{ owner_id: string; end_date: string | null }>
        ).filter((o) => o.owner_id === p.user_id);
        const auth = byId.get(p.user_id);
        return {
          ...p,
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          account_created_at: auth?.created_at ?? null,
          invited_at: auth?.invited_at ?? null,
          confirmed_at: auth?.confirmed_at ?? null,
          recovery_sent_at: auth?.recovery_sent_at ?? null,
          last_invite_at:
            [auth?.invited_at ?? null, auth?.recovery_sent_at ?? null]
              .filter(Boolean)
              .sort()
              .pop() ?? null,
          active_units: links.filter(
            (o) => !o.end_date || String(o.end_date) > today,
          ).length,
          total_units: links.length,
        };
      }),

      ownerships: ownerships.data as Array<{
        id: string;
        owner_id: string;
        unit_id: string;
        start_date: string;
        end_date: string | null;
      }>,
    };
  });

export const inviteOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        full_name: z.string().trim().min(1),
        email: z.string().trim().email(),
        phone: z.string().trim().nullish(),
        preferred_language: z.enum(["ru", "en"]).default("ru"),
        redirect_to: z.string().url().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();

    let userId: string | null = null;
    let invited = false;

    const rendered = await renderStoredInvite(admin, data.preferred_language, {
      full_name: data.full_name,
      email,
      link: data.redirect_to ?? "",
      brand: "The Umalas Signature",
    });

    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      ...(data.redirect_to ? { redirectTo: data.redirect_to } : {}),
      data: { full_name: data.full_name, ...rendered },
    });
    if (invite.data?.user) {
      userId = invite.data.user.id;
      invited = true;
    } else {
      // Idempotent path: the address already exists — reuse that user.
      const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (existing.error) throw new Error(existing.error.message);
      const match = (existing.data.users ?? []).find(
        (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
      );
      if (!match) throw new Error(invite.error?.message ?? "Could not invite owner");
      userId = match.id as string;
    }

    const profile = await admin.from("profiles").upsert(
      {
        user_id: userId,
        full_name: data.full_name,
        email,
        phone: data.phone ?? null,
        preferred_language: data.preferred_language,
        role: "owner",
      },
      { onConflict: "user_id" },
    );
    if (profile.error) throw new Error(profile.error.message);
    return { user_id: userId as string, invited };
  });

export const updateOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().min(1),
        email: z.string().trim().email(),
        phone: z.string().trim().nullish(),
        preferred_language: z.enum(["ru", "en"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();
    const authUpdate = await admin.auth.admin.updateUserById(data.user_id, { email });
    if (authUpdate.error) throw new Error(authUpdate.error.message);
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email,
        phone: data.phone ?? null,
        preferred_language: data.preferred_language,
      })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Supabase Auth throttles link emails per address ("you can only request this
 * after N seconds"). Returning it as data keeps the admin UI alive — throwing
 * surfaces as a runtime error with a blank screen.
 */
function authSendFailure(message: string) {
  const seconds = /after (\d+) seconds?/i.exec(message)?.[1];
  return {
    ok: false as const,
    throttled: Boolean(seconds),
    ...(seconds ? { retry_after_seconds: Number(seconds) } : {}),
    message,
  };
}

export const sendOwnerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email(),
        kind: z.enum(["invite", "recovery"]),
        redirect_to: z.string().url().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();
    if (data.kind === "invite") {
      const profile = await admin
        .from("profiles")
        .select("full_name, preferred_language")
        .eq("email", email)
        .maybeSingle();
      const lang = profile.data?.preferred_language === "en" ? "en" : "ru";
      const rendered = await renderStoredInvite(admin, lang, {
        full_name: profile.data?.full_name ?? "",
        email,
        link: data.redirect_to ?? "",
        brand: "The Umalas Signature",
      });
      const invite = await admin.auth.admin.inviteUserByEmail(email, {
        ...(data.redirect_to ? { redirectTo: data.redirect_to } : {}),
        data: rendered,
      });
      if (invite.error) return authSendFailure(invite.error.message);
      return { ok: true as const, throttled: false as const, message: null };
    }
    const reset = await admin.auth.resetPasswordForEmail(
      email,
      data.redirect_to ? { redirectTo: data.redirect_to } : {},
    );
    if (reset.error) return authSendFailure(reset.error.message);
    return { ok: true as const, throttled: false as const, message: null };
  });

/**
 * Sets a one-time temporary password for an owner who cannot receive the
 * email link. Admin-only; the generated password is returned once so the
 * admin can pass it to the owner personally. The owner must change it in
 * Profile after the first sign-in.
 */
export const setOwnerTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ email: z.string().trim().email() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();
    let user: { id: string } | null = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError) throw new Error(listError.message);
      user = users.users.find((u) => u.email?.toLowerCase() === email) ?? null;
      if (users.users.length < 200) break;
    }
    if (!user) throw new Error("User not found");
    const tempPassword = `Umalas-${Math.random().toString(36).slice(2, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, email, temp_password: tempPassword };
  });

/**
 * Generates a personal one-time login link (invite or recovery) without
 * sending an email, so the admin can forward it to the owner personally
 * (e.g. via WhatsApp). Admin-only; the link is returned once.
 */
export const getOwnerLoginLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email(),
        kind: z.enum(["invite", "recovery"]),
        redirect_to: z.string().url().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();
    let user: { id: string; email_confirmed_at?: string | null } | null = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError) throw new Error(listError.message);
      const match = users.users.find((u) => u.email?.toLowerCase() === email);
      if (match) {
        user = {
          id: match.id,
          email_confirmed_at: (match as { email_confirmed_at?: string | null })
            .email_confirmed_at ?? null,
        };
      }
      if (users.users.length < 200) break;
    }
    if (!user) throw new Error("User not found");
    // Unconfirmed accounts cannot use recovery links — always invite them.
    const type = user.email_confirmed_at && data.kind === "recovery" ? "recovery" : "invite";
    const { data: link, error } = await admin.auth.admin.generateLink({
      type,
      email,
      ...(data.redirect_to ? { options: { redirectTo: data.redirect_to } } : {}),
    });
    if (error) throw new Error(error.message);
    const url = link.properties?.action_link;
    if (!url) throw new Error("No link returned");
    return { ok: true as const, email, kind: type, url };
  });

/** Sends a branded English login email to an active Anoya owner. */
export const sendAnoyaOwnerLoginEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ email: z.string().trim().email() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const email = data.email.toLowerCase();
    const profile = await admin
      .from("profiles")
      .select("user_id, full_name")
      .eq("email", email)
      .maybeSingle();
    if (profile.error || !profile.data) throw new Error(profile.error?.message ?? "Owner not found");

    const ownerships = await admin
      .from("ownerships")
      .select("unit_id, units!inner(code, projects!inner(code))")
      .eq("owner_id", profile.data.user_id)
      .or(`end_date.is.null,end_date.gt.${new Date().toISOString().slice(0, 10)}`);
    if (ownerships.error) throw new Error(ownerships.error.message);
    const anoyaUnits = (ownerships.data ?? [])
      .filter((row: any) => row.units?.projects?.code === "anoya")
      .map((row: any) => row.units?.code as string)
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));
    if (anoyaUnits.length === 0) throw new Error("Owner has no active Anoya villas");

    let user: { id: string; email_confirmed_at?: string | null } | null = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const users = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (users.error) throw new Error(users.error.message);
      const match = users.data.users.find((item) => item.email?.toLowerCase() === email);
      if (match) user = { id: match.id, email_confirmed_at: match.email_confirmed_at ?? null };
      if (users.data.users.length < 200) break;
    }
    if (!user) throw new Error("User not found");

    const villaLabel = anoyaUnits.length === 1 ? "Villa" : "Villas";
    const villaCodes = anoyaUnits.join(", ");
    const redirectTo = "https://umalas-owner.lovable.app/anoya";
    const metadata = {
      full_name: profile.data.full_name,
      invite_subject: "Your Anoya Villas owner cabinet — login instructions",
      invite_heading: `${profile.data.full_name}, your Anoya Villas owner cabinet is ready`,
      invite_body: [
        `Your owner cabinet for ${villaLabel.toLowerCase()} ${villaCodes} at Anoya Villas is ready.`,
        "",
        "How to sign in:",
        `1. Open your personal link using the button below. This link is only for ${email}.`,
        "2. Set and confirm a password of at least 8 characters.",
        "3. You will enter your cabinet with villa documents, ROI / IPL reports, receipts and the payout calendar.",
        `4. Next time, open https://clients.theumalas.com/anoya, enter ${email} and your password, then select “Sign in with password”.`,
        "5. If you have any questions, use the WhatsApp button at the bottom of the cabinet.",
      ].join("\n"),
      invite_button_label: "Set password and sign in",
      invite_footer: "This personal link expires after a while. If it no longer works, please request a new one.",
      invite_lang: "en",
      invite_brand: "Anoya Villas",
      invite_units: villaCodes,
    };
    const updated = await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    if (updated.error) throw new Error(updated.error.message);

    if (user.email_confirmed_at) {
      const sent = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (sent.error) return authSendFailure(sent.error.message);
    } else {
      const sent = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: metadata,
      });
      if (sent.error) return authSendFailure(sent.error.message);
    }
    return { ok: true as const, email, units: anoyaUnits };
  });

/**
 * Bulk personal links for owners who never signed in.
 * Resumable: owners who already received a link within `skip_hours` are skipped,
 * so the admin can run it again after the hourly email allowance resets.
 */
export const sendPendingOwnerLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        redirect_to: z.string().url().nullish(),
        limit: z.number().int().min(1).max(200).default(20),
        skip_hours: z.number().int().min(0).max(720).default(20),
        /** "pending" = owners who never signed in; "all" = every active owner. */
        audience: z.enum(["pending", "all"]).default("pending"),
      })
      .parse(data ?? {}),
  )

  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);

    const profiles = await admin
      .from("profiles")
      .select("user_id, full_name, email, preferred_language, role")
      .eq("role", "owner");
    if (profiles.error) throw new Error(profiles.error.message);

    const ownerships = await admin.from("ownerships").select("owner_id, start_date, end_date");
    if (ownerships.error) throw new Error(ownerships.error.message);

    const today = new Date().toISOString().slice(0, 10);
    const withUnits = new Set(
      (ownerships.data as Array<{ owner_id: string; start_date: string; end_date: string | null }>)
        .filter((o) => o.start_date <= today && (!o.end_date || o.end_date > today))
        .map((o) => o.owner_id),
    );

    const authUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsers.error) throw new Error(authUsers.error.message);
    const authById = new Map(
      (authUsers.data.users ?? []).map((u: Record<string, any>) => [u['id'] as string, u]),
    );

    const cutoff = Date.now() - data.skip_hours * 3600_000;
    const pending = (
      profiles.data as Array<{
        user_id: string;
        full_name: string | null;
        email: string;
        preferred_language: string;
      }>
    ).filter((p) => {
      if (!withUnits.has(p.user_id)) return false;
      const auth = authById.get(p.user_id);
      if (!auth) return false;
      if (data.audience === "pending" && auth['last_sign_in_at']) return false;

      const last = [auth['invited_at'], auth['recovery_sent_at'], auth['confirmation_sent_at']]
        .filter(Boolean)
        .map((v: string) => new Date(v).getTime())
        .sort((a, b) => b - a)[0];
      return !(last && last > cutoff);
    });

    const failures: string[] = [];
    let sent = 0;

    for (const person of pending.slice(0, data.limit)) {
      const email = person.email.toLowerCase();
      const lang = person.preferred_language === "en" ? "en" : "ru";
      try {
        const auth = authById.get(person.user_id);
        if (auth?.['email_confirmed_at']) {
          const reset = await admin.auth.resetPasswordForEmail(
            email,
            data.redirect_to ? { redirectTo: data.redirect_to } : {},
          );
          if (reset.error) throw new Error(reset.error.message);
        } else {
          const rendered = await renderStoredInvite(admin, lang, {
            full_name: person.full_name ?? "",
            email,
            link: data.redirect_to ?? "",
            brand: "The Umalas Signature",
          });
          const invite = await admin.auth.admin.inviteUserByEmail(email, {
            ...(data.redirect_to ? { redirectTo: data.redirect_to } : {}),
            data: rendered,
          });
          if (invite.error) throw new Error(invite.error.message);
        }
        sent += 1;
      } catch (error) {
        failures.push(`${email}: ${error instanceof Error ? error.message : "error"}`);
      }
    }

    return {
      sent,
      pending: pending.length,
      remaining: Math.max(0, pending.length - sent),
      failures,
    };
  });

/** Closing an ownership keeps history: it sets end_date instead of deleting. */
export const closeOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), end_date: nullableDate }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { error } = await admin
      .from("ownerships")
      .update({ end_date: data.end_date ?? new Date().toISOString().slice(0, 10) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Invite email template administration: read and save the RU / EN wording. */
export const getInviteTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { data, error } = await admin
      .from("email_templates")
      .select("lang, subject, heading, body, button_label, footer");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InviteTemplate[];
    return {
      ru: rows.find((r) => r.lang === "ru") ?? DEFAULT_INVITE_TEMPLATES.ru,
      en: rows.find((r) => r.lang === "en") ?? DEFAULT_INVITE_TEMPLATES.en,
    };
  });

export const saveInviteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lang: z.enum(["ru", "en"]),
        subject: z.string().trim().min(1).max(200),
        heading: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(4000),
        button_label: z.string().trim().min(1).max(80),
        footer: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { error } = await admin.from("email_templates").upsert(
      {
        lang: data.lang,
        subject: data.subject,
        heading: data.heading,
        body: data.body,
        button_label: data.button_label,
        footer: data.footer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lang" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Bulk import: one CSV row at a time so the admin sees progress and a single
 * bad row never stops the run. Idempotent — the unit is matched by code, the
 * owner by email and the ownership link by (owner, unit) with an open period.
 * Invitations are only sent when the admin asked for them.
 */
export const importUnitRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        unit_code: z.string().trim().min(1),
        building: z.string().trim().nullish(),
        floor: z.number().int().nullish(),
        unit_type: z.string().trim().nullish(),
        coefficient: z.number().nullish(),
        ma_number: z.string().trim().nullish(),
        ma_start: nullableDate,
        ma_end: nullableDate,
        owner_full_name: z.string().trim().nullish(),
        owner_email: z.string().trim().nullish(),
        owner_phone: z.string().trim().nullish(),
        preferred_language: z.enum(["ru", "en"]).default("ru"),
        send_invite: z.boolean().default(false),
        redirect_to: z.string().url().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const code = data.unit_code.toUpperCase();

    const unitRow = {
      code,
      building: data.building ?? null,
      floor: data.floor ?? null,
      unit_type: data.unit_type ?? null,
      coefficient: data.coefficient ?? null,
      ma_number: data.ma_number ?? null,
      ma_start: data.ma_start,
      ma_end: data.ma_end,
    };

    const found = await admin.from("units").select("id").eq("code", code).maybeSingle();
    if (found.error) throw new Error(found.error.message);

    let unitId: string;
    let unitCreated = false;
    if (found.data?.id) {
      unitId = found.data.id as string;
      const updated = await admin.from("units").update(unitRow).eq("id", unitId);
      if (updated.error) throw new Error(updated.error.message);
    } else {
      const inserted = await admin.from("units").insert(unitRow).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      unitId = inserted.data.id as string;
      unitCreated = true;
    }

    const email = (data.owner_email ?? "").trim().toLowerCase();
    if (!email) return { unit_id: unitId, unitCreated, ownerCreated: false, linked: false, invited: false };

    const fullName = data.owner_full_name?.trim() || email;

    // Owner lookup by email: profile first, then the auth directory.
    const profileMatch = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    let ownerId = (profileMatch.data?.user_id as string | undefined) ?? null;
    let ownerCreated = false;
    let invited = false;

    if (!ownerId) {
      const directory = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (directory.error) throw new Error(directory.error.message);
      const existingUser = (directory.data.users ?? []).find(
        (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
      );
      if (existingUser) {
        ownerId = existingUser.id as string;
      } else if (data.send_invite) {
        const rendered = await renderStoredInvite(admin, data.preferred_language, {
          full_name: fullName,
          email,
          link: data.redirect_to ?? "",
          brand: "The Umalas Signature",
        });
        const invite = await admin.auth.admin.inviteUserByEmail(email, {
          ...(data.redirect_to ? { redirectTo: data.redirect_to } : {}),
          data: { full_name: fullName, ...rendered },
        });
        if (invite.error || !invite.data?.user) {
          throw new Error(invite.error?.message ?? "Could not invite owner");
        }
        ownerId = invite.data.user.id as string;
        ownerCreated = true;
        invited = true;
      } else {
        // Silent onboarding: account exists, no email leaves the system.
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name: fullName },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message ?? "Could not create owner");
        }
        ownerId = created.data.user.id as string;
        ownerCreated = true;
      }
    }

    const profile = await admin.from("profiles").upsert(
      {
        user_id: ownerId,
        full_name: fullName,
        email,
        phone: data.owner_phone ?? null,
        preferred_language: data.preferred_language,
        role: "owner",
      },
      { onConflict: "user_id" },
    );
    if (profile.error) throw new Error(profile.error.message);

    const link = await admin
      .from("ownerships")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("unit_id", unitId)
      .is("end_date", null)
      .maybeSingle();
    if (link.error) throw new Error(link.error.message);

    let linked = false;
    if (!link.data) {
      const insert = await admin.from("ownerships").insert({
        owner_id: ownerId,
        unit_id: unitId,
        start_date: data.ma_start ?? new Date().toISOString().slice(0, 10),
        end_date: null,
      });
      if (insert.error) throw new Error(insert.error.message);
      linked = true;
    }

    return { unit_id: unitId, unitCreated, ownerCreated, linked, invited };
  });

/** Attach or remove a payment receipt file for a report. Admin only. */
export const setReportReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        file: z
          .object({
            name: z.string().min(1),
            contentType: z.string().min(1),
            contentBase64: z.string().min(1),
          })
          .nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as AuthedContext);
    const { data: report, error: readError } = await admin
      .from("reports")
      .select("id, unit_id, receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !report) throw new Error(readError?.message ?? "Report not found");

    if (report.receipt_path) {
      await admin.storage.from("reports").remove([report.receipt_path]);
    }

    let path: string | null = null;
    if (data.file) {
      const safeName = data.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      path = `${report.unit_id}/receipts/${Date.now()}_${safeName}`;
      const upload = await admin.storage
        .from("reports")
        .upload(path, Buffer.from(data.file.contentBase64, "base64"), {
          contentType: data.file.contentType,
          upsert: false,
        });
      if (upload.error) throw new Error(upload.error.message);
    }

    const { error } = await admin
      .from("reports")
      .update({ receipt_path: path })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, receipt_path: path };
  });
