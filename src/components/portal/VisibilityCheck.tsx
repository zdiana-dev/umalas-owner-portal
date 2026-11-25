import { useMemo } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";

type Doc = {
  id: string;
  title: string;
  category: string;
  issued_date: string | null;
  is_published: boolean;
};

type Rep = {
  id: string;
  period_label: string;
  report_type: string;
  net_payout: number | string | null;
  currency: string;
  is_published: boolean;
};

/** Titles that must never reach an owner cabinet. */
const FORBIDDEN = [
  "passport",
  "паспорт",
  "реквизит",
  "bank detail",
  "draft",
  "черновик",
  "resale",
  "ресейл",
  "перепрода",
  "internal",
  "внутренн",
];

type Flag = "sensitive" | "noDate" | "noPayout" | "codeMismatch" | "duplicate";

export type CheckItem = {
  key: string;
  kind: "document" | "report";
  id: string;
  title: string;
  caption: string;
  meta: string;
  published: boolean;
  flags: Flag[];
};

function buildItems(
  docs: Doc[],
  reports: Rep[],
  unitCode: string,
  lang: "ru" | "en",
  t: (key: TranslationKey) => string,
): CheckItem[] {
  const docTitles = new Map<string, number>();
  docs.forEach((d) => {
    const key = d.title.trim().toLowerCase();
    docTitles.set(key, (docTitles.get(key) ?? 0) + 1);
  });

  const docItems: CheckItem[] = docs.map((doc) => {
    const lower = doc.title.toLowerCase();
    const flags: Flag[] = [];
    if (
      doc.category !== "payment_details" &&
      doc.category !== "resale_agreement" &&
      FORBIDDEN.some((word) => lower.includes(word))
    )
      flags.push("sensitive");

    if (!doc.issued_date) flags.push("noDate");
    if (unitCode && !lower.includes(unitCode.toLowerCase())) flags.push("codeMismatch");
    if ((docTitles.get(doc.title.trim().toLowerCase()) ?? 0) > 1) flags.push("duplicate");
    return {
      key: `doc-${doc.id}`,
      kind: "document",
      id: doc.id,
      title: doc.title,
      caption: t(`doc.${doc.category}` as TranslationKey),
      meta: doc.issued_date ? formatDate(doc.issued_date, lang) : "",
      published: doc.is_published,
      flags,
    };
  });

  const repItems: CheckItem[] = reports.map((rep) => {
    const lower = rep.period_label.toLowerCase();
    const flags: Flag[] = [];
    if (FORBIDDEN.some((word) => lower.includes(word))) flags.push("sensitive");
    if (rep.report_type === "roi" && (rep.net_payout == null || Number(rep.net_payout) === 0))
      flags.push("noPayout");
    return {
      key: `rep-${rep.id}`,
      kind: "report",
      id: rep.id,
      title: rep.period_label,
      caption: t(`rep.${rep.report_type}` as TranslationKey),
      meta:
        rep.net_payout != null
          ? formatMoney(Number(rep.net_payout), rep.currency, lang)
          : "",
      published: rep.is_published,
      flags,
    };
  });

  return [...docItems, ...repItems];
}

const flagKey: Record<Flag, TranslationKey> = {
  sensitive: "check.flagSensitive",
  noDate: "check.flagNoDate",
  noPayout: "check.flagNoPayout",
  codeMismatch: "check.flagCodeMismatch",
  duplicate: "check.flagDuplicate",
};

/**
 * Pre-publication audit for one unit: what the owner will actually see,
 * what stays hidden, and which published items look wrong.
 */
