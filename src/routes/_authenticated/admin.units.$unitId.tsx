import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import {
  DOC_CATEGORIES,
  REPORT_TYPES,
  allProfilesQuery,
  documentsQuery,
  ownershipsQuery,
  projectsQuery,
  reportsQuery,
  unitsQuery,
  type DocCategory,
  type ReportRow,
  type ReportType,
  type Unit,
} from "@/lib/portal-queries";
import { getDocumentUrl, getReportUrl, getReportReceiptUrl } from "@/lib/files.functions";
import { stampPaidPdf } from "@/lib/pdf-stamp";
import { deleteItem, listOwners, publishUnitDrafts, saveUnit, setPublished, setReportReceipt, updateItem, uploadFiles } from "@/lib/admin.functions";
import { SectionTitle } from "@/components/portal/Figures";
import { InviteTimeline, type OwnerAuthStatus } from "@/components/portal/InviteTimeline";

import { PaidBadge } from "@/components/portal/PaidBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setReportPaymentStatus } from "@/lib/admin.functions";
import type { ReportPaymentStatus } from "@/lib/report-payment-status";
import { PayoutEditor } from "@/components/portal/PayoutEditor";
import { PayoutCalendar } from "@/components/portal/PayoutCalendar";
import { EmptyState } from "@/components/portal/EmptyState";
import { UnitCard } from "@/components/portal/UnitCard";
import { UnitHero } from "@/components/portal/UnitHero";
import { DocumentFolders } from "@/components/portal/DocumentFolders";
import { DocPreview } from "@/components/portal/DocPreview";
import { readUnitPurchase } from "@/lib/purchase-extract.functions";
import { DEFAULT_REPORT_PERIOD, REPORT_PERIODS } from "@/lib/report-periods";

import { VisibilityCheck } from "@/components/portal/VisibilityCheck";

