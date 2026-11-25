import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificationRow = {
  id: string;
  owner_id: string;
  unit_id: string | null;
  report_id: string | null;
  kind: string;
  amount: number | null;
  currency: string | null;
  period_label: string | null;
  read_at: string | null;
  created_at: string;
};

const SELECT =
  "id, owner_id, unit_id, report_id, kind, amount, currency, period_label, read_at, created_at";

/** The signed-in owner's own notifications, newest first. */
export const myNotificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications", "mine"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select(SELECT)
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

/** Mark the given notifications as read; ignores already-read rows. */
export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  if (error) throw error;
}
