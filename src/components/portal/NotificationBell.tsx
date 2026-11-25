import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatDate } from "@/lib/format";
import { myNotificationsQuery, markNotificationsRead } from "@/lib/notifications";

/**
 * Bell in the portal header: shows unread payout notifications and refreshes
 * instantly through a realtime subscription on the notifications table.
 */
export function NotificationBell() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: rows = [] } = useQuery(myNotificationsQuery());
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const unread = rows.filter((r) => !r.read_at);

  // Live updates: a new payout appears without a page reload.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      channel = supabase
        .channel(`notifications-${uid}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `owner_id=eq.${uid}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: ["notifications", "mine"] });
            void queryClient.invalidateQueries({ queryKey: ["reports"] });
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Close the panel when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread.length > 0) {
      await markNotificationsRead(unread.map((r) => r.id));
      void queryClient.invalidateQueries({ queryKey: ["notifications", "mine"] });
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={t("notifications.title")}
        className="relative flex items-center py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 ? (
          <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-rose px-1 text-center text-[9px] leading-4 text-white">
            {unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[280px] max-w-[calc(100vw-2rem)] border border-hairline bg-background shadow-xl sm:w-[320px]">
          <div className="brand-rule h-[2px] w-full" />
          <p className="px-4 pt-3 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {t("notifications.title")}
          </p>
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-xs normal-case text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="max-h-[320px] divide-y divide-hairline overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/reports"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 normal-case transition-colors duration-200 hover:bg-cream/60"
                  >
                    <span className="block text-xs tracking-normal text-foreground">
                      {r.kind === "payout_paid"
                        ? t("notifications.paid")
                        : t("notifications.new")}
                      {r.period_label ? ` — ${r.period_label}` : ""}
                    </span>
                    {r.amount ? (
                      <span className="mt-0.5 block text-xs tracking-normal text-violet">
                        {formatMoney(Number(r.amount), r.currency ?? "IDR", lang)}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-[10px] tracking-normal text-muted-foreground">
                      {formatDate(r.created_at, lang)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