export const Route = createFileRoute("/_authenticated/admin/units/$unitId")({
  head: () => ({ meta: [
    { title: "Unit Management — Owner Portal" },
    { name: "description", content: "Manage owner documents, reports and payout status for an individual unit." },
    { property: "og:title", content: "Unit Management — Owner Portal" },
    { property: "og:description", content: "Owner documents, reports and payout status." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminUnitPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: "admin" | "owner" | "check" | undefined } => ({
    mode:
      search["mode"] === "owner" ? "owner" : search["mode"] === "check" ? "check" : undefined,
  }),
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";
const linkish =
  "text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet";

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return window.btoa(binary);
}

function DraftBadge() {
  const { t } = useI18n();
  return (
    <span className="ml-3 border border-rose px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-rose uppercase">
      {t("admin.draft")}
    </span>
  );
}

function AdminUnitPage() {
  const { unitId } = Route.useParams();
  const { mode: urlMode } = Route.useSearch();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  const units = useQuery(unitsQuery());
  const ownerships = useQuery(ownershipsQuery());
  const profiles = useQuery(allProfilesQuery());
  const documents = useQuery(documentsQuery(unitId));
  const reports = useQuery(reportsQuery(unitId));

  const ownersFn = useServerFn(listOwners);
  const owners = useQuery({ queryKey: ["owners"], queryFn: () => ownersFn({}) });

  const [docFolder, setDocFolder] = useState<DocCategory | "all" | "my_documents">("my_documents");
  const [mode, setMode] = useState<"admin" | "owner" | "check">(urlMode ?? "admin");
  const projects = useQuery(projectsQuery());
  const [editing, setEditing] = useState<string | null>(null);
  const asOwner = mode === "owner";
  const asCheck = mode === "check";

  const docUrl = useServerFn(getDocumentUrl);
  const repUrl = useServerFn(getReportUrl);
  const publish = useServerFn(setPublished);
  const setPaymentStatus = useServerFn(setReportPaymentStatus);
  const saveReceipt = useServerFn(setReportReceipt);
  const receiptUrl = useServerFn(getReportReceiptUrl);
  const publishAll = useServerFn(publishUnitDrafts);
  const removeItem = useServerFn(deleteItem);

  function setModeParam(next: "admin" | "owner" | "check") {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "admin") {
      url.searchParams.delete("mode");
    } else {
      url.searchParams.set("mode", next);
    }
    window.history.replaceState({}, "", url.toString());
  }

  const unit = (units.data ?? []).find((u) => u.id === unitId);
  const projectCode = (projects.data ?? []).find((p) => p.id === unit?.project_id)?.code;
  const loginPath = projectCode === "skystar" ? "/sky-stars" : projectCode === "anoya" ? "/anoya" : "/";
  const today = new Date().toISOString().slice(0, 10);
  const activeOwnerIds = (ownerships.data ?? [])
    .filter(
      (o) => o.unit_id === unitId && (!o.end_date || o.end_date > today),
    )
    .map((o) => o.owner_id);
  const ownerProfiles = activeOwnerIds
    .map((id) => (profiles.data ?? []).find((p) => p.user_id === id))
    .filter(Boolean) as Array<{ user_id: string; full_name: string; email: string }>;
  const ownerNames = ownerProfiles
    .map((p) => p.full_name || p.email)
    .filter(Boolean)
    .join(", ");
  const ownerRows = (owners.data?.owners ?? []) as Array<
    {
      user_id: string;
    } & OwnerAuthStatus
  >;


  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    await queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  async function togglePublish(kind: "document" | "report", id: string, next: boolean) {
    try {
      await publish({ data: { kind, id, publish: next } });
      await refresh();
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  async function publishDrafts() {
    const drafts = allDocRows.filter((doc) => !doc.is_published).length;
    if (drafts === 0) return;
    const ok = window.confirm(
      `Опубликовать ${drafts} черновиков документов для юнита ${unit?.code ?? ""}?`,
    );
    if (!ok) return;
    try {
      const result = await publishAll({ data: { unit_id: unitId } });
      await refresh();
      toast.success(`Опубликовано: ${result.count}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }


  async function togglePaid(id: string, status: ReportPaymentStatus) {
    try {
      await setPaymentStatus({ data: { id, status } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function attachReceipt(reportId: string, file: File) {
    try {
      await saveReceipt({
        data: {
          id: reportId,
          file: {
            name: file.name,
            contentType: file.type || "application/octet-stream",
            contentBase64: await toBase64(file),
          },
        },
      });
      await refresh();
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  async function removeReceipt(reportId: string) {
    const ok = window.confirm(lang === "ru" ? "Удалить квитанцию?" : "Remove receipt?");
    if (!ok) return;
    try {
      await saveReceipt({ data: { id: reportId, file: null } });
      await refresh();
      toast.success(lang === "ru" ? "Удалено" : "Deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  async function openReceipt(reportId: string) {
    try {
      const { url } = await receiptUrl({ data: { id: reportId } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }

  async function remove(kind: "document" | "report", id: string, label: string) {
    const ok = window.confirm(
      lang === "ru" ? `Удалить «${label}» безвозвратно?` : `Delete “${label}” permanently?`,
    );
    if (!ok) return;
    try {
      await removeItem({ data: { kind, id } });
      await refresh();
      toast.success(lang === "ru" ? "Удалено" : "Deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }



  async function docFileUrl(id: string) {
    const { url } = await docUrl({ data: { id } });
    return url;
  }

  async function reportFileUrl(id: string) {
    const { url } = await repUrl({ data: { id } });
    return url;
  }

  async function open(kind: "document" | "report", id: string) {
    try {
      const { url } = kind === "document" ? await docUrl({ data: { id } }) : await repUrl({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }


  async function openReport(report: ReportRow) {
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error(t("doc.unavailable"));
      return;
    }
    try {
      const { url } = await repUrl({ data: { id: report.id } });

      if (report.report_type === "roi" && report.is_paid) {
        const stamped = await stampPaidPdf(
          url,
          t("rep.paidStamp"),
          report.paid_at,
          "en",
        );
        const blobUrl = URL.createObjectURL(stamped);
        tab.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      tab.location.href = url;
    } catch {
      tab.close();
      toast.error(t("doc.unavailable"));
    }
  }

  if (units.isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!unit) return <p className="text-sm text-muted-foreground">{t("admin.unitMissing")}</p>;

  const allDocRows = documents.data ?? [];
  const allRepRows = reports.data ?? [];
  const docRows = asOwner ? allDocRows.filter((d) => d.is_published) : allDocRows;
  const repRows = asOwner ? allRepRows.filter((r) => r.is_published) : allRepRows;
  const roiReports = allRepRows.filter(
    (r) => r.report_type === "roi" && r.is_published && r.net_payout != null,
  );
  const received = roiReports.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0);
  const currency = roiReports[0]?.currency ?? "IDR";

  const modeChip = (value: "admin" | "owner" | "check", label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setModeParam(value)}
      className={`rounded-full px-3 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors ${
        mode === value
          ? "bg-violet text-primary-foreground"
          : "text-muted-foreground hover:text-violet"
      }`}
    >
      {label}
    </button>
  );

  async function copyOwnerPreviewLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "owner");
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success(t("admin.linkCopied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-l-2 border-violet px-4 py-3 text-xs text-muted-foreground ${
            asOwner ? "bg-violet/10" : asCheck ? "bg-gold/10" : "bg-cream"
          }`}
        >
          <span>
            {asCheck ? (
              <>
                {t("check.banner")} — {unit.code}
                {ownerNames ? `, ${ownerNames}` : ""}
              </>
            ) : asOwner ? (
              <>
                {t("admin.ownerView")} — {unit.code}
                {ownerNames ? `, ${ownerNames}` : ""}
              </>
            ) : (
              <>
                {t("admin.adminView")} — {unit.code}, {t("admin.owner")}:{" "}
                {ownerNames || t("admin.noOwner")}
              </>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-hairline p-0.5">
              {modeChip("admin", t("admin.modeAdmin"))}
              {modeChip("owner", t("admin.modeOwner"))}
              {modeChip("check", t("admin.modeCheck"))}
            </span>
            <a
              href={loginPath}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep"
            >
              {t("admin.loginPageView")}
            </a>
            {asOwner && (
              <button
                type="button"
                onClick={copyOwnerPreviewLink}
                className="text-[10px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep"
                title={t("admin.copyOwnerLink")}
              >
                {t("admin.copyOwnerLink")}
              </button>
            )}
            <Link to="/admin/units" className={linkish}>
              {t("admin.backToUnits")}
            </Link>
          </span>
        </div>

        {asOwner && ownerProfiles.length === 0 && (
          <p className="px-4 text-xs text-rose">{t("admin.ownerViewNoOwner")}</p>
        )}

        {!asOwner && ownerProfiles.length > 0 && (
          <ul className="space-y-3 px-4 text-xs text-muted-foreground">
            {ownerProfiles.map((p) => {
              const row = ownerRows.find((o) => o.user_id === p.user_id);
              return (
                <li key={p.user_id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-foreground">{p.full_name || p.email}</span>
                    <Link
                      to="/unit"
                      search={{ unitId: unit.id }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep"
                    >
                      {t("admin.openOwnerCabinet")}
                    </Link>
                  </div>
                  <InviteTimeline status={row ?? {}} />
                </li>
              );
            })}
          </ul>

        )}
      </div>

      <div className="space-y-8">
        <UnitHero variant="band" title={t("unit.title")} unit={unit} />
        <UnitCard
          unit={unit}
          received={received}
          currency={currency}
          hasSummary={roiReports.length > 0}
        />
      </div>

      {!asOwner && !asCheck ? <PurchaseDateEditor unit={unit} /> : null}



      {unit.ma_number || unit.ma_start || unit.ma_end || unit.rental_pool_start ? (
        <div className="flex flex-wrap gap-x-10 gap-y-3 border-t border-hairline pt-4 text-xs text-muted-foreground">
          <span>
            MA № <span className="figure text-foreground">{unit.ma_number ?? "—"}</span>
          </span>
          <span>
            MA start{" "}
            <span className="figure text-foreground">{formatDate(unit.ma_start, lang)}</span>
          </span>
          <span>
            MA end <span className="figure text-foreground">{formatDate(unit.ma_end, lang)}</span>
          </span>
          <span>
            {lang === "ru" ? "В пуле с" : "In pool since"}{" "}
            <span className="figure text-foreground">{formatDate(unit.rental_pool_start, lang)}</span>
          </span>
        </div>
      ) : null}


      {asCheck ? (
        <div>
          <SectionTitle note={unit.code}>{t("check.title")}</SectionTitle>
          <VisibilityCheck
            unitCode={unit.code}
            documents={allDocRows}
            reports={allRepRows}
            hasOwner={ownerProfiles.length > 0}
            onTogglePublish={(kind, id, next) => void togglePublish(kind, id, next)}
            onOpen={(kind, id) => void open(kind, id)}
          />
        </div>
      ) : null}

      <div className={asCheck ? "hidden" : ""}>
        <SectionTitle>{t("doc.title")}</SectionTitle>
        {!asOwner && allDocRows.some((doc) => !doc.is_published) ? (
          <button
            type="button"
            className="mb-4 text-[11px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
            onClick={() => void publishDrafts()}
          >
            Опубликовать все черновики (
            {allDocRows.filter((doc) => !doc.is_published).length})
          </button>
        ) : null}

        {docRows.length === 0 ? (
          asOwner ? (
            <EmptyState title={t("doc.empty")} hint={t("unit.noneHint")} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("doc.empty")}</p>
          )
        ) : (
          <>
            <DocumentFolders rows={docRows} selected={docFolder} onSelect={setDocFolder} t={t} />
            {docFolder === "all" || docFolder === "my_documents"
              ? DOC_CATEGORIES.map((category) => {
                  const group = docRows.filter((doc) => doc.category === category);
                  if (group.length === 0) return null;
                  return (
                    <section key={category} className="mb-8">
                      <p className="eyebrow border-b border-hairline pb-2">
                        {t(`doc.${category}` as TranslationKey)}
                      </p>
                      <ul>
                        {group.map((doc) => (
                          <AdminDocumentRow
                            key={doc.id}
                            doc={doc}
                            lang={lang}
                            asOwner={asOwner}
                            onOpen={() => void open("document", doc.id)}
                            getUrl={docFileUrl}

                            onToggle={() =>
                              void togglePublish("document", doc.id, !doc.is_published)
                            }
                            onDelete={() => void remove("document", doc.id, doc.title)}
                            editing={editing === doc.id}
                            onEdit={() => setEditing(editing === doc.id ? null : doc.id)}
                            onSaved={() => {
                              setEditing(null);
                              void refresh();
                            }}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })
              : docRows.filter((d) => d.category === docFolder).length > 0 && (
                  <ul>
                    {docRows
                      .filter((d) => d.category === docFolder)
                      .map((doc) => (
                        <AdminDocumentRow
                          key={doc.id}
                          doc={doc}
                          lang={lang}
                          asOwner={asOwner}
                          onOpen={() => void open("document", doc.id)}
                          getUrl={docFileUrl}

                          onToggle={() =>
                            void togglePublish("document", doc.id, !doc.is_published)
                          }
                          onDelete={() => void remove("document", doc.id, doc.title)}
                          editing={editing === doc.id}
                          onEdit={() => setEditing(editing === doc.id ? null : doc.id)}
                          onSaved={() => {
                            setEditing(null);
                            void refresh();
                          }}
                        />
                      ))}
                  </ul>
                )}
          </>
        )}
      </div>

      <div className={asCheck ? "hidden" : ""}>
        <SectionTitle>{t("rep.title")}</SectionTitle>
        {repRows.length === 0 ? (
          asOwner ? (
            <EmptyState title={t("rep.empty")} hint={t("unit.summaryNote")} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("rep.empty")}</p>
          )
        ) : (
          <ul>
            {repRows.map((report) => (
              <li
                key={report.id}
                className="border-b border-hairline py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm">
                    {report.period_label}
                    {!asOwner && !report.is_published && <DraftBadge />}
                  </p>
                  <p className="eyebrow mt-1">{t(`rep.${report.report_type}` as TranslationKey)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  {(report.report_type === "roi" || report.net_payout != null) && (
                    <PaidBadge paid={report.is_paid} paidAt={report.paid_at} noRoiPayment={report.no_roi_payment} />
                  )}
                  {report.net_payout != null && (
                    <span className="figure text-sm">
                      {formatMoney(Number(report.net_payout), report.currency, lang)}
                    </span>
                  )}
                  <ReportPreviewButton report={report} getUrl={reportFileUrl} />
                  <button type="button" className={linkish} onClick={() => void openReport(report)}>

                    {t("rep.download")}
                  </button>
                  {report.receipt_path && (
                    <button
                      type="button"
                      className="text-[11px] tracking-[0.12em] text-violet uppercase transition-colors hover:text-violet-deep"
                      onClick={() => void openReceipt(report.id)}
                    >
                      {t("rep.receipt")}
                    </button>
                  )}
                  {!asOwner && (
                    <label className={`${linkish} cursor-pointer`}>
                      {report.receipt_path ? t("rep.receiptReplace") : t("rep.receiptAttach")}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*,.txt,.doc,.docx,.xls,.xlsx,text/plain"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void attachReceipt(report.id, file);
                        }}
                      />
                    </label>
                  )}
                  {!asOwner && report.receipt_path && (
                    <button
                      type="button"
                      className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-rose"
                      onClick={() => void removeReceipt(report.id)}
                    >
                      {t("rep.receiptRemove")}
                    </button>
                  )}
                  {!asOwner && (
                    <button
                      type="button"
                      className={linkish}
                      onClick={() => void togglePublish("report", report.id, !report.is_published)}
                    >
                      {report.is_published ? t("admin.unpublish") : t("admin.publish")}
                    </button>
                  )}
                  {!asOwner && (
                    <Select value={report.no_roi_payment ? "no_roi" : report.is_paid ? "paid" : "unpaid"} onValueChange={(status: ReportPaymentStatus) => void togglePaid(report.id, status)}>
                      <SelectTrigger aria-label={`${report.period_label} — ${t("rep.filterStatus")}`} className="w-[190px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">{t("rep.unpaid")}</SelectItem>
                        <SelectItem value="paid">{t("rep.paid")}</SelectItem>
                        <SelectItem value="no_roi" disabled={report.report_type !== "roi" || report.net_payout !== 0}>{t("rep.noRoiPayment")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {!asOwner && (
                    <button
                      type="button"
                      className={linkish}
                      onClick={() => setEditing(editing === report.id ? null : report.id)}
                    >
                      {lang === "ru" ? "Редактировать" : "Edit"}
                    </button>
                  )}
                  {!asOwner && (
                    <button
                      type="button"
                      className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-rose"
                      onClick={() => void remove("report", report.id, report.period_label)}
                    >
                      {lang === "ru" ? "Удалить" : "Delete"}
                    </button>
                  )}
                </div>
                </div>
                {!asOwner && editing === report.id && (
                  <ReportEditForm
                    report={report}
                    lang={lang}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      void refresh();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {!asOwner && (
          <PayoutEditor reports={allRepRows} unitId={unitId} lang={lang} onSaved={() => void refresh()} />
        )}

        <PayoutCalendar
          reports={allRepRows}
          lang={lang}
          editable={!asOwner}
          onSaved={() => void refresh()}
        />
      </div>


      {!asOwner && !asCheck && <UnitUpload unitId={unitId} onDone={() => void refresh()} />}
    </div>
  );
}

function ReportPreviewButton({
  report,
  getUrl,
}: {
  report: ReportRow;
  getUrl: (id: string) => Promise<string>;
}) {
  const { t } = useI18n();
  return (
    <DocPreview
      id={report.id}
      title={report.period_label}
      fileName={report.file_path}
      getUrl={getUrl}
      stampPaid={report.report_type === "roi" && report.is_paid}
      paidAt={report.paid_at}
      className="inline-flex"
    >
      {(openPreview) => (
        <button type="button" className={linkish} onClick={openPreview}>
          {t("doc.preview")}
        </button>
      )}
    </DocPreview>
  );
}

function AdminDocumentRow({

  doc,
  lang,
  asOwner = false,
  onOpen,
  getUrl,
  onToggle,
  onDelete,
  editing = false,
  onEdit,
  onSaved,
}: {
  doc: {
    id: string;
    title: string;
    issued_date: string | null;
    is_published: boolean;
    category?: DocCategory;
    file_path?: string;
  };
  lang: "ru" | "en";
  asOwner?: boolean;
  onOpen: () => void;
  getUrl: (id: string) => Promise<string>;
  onToggle: () => void;
  onDelete?: () => void;
  editing?: boolean;
  onEdit?: () => void;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  return (
    <DocPreview
      id={doc.id}
      title={doc.title}
      subtitle={doc.issued_date ? formatDate(doc.issued_date, lang) : undefined}
      fileName={doc.file_path}
      getUrl={getUrl}
      as="li"
      className="border-b border-hairline py-3"
    >
      {(openPreview) => (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openPreview}
                className="cursor-zoom-in text-left text-sm transition-colors hover:text-violet"
              >
                {doc.title}
              </button>
              {!asOwner && !doc.is_published && <DraftBadge />}
              {doc.issued_date ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(doc.issued_date, lang)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-baseline gap-6">
              <button type="button" className={linkish} onClick={openPreview}>
                {t("doc.preview")}
              </button>
              <button type="button" className={linkish} onClick={onOpen}>
                {t("doc.download")}
              </button>
              {!asOwner && (
                <button type="button" className={linkish} onClick={onToggle}>
                  {doc.is_published ? t("admin.unpublish") : t("admin.publish")}
                </button>
              )}
              {!asOwner && onEdit && (
                <button type="button" className={linkish} onClick={onEdit}>
                  {lang === "ru" ? "Редактировать" : "Edit"}
                </button>
              )}
              {!asOwner && onDelete && (
                <button
                  type="button"
                  className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-rose"
                  onClick={onDelete}
                >
                  {lang === "ru" ? "Удалить" : "Delete"}
                </button>
              )}
            </div>
          </div>
          {!asOwner && editing && (
            <DocumentEditForm
              doc={doc}
              lang={lang}
              onClose={() => onEdit?.()}
              onSaved={() => onSaved?.()}
            />
          )}
        </>
      )}
    </DocPreview>
  );
}


const editRow = "grid gap-4 pt-4 sm:grid-cols-4";

function EditActions({
  lang,
  busy,
  onClose,
}: {
  lang: "ru" | "en";
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-4 pt-4">
      <button type="submit" className={button} disabled={busy}>
        {lang === "ru" ? "Сохранить" : "Save"}
      </button>
      <button type="button" className={linkish} onClick={onClose}>
        {lang === "ru" ? "Отмена" : "Cancel"}
      </button>
    </div>
  );
}

function DocumentEditForm({
  doc,
  lang,
  onClose,
  onSaved,
}: {
  doc: { id: string; title: string; issued_date: string | null; category?: DocCategory };
  lang: "ru" | "en";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const save = useServerFn(updateItem);
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState<DocCategory>(doc.category ?? "other");
  const [issued, setIssued] = useState(doc.issued_date ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: { kind: "document", id: doc.id, title, category, issued_date: issued || null },
      });
      toast.success(t("admin.saved"));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pb-2">
      <div className={editRow}>
        <label className="block text-xs text-muted-foreground sm:col-span-2">
          {lang === "ru" ? "Название" : "Title"}
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Категория" : "Category"}
          <select
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value as DocCategory)}
          >
            {DOC_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`doc.${value}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Дата" : "Date"}
          <input
            type="date"
            className={field}
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
          />
        </label>
      </div>
      <EditActions lang={lang} busy={busy} onClose={onClose} />
    </form>
  );
}

function ReportEditForm({
  report,
  lang,
  onClose,
  onSaved,
}: {
  report: ReportRow;
  lang: "ru" | "en";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const save = useServerFn(updateItem);
  const [label, setLabel] = useState(report.period_label);
  const [type, setType] = useState<ReportType>(report.report_type);
  const [payout, setPayout] = useState(report.net_payout != null ? String(report.net_payout) : "");
  const [currency, setCurrency] = useState(report.currency);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          kind: "report",
          id: report.id,
          period_label: label,
          report_type: type,
          net_payout: payout === "" ? null : payout,
          currency,
        },
      });
      toast.success(t("admin.saved"));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pb-2">
      <div className={editRow}>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Период" : "Period"}
          <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Тип" : "Type"}
          <select
            className={field}
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
          >
            {REPORT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`rep.${value}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Сумма выплаты" : "Net payout"}
          <input
            inputMode="decimal"
            className={field}
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          {lang === "ru" ? "Валюта" : "Currency"}
          <select
            className={field}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["IDR", "USD", "EUR", "AUD", "GBP", "RUB"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EditActions lang={lang} busy={busy} onClose={onClose} />
    </form>
  );
}


function UnitUpload({ unitId, onDone }: { unitId: string; onDone: () => void }) {
  const { t } = useI18n();
  const upload = useServerFn(uploadFiles);
  const [kind, setKind] = useState<"document" | "report">("report");
  const [category, setCategory] = useState<DocCategory>("lease_agreement");
  const [reportType, setReportType] = useState<ReportType>("roi");
  const [periodLabel, setPeriodLabel] = useState<string>(DEFAULT_REPORT_PERIOD.label);
  const [periodStart, setPeriodStart] = useState<string>(DEFAULT_REPORT_PERIOD.start);
  const [periodEnd, setPeriodEnd] = useState<string>(DEFAULT_REPORT_PERIOD.end);
  const [netPayout, setNetPayout] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const payloadFiles = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          contentBase64: await toBase64(file),
        })),
      );
      await upload({
        data: {
          unit_id: unitId,
          kind,
          category,
          report_type: reportType,
          period_label: periodLabel,
          period_start: periodStart,
          period_end: periodEnd,
          issued_date: null,
          net_payout: netPayout ? Number(netPayout) : null,
          currency: "IDR",
          publish: publishNow,
          files: payloadFiles,
        },
      });
      setFiles([]);
      setPeriodLabel(DEFAULT_REPORT_PERIOD.label);
      setPeriodStart(DEFAULT_REPORT_PERIOD.start);
      setPeriodEnd(DEFAULT_REPORT_PERIOD.end);
      setNetPayout("");
      onDone();
      toast.success(t("admin.uploadDone"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const ready = files.length > 0 && (kind === "document" || periodLabel.trim().length > 0);

  return (
    <div>
      <SectionTitle>{t("admin.upload")}</SectionTitle>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">{t("admin.kind")}</span>
          <select
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as "document" | "report")}
          >
            <option value="report">{t("admin.kindReport")}</option>
            <option value="document">{t("admin.kindDocument")}</option>
          </select>
        </label>

        {kind === "report" ? (
          <>
            <label className="block">
              <span className="eyebrow">{t("admin.reportType")}</span>
              <select
                className={field}
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`rep.${type}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.periodLabel")}</span>
              <select
                className={field}
                value={periodLabel}
                onChange={(e) => {
                  const selected = REPORT_PERIODS.find((period) => period.label === e.target.value);
                  if (!selected) return;
                  setPeriodLabel(selected.label);
                  setPeriodStart(selected.start);
                  setPeriodEnd(selected.end);
                }}
              >
                {REPORT_PERIODS.map((period) => (
                  <option key={period.label} value={period.label}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.netPayout")}</span>
              <input
                className={field}
                inputMode="decimal"
                value={netPayout}
                onChange={(e) => setNetPayout(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="eyebrow">{t("admin.category")}</span>
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value as DocCategory)}
            >
              {DOC_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(`doc.${value}` as TranslationKey)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="eyebrow">{t("admin.files")}</span>
          <input
            type="file"
            multiple
            className="mt-2 w-full text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        <label className="flex items-center gap-3 self-end text-sm">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
            className="accent-violet"
          />
          {t("admin.publishNow")}
        </label>
      </div>
      <button
        type="button"
        className={`${button} mt-6`}
        disabled={busy || !ready}
        onClick={() => void submit()}
      >
        {t("admin.uploadSubmit")}
      </button>
    </div>
  );
}

function PurchaseDateEditor({ unit }: { unit: Unit }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(saveUnit);
  const [date, setDate] = useState(unit.purchase_date ?? "");
  const [poolStart, setPoolStart] = useState(unit.rental_pool_start ?? "");
  const formatThousands = (raw: string) => {
    const [int = "", dec] = raw.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return dec !== undefined ? `${grouped}.${dec}` : grouped;
  };
  const [price, setPrice] = useState(
    unit.purchase_price != null ? formatThousands(String(Number(unit.purchase_price))) : "",
  );
  const [currency, setCurrency] = useState(unit.purchase_currency || "IDR");
  const [noVat, setNoVat] = useState(unit.is_investment_contract === true);
  const [projectId, setProjectId] = useState(unit.project_id ?? "");
  const projects = useQuery(projectsQuery());
  const [vatRate, setVatRate] = useState(
    unit.vat_rate != null ? String(Number(unit.vat_rate)) : "10",
  );
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const readPurchase = useServerFn(readUnitPurchase);
  const autoTried = useRef<string | null>(null);

  /** Pulls price / VAT / date out of the unit's contract PDFs into the fields. */
  async function readFromDocs(silent = false) {
    setReading(true);
    try {
      const { suggestion } = await readPurchase({ data: { unitId: unit.id } });
      if (!suggestion) {
        if (!silent) {
          toast.error(
            lang === "ru" ? "В документах данных не найдено" : "Nothing found in documents",
          );
        }
        return;
      }
      if (suggestion.price != null) {
        setPrice(formatThousands(String(suggestion.price)));
        if (suggestion.currency) setCurrency(suggestion.currency);
      }
      if (suggestion.vatRate != null) setVatRate(String(suggestion.vatRate));
      if (suggestion.date) setDate(suggestion.date);
      setFound(suggestion.source || null);
      if (!silent) {
        toast.success(lang === "ru" ? "Данные считаны — проверьте и сохраните" : "Read — review and save");
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setReading(false);
    }
  }

  // A unit with no purchase data reads its contracts automatically on open.
  useEffect(() => {
    if (unit.purchase_price != null && unit.purchase_date) return;
    if (autoTried.current === unit.id) return;
    autoTried.current = unit.id;
    void readFromDocs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);

  const cleaned = price.replace(/[^0-9.]/g, "");
  const parsedPrice = cleaned === "" ? null : Number(cleaned);
  const parsedRate = vatRate.trim() === "" ? null : Number(vatRate.replace(",", "."));
  const invalidRate =
    parsedRate == null || Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100;
  const invalid = (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) || invalidRate;
  const dirty =
    (date || null) !== (unit.purchase_date ?? null) ||
    (poolStart || null) !== (unit.rental_pool_start ?? null) ||
    parsedPrice !== (unit.purchase_price != null ? Number(unit.purchase_price) : null) ||
    currency !== (unit.purchase_currency || "IDR") ||
    parsedRate !== (unit.vat_rate != null ? Number(unit.vat_rate) : 10) ||
    noVat !== (unit.is_investment_contract === true) ||
    (projectId || null) !== (unit.project_id ?? null);

  async function submit() {
    if (invalid) return;
    setBusy(true);
    try {
      await save({
        data: {
          id: unit.id,
          code: unit.code,
          project_id: projectId || null,
          building: unit.building,
          floor: unit.floor,
          unit_type: unit.unit_type,
          purchase_price: parsedPrice,
          purchase_currency: currency,
          purchase_date: date || null,
          coefficient: unit.coefficient != null ? Number(unit.coefficient) : null,
          is_investment_contract: noVat,
          vat_rate: parsedRate,
          ma_number: unit.ma_number,
          ma_start: unit.ma_start,
          ma_end: unit.ma_end,
          rental_pool_start: poolStart || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-hairline pt-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {t("unit.price")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            placeholder="0"
            maxLength={25}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^0-9.]/g, "");
              setPrice(raw === "" ? "" : formatThousands(raw));
            }}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {t("admin.project")}
          </span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={field}
          >
            <option value="">{t("common.none")}</option>
            {(projects.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {lang === "ru" ? "Валюта" : "Currency"}
          </span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className={field}
          >
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {lang === "ru" ? "Ставка НДС, %" : "VAT rate, %"}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={vatRate}
            placeholder="10"
            maxLength={5}
            disabled={noVat}
            onChange={(event) => setVatRate(event.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {t("admin.purchaseDate")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {lang === "ru" ? "В рентном пуле с" : "In rental pool since"}
          </span>
          <input
            type="date"
            value={poolStart}
            onChange={(event) => setPoolStart(event.target.value)}
            className={field}
          />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={noVat}
            onChange={(event) => setNoVat(event.target.checked)}
            className="accent-violet"
          />
          <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {lang === "ru" ? "Без НДС (инвестдоговор)" : "No VAT (investment contract)"}
          </span>
        </label>
      </div>
      {invalid ? (
        <p className="mt-3 text-xs text-rose">
          {lang === "ru" ? "Некорректная сумма" : "Invalid amount"}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={button}
          disabled={busy || invalid || !dirty}
          onClick={() => void submit()}
        >
          {t("admin.save")}
        </button>
        <button
          type="button"
          className="text-[11px] tracking-[0.14em] text-violet uppercase underline-offset-4 hover:underline disabled:opacity-50"
          disabled={reading}
          onClick={() => void readFromDocs()}
        >
          {reading
            ? lang === "ru"
              ? "Чтение документов…"
              : "Reading documents…"
            : lang === "ru"
              ? "Считать из документов"
              : "Read from documents"}
        </button>
      </div>
      {found ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {lang === "ru" ? "Из документа: " : "From document: "}
          {found}
        </p>
      ) : null}
    </div>
  );
}
