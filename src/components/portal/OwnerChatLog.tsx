import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOwnerChatLog } from "@/lib/assistant.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const COPY = {
  ru: { title: "Переписка с ассистентом", empty: "Владелец ещё не общался с ассистентом" },
  en: { title: "Assistant conversation", empty: "The owner has not chatted with the assistant yet" },
};

/** Read-only view of one owner's saved conversation with the AI assistant. */
export function OwnerChatLog({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const copy = COPY[lang === "en" ? "en" : "ru"];
  const loadLog = useServerFn(getOwnerChatLog);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "owner-chat", userId],
    queryFn: () => loadLog({ data: { ownerId: userId } }),
  });

  const turns = data?.turns ?? [];

  return (
    <div className="border-t border-hairline pt-4">
      <p className="eyebrow text-muted-foreground">{copy.title}</p>
      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : turns.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {turns.map((turn, index) => (
            <li key={index} className="text-xs leading-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-[10px] tracking-[0.14em] uppercase",
                    turn.role === "user" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {turn.role === "user" ? (lang === "ru" ? "Владелец" : "Owner") : "AI"}
                </span>
                <span className="figure whitespace-nowrap text-muted-foreground">
                  {new Date(turn.at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{turn.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
