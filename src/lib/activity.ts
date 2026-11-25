import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityAction = "login" | "view" | "download" | "upload";
export type ActivityEntity = "session" | "document" | "report" | "receipt";

export type ActivityRow = {
  id: string;
  action: ActivityAction;
  entity_type: ActivityEntity;
  entity_id: string | null;
  title: string;
  unit_code: string | null;
  created_at: string;
};

const COLUMNS = "id, action, entity_type, entity_id, title, unit_code, created_at";

/**
 * Append one entry to the owner's activity journal. Fire-and-forget: a failed
 * log must never break opening a document.
 */
export async function logActivity(entry: {
  action: ActivityAction;
  entityType?: ActivityEntity;
  entityId?: string | null;
  title?: string;
  unitCode?: string | null;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("activity_log").insert({
      user_id: auth.user.id,
      action: entry.action,
      entity_type: entry.entityType ?? "session",
      entity_id: entry.entityId ?? null,
      title: entry.title ?? "",
      unit_code: entry.unitCode ?? null,
    });
  } catch {
    // journal is best-effort
  }
}

/** Log a sign-in once per browser session. */
export async function logLoginOnce() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const key = `ual:${auth.user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    await logActivity({ action: "login", entityType: "session" });
  } catch {
    // ignore
  }
}

export const activityQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["activity", userId ?? "me"],
    queryFn: async (): Promise<ActivityRow[]> => {
      let query = supabase
        .from("activity_log")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(100);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as ActivityRow[];
    },
  });
