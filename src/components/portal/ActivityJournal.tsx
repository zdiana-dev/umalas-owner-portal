import { useQuery } from "@tanstack/react-query";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { activityQuery, type ActivityRow } from "@/lib/activity";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";

function formatMoment(value: string, lang: "ru" | "en") {
  return new Date(value).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describe(row: ActivityRow, t: (key: TranslationKey) => string) {
  if (row.action === "login") return t("act.login");
  const what =
    row.entity_type === "receipt"
      ? t("act.receipt")
      : row.entity_type === "report"
        ? t("act.report")
        : t("act.document");
  const verb = row.action === "download" ? t("act.downloaded") : t("act.viewed");
  return `${verb} · ${what}`;
}

/** Owner-facing journal: sign-ins plus every document and report opened. */
export function ActivityJournal({ userId }: { userId?: string }) {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery(activityQuery(userId));
  const rows = data ?? [];

  return (
    <div className="space-y-6 border-t border-hairline pt-10">
      <SectionTitle>{t("act.title")}</SectionTitle>
      <p className="text-xs leading-5 text-muted-foreground">{t("act.subtitle")}</p>

      {isLoading ? (
        <SkeletonLines rows={4} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("act.empty")}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-[14px] leading-6">
                  {describe(row, t)}
                  {row.title ? (
                    <span className="text-muted-foreground"> — {row.title}</span>
                  ) : null}
                </p>
                {row.unit_code ? <p className="eyebrow mt-1">{row.unit_code}</p> : null}
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
