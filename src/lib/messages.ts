import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MessageRow = {
  id: string;
  owner_id: string;
  sender_id: string;
  from_admin: boolean;
  unit_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
};

const SELECT = "id, owner_id, sender_id, from_admin, unit_id, body, read_at, created_at";

/** Messages of the signed-in owner's own thread. */
export const myMessagesQuery = () =>
  queryOptions({
    queryKey: ["messages", "mine"],
    queryFn: async (): Promise<MessageRow[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("owner_id", uid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

/** All messages across all owners (admin only, enforced by RLS). */
export const allMessagesQuery = () =>
  queryOptions({
    queryKey: ["messages", "all"],
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(SELECT)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

export async function sendMessage(input: {
  ownerId: string;
  body: string;
  fromAdmin: boolean;
  unitId?: string | null | undefined;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("messages").insert({
    owner_id: input.ownerId,
    sender_id: uid,
    from_admin: input.fromAdmin,
    unit_id: input.unitId ?? null,
    body: input.body.trim(),
  });
  if (error) throw error;
}

/** Mark the other side's messages in a thread as read. */
export async function markThreadRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  if (error) throw error;
}