export function VisibilityCheck({
  unitCode,
  documents,
  reports,
  hasOwner,
  onTogglePublish,
  onOpen,
}: {
  unitCode: string;
  documents: Doc[];
  reports: Rep[];
  hasOwner: boolean;
  onTogglePublish: (kind: "document" | "report", id: string, next: boolean) => void;
  onOpen: (kind: "document" | "report", id: string) => void;
}) {
  const { t, lang } = useI18n();
  const items = useMemo(
    () => buildItems(documents, reports, unitCode, lang, t),
    [documents, reports, unitCode, lang, t],
  );

  const visible = items.filter((i) => i.published);
  const hidden = items.filter((i) => !i.published);
  const flagged = visible.filter((i) => i.flags.length > 0);
  const blocking = flagged.filter((i) => i.flags.includes("sensitive"));

  return (
    <section className="space-y-8">
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-hairline bg-hairline sm:grid-cols-3">
        {[
          { label: t("check.visibleCount"), value: visible.length, tone: "" },
          { label: t("check.hiddenCount"), value: hidden.length, tone: "text-muted-foreground" },
          {
            label: t("check.flaggedCount"),
            value: flagged.length,
            tone: flagged.length > 0 ? "text-rose" : "text-muted-foreground",
          },
        ].map((cell) => (
          <div key={cell.label} className="bg-background px-5 py-5">
            <p className="eyebrow">{cell.label}</p>
            <p className={`figure mt-2 text-3xl ${cell.tone}`}>{cell.value}</p>
          </div>
        ))}
      </div>

      {!hasOwner && <p className="text-xs text-rose">{t("check.noOwner")}</p>}
      {blocking.length > 0 && (
        <p className="border-l-2 border-rose bg-rose/5 px-4 py-3 text-xs text-rose">
          {t("check.blockingNote")}
        </p>
      )}
      {visible.length > 0 && flagged.length === 0 && hasOwner && (
        <p className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-muted-foreground">
          {t("check.allClear")}
        </p>
      )}

      <div>
        <p className="eyebrow border-b border-hairline pb-2">{t("check.ownerSees")}</p>
        {visible.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("check.nothingVisible")}</p>
        ) : (
          <ul>
            {visible.map((item) => (
              <CheckRow key={item.key} item={item} onTogglePublish={onTogglePublish} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="eyebrow border-b border-hairline pb-2">{t("check.hiddenList")}</p>
        {hidden.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("check.nothingHidden")}</p>
        ) : (
          <ul>
            {hidden.map((item) => (
              <CheckRow key={item.key} item={item} onTogglePublish={onTogglePublish} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CheckRow({
  item,
  onTogglePublish,
  onOpen,
}: {
  item: CheckItem;
  onTogglePublish: (kind: "document" | "report", id: string, next: boolean) => void;
  onOpen: (kind: "document" | "report", id: string) => void;
}) {
  const { t } = useI18n();
  const critical = item.published && item.flags.includes("sensitive");
  return (
    <li
      className={`flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-3 ${
        critical ? "-mx-4 border-l-2 border-l-rose bg-rose/5 px-4" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-2 text-sm">
          <span>{item.title}</span>
          <span
            className={`border px-1.5 py-0.5 text-[9px] tracking-[0.12em] uppercase ${
              item.published
                ? "border-violet text-violet"
                : "border-hairline text-muted-foreground"
            }`}
          >
            {item.published ? t("check.pillVisible") : t("check.pillHidden")}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.meta ? `${item.caption} · ${item.meta}` : item.caption}
        </p>
        {item.flags.length > 0 && item.published && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.flags.map((flag) => (
              <li
                key={flag}
                className={`border px-1.5 py-0.5 text-[9px] tracking-[0.1em] uppercase ${
                  flag === "sensitive"
                    ? "border-rose text-rose"
                    : "border-gold text-gold"
                }`}
              >
                {t(flagKey[flag])}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-6">
        <button
          type="button"
          onClick={() => onOpen(item.kind, item.id)}
          className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
        >
          {t("doc.download")}
        </button>
        <button
          type="button"
          onClick={() => onTogglePublish(item.kind, item.id, !item.published)}
          className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
        >
          {item.published ? t("check.hideItem") : t("check.showItem")}
        </button>
      </div>
    </li>
  );
}
