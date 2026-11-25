import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/logins")({
  component: AdminLogins,
});

type LoginRow = {
  id: string;
  user_id: string;
  created_at: string;
  person?: { name: string; email: string } | undefined;
};

const loginsQuery = () => ({
  queryKey: ["admin-logins"],
  queryFn: async (): Promise<LoginRow[]> => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, user_id, created_at")
      .eq("action", "login")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LoginRow[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const people = new Map<string, { name: string; email: string }>();
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      for (const p of profiles ?? [])
        people.set(p.user_id as string, {
          name: (p.full_name as string) || "",
          email: (p.email as string) || "",
        });
    }
    return rows.map((row) => ({ ...row, person: people.get(row.user_id) }));
  },
});

type DayGroup = {
  key: string;
  label: string;
  people: { userId: string; name: string; email: string; count: number; last: string }[];
};

function AdminLogins() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery(loginsQuery());
  const [term, setTerm] = useState("");

  const locale = lang === "ru" ? "ru-RU" : "en-GB";

  const days = useMemo<DayGroup[]>(() => {
    const needle = term.trim().toLowerCase();
    const buckets = new Map<string, Map<string, DayGroup["people"][number]>>();
    for (const row of data ?? []) {
      const name = row.person?.name ?? "";
      const email = row.person?.email ?? "";
      if (needle && ![name, email].some((v) => v.toLowerCase().includes(needle))) continue;
      const date = new Date(row.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = new Map();
        buckets.set(key, bucket);
      }
      const existing = bucket.get(row.user_id);
      if (existing) {
        existing.count += 1;
        if (row.created_at > existing.last) existing.last = row.created_at;
      } else {
        bucket.set(row.user_id, {
          userId: row.user_id,
          name,
          email,
          count: 1,
          last: row.created_at,
        });
      }
    }
    return [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, bucket]) => ({
        key,
        label: new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        people: [...bucket.values()].sort((a, b) => (a.last < b.last ? 1 : -1)),
      }));
  }, [data, term, locale]);

  const time = (value: string) =>
    new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionTitle>{t("logins.title")}</SectionTitle>
        <p className="text-xs leading-5 text-muted-foreground">{t("logins.subtitle")}</p>
      </div>

      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t("logins.search")}
        className="h-11 w-full max-w-sm rounded-md border border-hairline bg-transparent px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      />

      {isLoading ? (
        <SkeletonLines rows={6} />
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("logins.empty")}</p>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <section key={day.key} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-2">
                <h3 className="text-[15px] leading-6">{day.label}</h3>
                <span className="eyebrow text-muted-foreground">
                  {day.people.length} {t("logins.people")}
                </span>
              </div>
              <ul>
                {day.people.map((person) => (
                  <li
                    key={person.userId}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] leading-6">{person.name || person.email}</p>
                      <p className="eyebrow mt-1 text-muted-foreground">{person.email}</p>
                    </div>
                    <span className="figure text-xs whitespace-nowrap text-muted-foreground">
                      {time(person.last)}
                      {person.count > 1 ? ` · ${person.count} ×` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
