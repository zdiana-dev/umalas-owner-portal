import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { allProfilesQuery, unitsQuery } from "@/lib/portal-queries";
import { importUnitRow } from "@/lib/admin.functions";
import {
  IMPORT_COLUMNS,
  SAMPLE_CSV,
  buildPreview,
  type Preview,
  type PreviewRow,
} from "@/lib/csv-import";
import { SectionTitle } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({
    meta: [
      { title: "Import units and owners — The Umalas Signature" },
      {
        name: "description",
        content:
          "Bulk import units and owners from a CSV file with a validated preview before anything is written.",
      },
      { property: "og:title", content: "Import units and owners — The Umalas Signature" },
      { property: "og:description", content: "CSV import with preview and validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";
const ghost =
  "text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground";

type Failure = { line: number; code: string; reason: string };

function Chip({ tone, children }: { tone: "new" | "update" | "skip" | "muted"; children: string }) {
  const styles = {
    new: "border-violet/30 bg-violet/10 text-violet",
    update: "border-teal/30 bg-teal/10 text-teal",
    skip: "border-rose/30 bg-rose/10 text-rose",
    muted: "border-hairline text-muted-foreground",
  }[tone];
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase ${styles}`}
    >
      {children}
    </span>
  );
}

function ImportPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const importRow = useServerFn(importUnitRow);

  const units = useQuery(unitsQuery());
  const profiles = useQuery(allProfilesQuery());

  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [sendInvites, setSendInvites] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [summary, setSummary] = useState<{
    units: number;
    owners: number;
    links: number;
    invites: number;
    failures: Failure[];
  } | null>(null);

  const labels = {
    emptyFile: t("import.errEmpty"),
    missingColumns: t("import.errMissingColumns"),
    noUnitCode: t("import.errNoCode"),
    duplicateInFile: t("import.errDuplicate"),
    noEmail: t("import.noteNoEmail"),
    badEmail: t("import.noteBadEmail"),
    noName: t("import.noteNoName"),
    badCoefficient: t("import.noteBadCoefficient"),
    extraEmails: t("import.noteExtraEmails"),

  };

  const preview: Preview | null = useMemo(() => {
    if (!text) return null;
    return buildPreview(text, {
      unitCodes: new Set((units.data ?? []).map((u) => u.code.toUpperCase())),
      ownerEmails: new Set(
        (profiles.data ?? []).map((p) => (p.email ?? "").toLowerCase()).filter(Boolean),
      ),
    }, labels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, units.data, profiles.data]);

  const importable = (preview?.rows ?? []).filter((r) => r.unitStatus !== "skipped");

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "umalas-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pickFile(file: File | null | undefined) {
    if (!file) return;
    setSummary(null);
    setDone(0);
    setFileName(file.name);
    setText(await file.text());
  }

  async function runImport(rows: PreviewRow[]) {
    setRunning(true);
    setDone(0);
    const failures: Failure[] = [];
    let createdUnits = 0;
    let createdOwners = 0;
    let createdLinks = 0;
    let invites = 0;
    const origin = typeof window === "undefined" ? null : window.location.origin;

    for (const row of rows) {
      try {
        const result = await importRow({
          data: {
            unit_code: row.unit_code,
            building: row.building,
            floor: row.floor,
            unit_type: row.unit_type,
            coefficient: row.coefficient,
            ma_number: row.ma_number,
            ma_start: row.ma_start,
            ma_end: row.ma_end,
            owner_full_name: row.owner_full_name,
            owner_email: row.owner_email,
            owner_phone: row.owner_phone,
            preferred_language: "ru",
            send_invite: sendInvites,
            redirect_to: origin,
          },
        });
        if (result.unitCreated) createdUnits += 1;
        if (result.ownerCreated) createdOwners += 1;
        if (result.linked) createdLinks += 1;
        if (result.invited) invites += 1;
      } catch (error) {
        failures.push({
          line: row.line,
          code: row.unit_code,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      setDone((n) => n + 1);
    }

    await queryClient.invalidateQueries({ queryKey: ["units"] });
    await queryClient.invalidateQueries({ queryKey: ["ownerships"] });
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "owners"] });

    setSummary({
      units: createdUnits,
      owners: createdOwners,
      links: createdLinks,
      invites,
      failures,
    });
    setRunning(false);
    if (failures.length === 0) toast.success(t("import.finished"));
    else toast.error(t("import.finishedWithErrors"));
  }

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <SectionTitle>{t("import.title")}</SectionTitle>
        <p className="border-l-2 border-violet bg-cream px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("import.help")} {IMPORT_COLUMNS.join(", ")}
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <label className={`${button} cursor-pointer`}>
            {t("import.choose")}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
          </label>
          <button type="button" className={ghost} onClick={downloadSample}>
            {t("import.sample")}
          </button>
          {fileName ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
        </div>
      </section>

      {preview ? (
        <>
          <section className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: t("import.totalCreate"), value: preview.totals.unitsToCreate },
              { label: t("import.totalUpdate"), value: preview.totals.unitsToUpdate },
              { label: t("import.totalInvite"), value: preview.totals.ownersToInvite },
              { label: t("import.totalExisting"), value: preview.totals.ownersExisting },
              { label: t("import.totalSkipped"), value: preview.totals.skipped },
            ].map((item) => (
              <div key={item.label} className="border-t border-hairline pt-3">
                <p className="eyebrow">{item.label}</p>
                <p className="figure mt-2 text-2xl">{item.value}</p>
              </div>
            ))}
          </section>

          {preview.totals.multiUnitOwners > 0 ? (
            <p className="text-xs text-muted-foreground">
              {preview.totals.multiUnitOwners} {t("import.multiUnitOwners")}
            </p>
          ) : null}

          {preview.malformed.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle>{t("import.malformed")}</SectionTitle>
              <ul className="space-y-2 text-xs text-rose">
                {preview.malformed.map((m, i) => (
                  <li key={i}>
                    {t("import.line")} {m.line} — {m.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-4">
            <SectionTitle>{t("import.preview")}</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    {[
                      t("import.line"),
                      t("admin.code"),
                      t("unit.building"),
                      t("unit.coefficient"),
                      t("admin.owner"),
                      t("import.status"),
                      t("import.notes"),
                    ].map((h) => (
                      <th key={h} className="eyebrow py-2 pr-4 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.line} className="border-b border-hairline/70 align-top">
                      <td className="figure py-3 pr-4 text-xs text-muted-foreground">{row.line}</td>
                      <td className="figure py-3 pr-4">{row.unit_code}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {row.building ?? "—"}
                        {row.floor != null ? ` · ${row.floor}` : ""}
                      </td>
                      <td className="figure py-3 pr-4 text-xs">
                        {row.coefficient != null ? row.coefficient.toFixed(2) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span className="text-foreground">{row.owner_full_name ?? "—"}</span>
                        {row.owner_email ? (
                          <span className="block text-muted-foreground">{row.owner_email}</span>
                        ) : null}
                      </td>
                      <td className="space-y-1 py-3 pr-4">
                        {row.unitStatus === "skipped" ? (
                          <Chip tone="skip">{t("import.statusSkipped")}</Chip>
                        ) : row.unitStatus === "new_unit" ? (
                          <Chip tone="new">{t("import.statusNewUnit")}</Chip>
                        ) : (
                          <Chip tone="update">{t("import.statusUpdateUnit")}</Chip>
                        )}
                        <div>
                          {row.ownerStatus === "new_owner" ? (
                            <Chip tone="new">{t("import.statusNewOwner")}</Chip>
                          ) : row.ownerStatus === "existing_owner" ? (
                            <Chip tone="update">{t("import.statusExistingOwner")}</Chip>
                          ) : (
                            <Chip tone="muted">{t("import.statusNoOwner")}</Chip>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {[row.skipReason, ...row.notes].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-violet"
                checked={sendInvites}
                onChange={(e) => setSendInvites(e.target.checked)}
              />
              <span>
                {t("import.sendInvites")}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t("import.sendInvitesNote")}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                className={button}
                disabled={running || importable.length === 0}
                onClick={() => void runImport(importable)}
              >
                {t("import.confirm")} ({importable.length})
              </button>
              {running ? (
                <span className="figure text-xs text-muted-foreground">
                  {done} / {importable.length}
                </span>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {summary ? (
        <section className="space-y-4">
          <SectionTitle>{t("import.summary")}</SectionTitle>
          <ul className="space-y-1 text-sm">
            <li>
              {t("import.createdUnits")}: <span className="figure">{summary.units}</span>
            </li>
            <li>
              {t("import.createdOwners")}: <span className="figure">{summary.owners}</span>
            </li>
            <li>
              {t("import.createdLinks")}: <span className="figure">{summary.links}</span>
            </li>
            <li>
              {t("import.sentInvites")}: <span className="figure">{summary.invites}</span>
            </li>
          </ul>
          {summary.failures.length > 0 ? (
            <div className="space-y-2">
              <p className="eyebrow text-rose">{t("import.failures")}</p>
              <ul className="space-y-1 text-xs text-rose">
                {summary.failures.map((f, i) => (
                  <li key={i}>
                    {t("import.line")} {f.line} · {f.code} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("import.noFailures")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
