import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { allMessagesQuery, markThreadRead, type MessageRow } from "@/lib/messages";
import { MessageThread } from "@/components/portal/MessageThread";
import { SkeletonLines } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  component: AdminMessagesPage,
});

type OwnerProfile = { user_id: string; full_name: string; email: string };

function ownersQuery() {
  return {
    queryKey: ["admin", "owner-profiles"],
    queryFn: async (): Promise<OwnerProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("role", "owner")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as OwnerProfile[];
    },
  };
}

function AdminMessagesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const messages = useQuery(allMessagesQuery());
  const owners = useQuery(ownersQuery());
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const byOwner = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    for (const m of messages.data ?? []) {
      const list = map.get(m.owner_id) ?? [];
      list.push(m);
      map.set(m.owner_id, list);
    }
    return map;
  }, [messages.data]);

  const threads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (owners.data ?? [])
      .map((o) => {
        const list = byOwner.get(o.user_id) ?? [];
        return {
          owner: o,
          list,
          unread: list.filter((m) => !m.from_admin && !m.read_at).length,
          last: list[list.length - 1] ?? null,
        };
      })
      .filter((th) => th.list.length > 0)
      .filter(
        (th) =>
          q.length === 0 ||
          th.owner.full_name.toLowerCase().includes(q) ||
          th.owner.email.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        return (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? "");
      });
  }, [owners.data, byOwner, search]);

  if (messages.isLoading || owners.isLoading) return <SkeletonLines rows={5} />;

  function open(ownerId: string, list: MessageRow[]) {
    const next = openId === ownerId ? null : ownerId;
    setOpenId(next);
    if (next) {
      const unread = list.filter((m) => !m.from_admin && !m.read_at).map((m) => m.id);
      if (unread.length > 0)
        void markThreadRead(unread).then(() =>
          qc.invalidateQueries({ queryKey: ["messages"] }),
        );
    }
  }

  return (
    <div className="space-y-6">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={lang === "ru" ? "Поиск по собственнику" : "Search owners"}
        className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/30"
      />

      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {lang === "ru" ? "Сообщений пока нет." : "No messages yet."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {threads.map((th) => (
            <div key={th.owner.user_id}>
              <button
                type="button"
                onClick={() => open(th.owner.user_id, th.list)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-violet/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{th.owner.full_name || th.owner.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {th.last?.body ?? ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {th.unread > 0 ? (
                    <span className="rounded-full bg-rose/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose">
                      {th.unread}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{th.list.length}</span>
                </span>
              </button>
              {openId === th.owner.user_id ? (
                <div className="border-t border-border px-4 py-5">
                  <MessageThread
                    messages={th.list}
                    ownerId={th.owner.user_id}
                    asAdmin
                    lang={lang}
                    onSent={() => void qc.invalidateQueries({ queryKey: ["messages"] })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("messages.adminNote")}</p>
    </div>
  );
}
