import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import {
  DOC_CATEGORIES,
  documentsQuery,
  type DocCategory,
  type DocumentRow,
} from "@/lib/portal-queries";
import { getDocumentUrl } from "@/lib/files.functions";
import { logActivity } from "@/lib/activity";
import { useOwnerUnits, useUnitScope } from "@/lib/selected-unit";
import { SkeletonLines } from "@/components/portal/Figures";
import { NoUnits } from "@/components/portal/NoUnits";
import { EmptyState, staggerDelay } from "@/components/portal/EmptyState";
import { UnitHero } from "@/components/portal/UnitHero";
import { FilterTabs } from "@/components/portal/FilterTabs";
import { ScopeTabs } from "@/components/portal/ScopeTabs";
import { DocPreview } from "@/components/portal/DocPreview";
import { stampPaidPdf } from "@/lib/pdf-stamp";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Signed documents for your units at The Umalas Signature, grouped by unit and category as secure downloads.",
      },
      { property: "og:title", content: "Documents — Owner Portal | The Umalas Signature" },
      { property: "og:description", content: "Your signed unit documents, ready to download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { t, lang } = useI18n();
  const { units, selected, select, isLoading, isMulti } = useOwnerUnits();
  const { scope, setScope, crossUnit } = useUnitScope(units, isMulti);
  const scopeUnitId = crossUnit ? undefined : isMulti ? scope : selected?.id;
  const documents = useQuery(documentsQuery(scopeUnitId));
  const fetchUrl = useServerFn(getDocumentUrl);
  const [folder, setFolder] = useState<DocCategory | "all">("all");

  function journal(action: "view" | "download", id: string) {
    const doc = (documents.data ?? []).find((d) => d.id === id);
    const unit = units.find((u) => u.id === doc?.unit_id);
    void logActivity({
      action,
      entityType: "document",
      entityId: id,
      title: doc?.title ?? "",
      unitCode: unit?.code ?? null,
    });
  }

  async function resolveUrl(id: string) {
    const { url } = await fetchUrl({ data: { id } });
    journal("view", id);
    return url;
  }

  async function download(id: string) {
    try {
      const { url } = await fetchUrl({ data: { id } });
      journal("download", id);
      const doc = (documents.data ?? []).find((d) => d.id === id);

      // Payment receipts are stamped "PAID" across the page on download.
      if (doc?.category === "payment_details") {
        const tab = window.open("", "_blank");
        if (!tab) {
          toast.error(t("doc.unavailable"));
          return;
        }
        const stamped = await stampPaidPdf(url, t("rep.paidStamp"), null, lang);
        const blobUrl = URL.createObjectURL(stamped);
        tab.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }

  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <SkeletonLines rows={5} />
      </div>
    );
  if (!selected) return <NoUnits />;

  const codeOf = (unitId: string | null) =>
    units.find((u) => u.id === unitId)?.code ?? "—";
  const rows = documents.data ?? [];
  const visible = folder === "all" ? rows : rows.filter((d) => d.category === folder);
  const tabs = [
    { value: "all" as const, label: t("doc.all"), count: rows.length, alwaysEnabled: true },
    ...DOC_CATEGORIES.map((category) => ({
      value: category,
      label: t(`doc.${category}` as TranslationKey),
      count: rows.filter((d) => d.category === category).length,
    })).filter((tab) => tab.count > 0 || tab.value === folder),

  ];

  // «Все объекты»: a document belongs to one contract, so group by unit first.
  const unitGroups = [...units]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((unit) => ({
      unit,
      items: visible.filter((doc) => doc.unit_id === unit.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="anim-rise mx-auto w-full max-w-[1100px]">
      {isMulti ? (
        <Link
          to="/portfolio"
          className="eyebrow mb-6 inline-flex items-center gap-2 transition-colors duration-200 hover:text-violet"
        >
          <span aria-hidden>←</span>
          {t("portfolio.back")}
        </Link>
      ) : null}
      <UnitHero
        variant="band"
        title={t("doc.title")}
        unit={{
          code: crossUnit ? t("scope.all") : codeOf(scopeUnitId ?? selected.id),
        }}
      />
      <div className="mt-6 flex justify-end">
        <Button asChild className="w-full rounded-sm uppercase tracking-[0.12em] sm:w-auto">
          <Link to="/assistant">{t("assistant.askButton")}</Link>
        </Button>
      </div>

      {isMulti ? (
        <div className="mt-10">
          <ScopeTabs
            units={units}
            scope={scope}
            onChange={(value) => {
              setScope(value);
              if (value !== "all") select(value);
            }}
            countFor={(unitId: string) => rows.filter((d) => d.unit_id === unitId).length}
          />
        </div>
      ) : null}

      {documents.isLoading ? (
        <div className="mt-12">
          <SkeletonLines rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("doc.empty")} hint={t("doc.emptyHint")} />
      ) : (
        <div className="mt-12">
          <FilterTabs tabs={tabs} value={folder} onChange={setFolder} />

          {visible.length === 0 ? (
            <EmptyState
              title={t("doc.emptyFilter")}
              action={
                <button
                  type="button"
                  onClick={() => setFolder("all")}
                  className="text-[11px] tracking-[0.12em] text-violet uppercase underline underline-offset-4"
                >
                  {t("doc.showAll")}
                </button>
              }
            />
          ) : crossUnit ? (
            <div className="mt-12 space-y-16">
              {unitGroups.map((group) => (
                <section key={group.unit.id}>
                  <p className="font-display text-xl leading-none">{group.unit.code}</p>
                  <ul className="mt-4">
                    {group.items.map((doc, index) => (
                      <DocumentRowItem
                        key={doc.id}
                        doc={doc}
                        code={group.unit.code}
                        lang={lang}
                        index={index}
                        onDownload={download}
                        getUrl={resolveUrl}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : folder === "all" ? (
            <div className="mt-12 space-y-16">
              {DOC_CATEGORIES.map((category) => {
                const group = visible.filter((doc) => doc.category === category);
                if (group.length === 0) return null;
                return (
                  <section key={category}>
                    <p className="eyebrow border-b border-hairline pb-3">
                      {t(`doc.${category}` as TranslationKey)}
                    </p>
                    <ul>
                      {group.map((doc, index) => (
                        <DocumentRowItem
                          key={doc.id}
                          doc={doc}
                          lang={lang}
                          index={index}
                          onDownload={download}
                          getUrl={resolveUrl}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <ul className="mt-12">
              {visible.map((doc, index) => (
                <DocumentRowItem
                  key={doc.id}
                  doc={doc}
                  lang={lang}
                  index={index}
                  onDownload={download}
                  getUrl={resolveUrl}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentRowItem({
  doc,
  code,
  lang,
  index,
  onDownload,
  getUrl,
}: {
  doc: {
    id: string;
    title: string;
    issued_date: string | null;
    category?: DocCategory;
    file_path?: string;
  };
  code?: string;
  lang: "ru" | "en";
  index: number;
  onDownload: (id: string) => void;
  getUrl: (id: string) => Promise<string>;
}) {
  const { t } = useI18n();
  return (
    <DocPreview
      id={doc.id}
      title={doc.title}
      subtitle={
        [code, doc.issued_date ? formatDate(doc.issued_date, lang) : null].filter(Boolean).join(" · ") ||
        undefined
      }
      fileName={doc.file_path}
      getUrl={getUrl}
      onDownload={onDownload}
      stampPaid={doc.category === "payment_details"}
      as="li"
      className="row-brand anim-rise flex flex-wrap items-center justify-between gap-4 py-8 last:border-0"
      style={staggerDelay(index)}
    >
      {(openPreview) => (
        <>
          <div className="min-w-0">
            <button
              type="button"
              onClick={openPreview}
              className="cursor-zoom-in text-left text-[15px] leading-6 transition-colors hover:text-violet"
            >
              {code ? <span className="figure mr-3 text-muted-foreground">{code}</span> : null}
              {doc.title}
            </button>
            {doc.issued_date ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {formatDate(doc.issued_date, lang)}
              </p>
            ) : null}
          </div>
          <div className="flex items-baseline gap-6">
            <button
              type="button"
              onClick={openPreview}
              className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
            >
              {t("doc.preview")}
            </button>
            <button
              type="button"
              onClick={() => void onDownload(doc.id)}
              className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
            >
              {t("doc.download")}
            </button>
          </div>
        </>
      )}
    </DocPreview>
  );
}
