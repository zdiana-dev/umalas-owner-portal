import { useMemo } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { DOC_CATEGORIES, type DocCategory, type DocumentRow } from "@/lib/portal-queries";

export function DocumentFolders({
  rows,
  selected,
  onSelect,
  t,
}: {
  rows: DocumentRow[];
  selected: DocCategory | "all" | "my_documents";
  onSelect: (category: DocCategory | "all" | "my_documents") => void;
  t: (key: TranslationKey) => string;
}) {
  const counts = useMemo(() => {
    const map = {} as Record<DocCategory | "all" | "my_documents", number>;
    (["all", "my_documents", ...DOC_CATEGORIES] as const).forEach((c) => (map[c] = 0));
    map["all"] = rows.length;
    map["my_documents"] = rows.length;
    rows.forEach((doc) => {
      if (DOC_CATEGORIES.includes(doc.category)) {
        map[doc.category] = (map[doc.category] ?? 0) + 1;
      }
    });
    return map;
  }, [rows]);

  const items: { key: DocCategory | "all" | "my_documents"; label: TranslationKey }[] = [
    { key: "my_documents", label: "doc.my_documents" },
    { key: "all", label: "doc.all" },
    ...DOC_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || selected === c).map((c) => ({
      key: c,
      label: `doc.${c}` as TranslationKey,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, label }) => {
        const active = selected === key;
        const count = counts[key] ?? 0;
        const empty = count === 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex items-center gap-2 border px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "border-violet bg-cream text-foreground"
                : empty
                  ? "border-hairline/60 text-muted-foreground/45 hover:text-muted-foreground"
                  : "border-hairline text-muted-foreground hover:text-foreground"
            }`}
          >

            <span className={active ? "text-foreground" : "text-muted-foreground"}>
              {t(label)}
            </span>
            <span
              className={`figure text-[10px] ${
                active ? "text-violet" : "text-muted-foreground/70"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
