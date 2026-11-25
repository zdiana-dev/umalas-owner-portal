import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { ActivityRow } from "@/lib/activity";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  component: AdminActivity,
});

type Row = ActivityRow & { user_id: string };

const adminActivityQuery = () => ({
  queryKey: ["admin-activity"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, user_id, action, entity_type, entity_id, title, unit_code, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
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

function formatMoment(value: string, lang: "ru" | "en") {
  return new Date(value).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describe(row: Row, t: (key: TranslationKey) => string) {
  if (row.action === "login") return t("act.login");
  const what =
    row.entity_type === "receipt"
      ? t("act.receipt")
      : row.entity_type === "report"
        ? t("act.report")
        : t("act.document");
  const verb =
    row.action === "upload"
      ? t("act.uploaded")
      : row.action === "download"
        ? t("act.downloaded")
        : t("act.viewed");
  return `${verb} · ${what}`;
}

const FILTERS: { value: string; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "act.all" },
  { value: "login", labelKey: "act.login" },
  { value: "upload", labelKey: "act.uploaded" },
  { value: "view", labelKey: "act.viewed" },
  { value: "download", labelKey: "act.downloaded" },
];

function AdminActivity() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery(adminActivityQuery());
  const [action, setAction] = useState("all");
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (data ?? []).filter((row) => {
      if (action !== "all" && row.action !== action) return false;
      if (!needle) return true;
      return [row.person?.name, row.person?.email, row.unit_code, row.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, action, term]);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionTitle>{t("act.adminTitle")}</SectionTitle>
        <p className="text-xs leading-5 text-muted-foreground">{t("act.adminSubtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("act.search")}
          className="h-11 w-full max-w-sm rounded-md border border-hairline bg-transparent px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setAction(filter.value)}
              className={`rounded-full border px-4 py-2 text-[11px] tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none ${
                action === filter.value
                  ? "border-transparent bg-foreground text-background"
                  : "border-hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonLines rows={6} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("act.empty")}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-6 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-[14px] leading-6">
                  {row.person?.name || row.person?.email || t("act.who")}
                  <span className="text-muted-foreground">
                    {" — "}
                    {describe(row, t)}
                    {row.title ? ` · ${row.title}` : ""}
                  </span>
                </p>
                <p className="eyebrow mt-1 text-muted-foreground">
                  {[row.unit_code, row.person?.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="figure text-xs whitespace-nowrap text-muted-foreground">
                {formatMoment(row.created_at, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
