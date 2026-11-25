import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { DOC_CATEGORIES, REPORT_TYPES, unitsQuery, type DocCategory, type ReportType } from "@/lib/portal-queries";
import { uploadFiles } from "@/lib/admin.functions";
import { DEFAULT_REPORT_PERIOD, REPORT_PERIODS } from "@/lib/report-periods";
import { SectionTitle } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  head: () => ({
    meta: [
      { title: "Upload — Administration | The Umalas Signature" },
      { name: "description", content: "Upload owner documents and reports for The Umalas Signature." },
      { property: "og:title", content: "Upload — Administration | The Umalas Signature" },
      { property: "og:description", content: "Upload owner documents and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return window.btoa(binary);
}

/** Real archive filenames start with a type token: "MA A102 ...", "BAST A102-...". */
const FILENAME_CATEGORY: Record<string, DocCategory> = {
  ma: "management_agreement",
  bast: "bast",
  mou: "mou",
  cla: "mou",
  ila: "mou",
  la: "lease_agreement",
  lease: "lease_agreement",
  addendum: "addendum",
  resale: "resale_agreement",
  bf: "booking_form",
  booking: "booking_form",
  invoice: "payment_details",
  inv: "payment_details",
  payment: "payment_details",
  pd: "payment_details",
  receipt: "payment_details",
  kvitanciya: "payment_details",
  "квитанция": "payment_details",
  requisites: "bank_details",
  rekvizity: "bank_details",
  "реквизиты": "bank_details",
};


function guessFromFilename(name: string): { category: DocCategory | null; title: string } {
  const title = name.replace(/\.[^.]+$/, "");
  const token = title.split(/[\s_\-.]+/)[0]?.toLowerCase() ?? "";
  return { category: FILENAME_CATEGORY[token] ?? null, title };
}

function UploadPage(){
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const units = useQuery(unitsQuery());
  const upload = useServerFn(uploadFiles);

  const [unitId, setUnitId] = useState("");
  const [kind, setKind] = useState<"document" | "report">("report");
  const [category, setCategory] = useState<DocCategory>("lease_agreement");
  const [reportType, setReportType] = useState<ReportType>("roi");
  const [periodLabel, setPeriodLabel] = useState<string>(DEFAULT_REPORT_PERIOD.label);
  const [periodStart, setPeriodStart] = useState<string>(DEFAULT_REPORT_PERIOD.start);
  const [periodEnd, setPeriodEnd] = useState<string>(DEFAULT_REPORT_PERIOD.end);
  const [issuedDate, setIssuedDate] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [netPayout, setNetPayout] = useState("");
  const [publish, setPublish] = useState(false);
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
          period_start: periodStart || null,
          period_end: periodEnd || null,
          issued_date: issuedDate || null,
          title: docTitle.trim() || null,
          net_payout: netPayout ? Number(netPayout) : null,
          currency: "IDR",
          publish,
          files: payloadFiles,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setFiles([]);
      setDocTitle("");
      setPeriodLabel(DEFAULT_REPORT_PERIOD.label);
      setPeriodStart(DEFAULT_REPORT_PERIOD.start);
      setPeriodEnd(DEFAULT_REPORT_PERIOD.end);
      setNetPayout("");
      toast.success(t("admin.uploadDone"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(unitId) && files.length > 0 && (kind === "document" || periodLabel.trim());

  return (
    <div className="space-y-8">
      <SectionTitle>{t("admin.upload")}</SectionTitle>

      <p className="border-l-2 border-rose bg-cream px-4 py-3 text-xs text-muted-foreground">
        {t("admin.publishWarning")}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">{t("admin.unit")}</span>
          <select className={field} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">—</option>
            {(units.data ?? []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code}
              </option>
            ))}
          </select>
        </label>

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
                  setPeriodLabel(e.target.value);
                  if (selected) {
                    setPeriodStart(selected.start);
                    setPeriodEnd(selected.end);
                  }
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
              <span className="eyebrow">{t("admin.periodStart")}</span>
              <input
                type="date"
                className={field}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.periodEnd")}</span>
              <input
                type="date"
                className={field}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
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
          <>
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
            <label className="block">
              <span className="eyebrow">{t("admin.title.field")}</span>
              <input
                className={field}
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={files.length === 1 ? files[0]!.name : ""}
              />
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.issuedDate")}</span>
              <input
                type="date"
                className={field}
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="eyebrow">{t("admin.files")}</span>
          <input
            type="file"
            multiple
            className="mt-2 w-full text-sm"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles(picked);
              const first = picked[0];
              if (first) {
                const guess = guessFromFilename(first.name);
                if (guess.category) {
                  setCategory(guess.category);
                  setKind("document");
                }
                if (picked.length === 1) setDocTitle(guess.title);
              }
            }}
          />
        </label>

        <label className="flex items-center gap-3 self-end text-sm">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="accent-violet"
          />
          {t("admin.publishNow")}
        </label>
      </div>

      <button type="button" className={button} disabled={busy || !ready} onClick={() => void submit()}>
        {t("admin.uploadSubmit")}
      </button>
    </div>
  );
}
