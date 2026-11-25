import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  mark_url: string | null;
  accent: string | null;
  sort_order: number;
  managed_by: string | null;
};

export type Unit = {
  id: string;
  code: string;
  project_id: string | null;
  building: string | null;
  floor: number | null;
  unit_type: string | null;
  purchase_price: number | null;
  purchase_currency: string;
  purchase_date: string | null;
  coefficient: number | null;
  is_investment_contract: boolean;
  vat_rate: number | null;
  ma_number: string | null;
  ma_start: string | null;
  ma_end: string | null;
  rental_pool_start: string | null;
};

export type Ownership = {
  id: string;
  owner_id: string;
  unit_id: string;
  start_date: string;
  end_date: string | null;
};

export const DOC_CATEGORIES = [
  "mou",
  "lease_agreement",
  "addendum",
  "bast",
  "booking_form",
  "management_agreement",
  "resale_agreement",
  "payment_details",
  "bank_details",
  "other",

] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const REPORT_TYPES = ["roi", "ipl", "other"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type DocumentRow = {
  id: string;
  unit_id: string | null;
  category: DocCategory;
  title: string;
  issued_date: string | null;
  file_path: string;
  is_published: boolean;
};

export type ReportRow = {
  id: string;
  unit_id: string;
  report_type: ReportType;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  file_path: string;
  net_payout: number | null;
  currency: string;
  is_published: boolean;
  is_paid: boolean;
  no_roi_payment?: boolean;
  paid_at: string | null;
  receipt_path: string | null;
  due_date: string | null;
  payout_note?: string | null;
};

export type Profile = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_language: string;
  role: "owner" | "admin";
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export const UNIT_COLUMNS =
  "id, code, project_id, building, floor, unit_type, purchase_price, purchase_currency, purchase_date, coefficient, is_investment_contract, vat_rate, ma_number, ma_start, ma_end, rental_pool_start";

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> =>
      unwrap(
        await supabase
          .from("projects")
          .select("id, code, name, short_name, logo_url, mark_url, accent, sort_order, managed_by")
          .order("sort_order"),
      ),
  });


const PROFILE_COLUMNS = "user_id, full_name, email, phone, preferred_language, role";

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Profile | null) ?? null;
    },
  });

export const unitsQuery = () =>
  queryOptions({
    queryKey: ["units"],
    queryFn: async (): Promise<Unit[]> =>
      unwrap(await supabase.from("units").select(UNIT_COLUMNS).order("code")),
  });

export const ownershipsQuery = () =>
  queryOptions({
    queryKey: ["ownerships"],
    queryFn: async (): Promise<Ownership[]> =>
      unwrap(
        await supabase.from("ownerships").select("id, owner_id, unit_id, start_date, end_date"),
      ),
  });

export const allProfilesQuery = () =>
  queryOptions({
    queryKey: ["profiles", "all"],
    queryFn: async (): Promise<Profile[]> =>
      unwrap(await supabase.from("profiles").select(PROFILE_COLUMNS).order("full_name")),
  });

export const documentsQuery = (unitId?: string) =>
  queryOptions({
    queryKey: ["documents", unitId ?? "all"],
    queryFn: async (): Promise<DocumentRow[]> => {
      let query = supabase
        .from("documents")
        .select("id, unit_id, category, title, issued_date, file_path, is_published")
        .order("issued_date", { ascending: false, nullsFirst: false });
      if (unitId) query = query.eq("unit_id", unitId);
      return unwrap(await query);
    },
  });

export const reportsQuery = (unitId?: string) =>
  queryOptions({
    queryKey: ["reports", unitId ?? "all"],
    queryFn: async (): Promise<ReportRow[]> => {
      let query = supabase
        .from("reports")
        .select(
          "id, unit_id, report_type, period_label, period_start, period_end, file_path, net_payout, currency, is_published, is_paid, no_roi_payment, paid_at, receipt_path, due_date, payout_note",
        )
        .order("period_start", { ascending: false, nullsFirst: false });
      if (unitId) query = query.eq("unit_id", unitId);
      return unwrap(await query);
    },
  });
