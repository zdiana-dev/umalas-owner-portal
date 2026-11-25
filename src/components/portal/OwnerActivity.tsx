import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { ActivityRow } from "@/lib/activity";

const COPY = {
  ru: { title: "Активность в кабинете", more: "Показаны последние 20 действий" },
  en: { title: "Portal activity", more: "Showing the latest 20 actions" },
};

function describe(row: ActivityRow, t: (key: TranslationKey) => string) {
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

export function OwnerActivity({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const copy = COPY[lang === "en" ? "en" : "ru"];

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "owner-activity", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, entity_id, title, unit_code, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as ActivityRow[];
    },
  });

  return (
    <div className="border-t border-hairline pt-4">
      <p className="eyebrow text-muted-foreground">{copy.title}</p>
      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("act.empty")}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-3 text-xs text-muted-foreground"
              >
                <span className="min-w-0">
                  <span className="text-foreground">{describe(row, t)}</span>
                  {row.title ? ` · ${row.title}` : ""}
                  {row.unit_code ? ` · ${row.unit_code}` : ""}
                </span>
                <span className="figure whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
          {data.length === 20 ? <p className="eyebrow mt-3">{copy.more}</p> : null}
        </>
      )}
    </div>
  );
}
