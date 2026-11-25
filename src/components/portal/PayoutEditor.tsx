import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { updateItem } from "@/lib/admin.functions";
import { extractUnitPayouts } from "@/lib/payouts.functions";
import type { ReportRow } from "@/lib/portal-queries";
import { SectionTitle } from "@/components/portal/Figures";

const field =
  "w-full border-b border-input bg-transparent pb-1 text-right text-sm tabular-nums outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";

function group(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function toNumber(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export function PayoutEditor({
  reports,
  unitId,
  lang,
  onSaved,
}: {
  reports: ReportRow[];
  unitId: string;
  lang: "ru" | "en";
  onSaved: () => void;
}) {
  const save = useServerFn(updateItem);
  const extract = useServerFn(extractUnitPayouts);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const attempted = useRef<string | null>(null);

  const rows = useMemo(
    () => reports.filter((r) => r.report_type === "roi"),
    [reports],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(
      Object.fromEntries(
        rows.map((r) => [r.id, r.net_payout != null ? group(String(Math.round(Number(r.net_payout)))) : ""]),
      ),
    );
    setNotes(Object.fromEntries(rows.map((r) => [r.id, r.payout_note ?? ""])));
  }, [rows]);

  const missing = rows.filter((r) => r.net_payout == null).length;

  async function readFromReports(overwrite: boolean) {
    setReading(true);
    try {
      const result = await extract({ data: { unitId, overwrite } });
      if (result.filled > 0) {
        toast.success(
          lang === "ru"
            ? `Считано из отчётов: ${result.filled}`
            : `Read from statements: ${result.filled}`,
        );
        onSaved();
      } else if (overwrite) {
        toast.error(lang === "ru" ? "Суммы в отчётах не найдены" : "No amounts found in statements");
      }
    } catch (error) {
      if (overwrite) {
        toast.error(error instanceof Error ? error.message : lang === "ru" ? "Ошибка" : "Error");
      }
    } finally {
      setReading(false);
    }
  }

  // Amounts are read automatically from the statement PDFs as soon as a report has none.
  useEffect(() => {
    if (missing === 0) return;
    const key = `${unitId}:${missing}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void readFromReports(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, missing]);

  if (rows.length === 0) return null;

  const currency = rows[0]?.currency ?? "IDR";
  const mixed = rows.some((r) => r.currency !== currency);

  const publishedTotal = rows.reduce((sum, r) => {
    if (!r.is_published) return sum;
    return sum + (toNumber(values[r.id] ?? "") ?? 0);
  }, 0);
  const allTotal = rows.reduce((sum, r) => sum + (toNumber(values[r.id] ?? "") ?? 0), 0);

  const dirty = rows.filter((r) => {
    const next = toNumber(values[r.id] ?? "");
    const current = r.net_payout != null ? Math.round(Number(r.net_payout)) : null;
    return next !== current || (notes[r.id] ?? "").trim() !== (r.payout_note ?? "");
  });

  async function saveAll() {
    if (dirty.length === 0) return;
    setBusy(true);
    try {
      for (const row of dirty) {
        const next = toNumber(values[row.id] ?? "");
        await save({
          data: {
            kind: "report",
            id: row.id,
            net_payout: next === null ? null : String(next),
            payout_note: notes[row.id] ?? "",
          },
        });
      }
      toast.success(lang === "ru" ? "Суммы сохранены" : "Payouts saved");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : lang === "ru" ? "Ошибка" : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle>{lang === "ru" ? "Суммы выплат по отчётам" : "Payouts by report"}</SectionTitle>
        <button
          type="button"
          className="text-[11px] tracking-[0.14em] text-violet uppercase underline-offset-4 hover:underline disabled:opacity-50"
          disabled={reading}
          onClick={() => void readFromReports(true)}
        >
          {reading
            ? lang === "ru"
              ? "Чтение отчётов…"
              : "Reading statements…"
            : lang === "ru"
              ? "Считать из отчётов"
              : "Read from statements"}
        </button>
      </div>
      <ul className="mt-2">
        {rows.map((report) => (
          <li
            key={report.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-hairline py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{report.period_label}</p>
              <p className="eyebrow mt-1">
                {report.is_published
                  ? lang === "ru"
                    ? "Опубликован"
                    : "Published"
                  : lang === "ru"
                    ? "Черновик — не в сумме"
                    : "Draft — not counted"}
              </p>
            </div>
            <label className="flex items-baseline gap-2">
              <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                {report.currency}
              </span>
              <input
                inputMode="numeric"
                className={`${field} w-40`}
                placeholder="0"
                value={values[report.id] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [report.id]: group(e.target.value) }))
                }
              />
            </label>
            <textarea
              className="w-full basis-full border border-input bg-transparent p-2 text-xs leading-5 outline-none focus:border-violet"
              rows={2}
              placeholder={lang === "ru" ? "Пояснение для владельца (например, почему выплата 0)" : "Note for owner (e.g. why payout is 0)"}
              value={notes[report.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{lang === "ru" ? "Итого получено выплат" : "Total payouts received"}</p>
          <p className="mt-1 text-xl tabular-nums">
            {mixed
              ? lang === "ru"
                ? "Разные валюты"
                : "Mixed currencies"
              : formatMoney(publishedTotal, currency, lang)}
          </p>
          {!mixed && allTotal !== publishedTotal && (
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ru" ? "С черновиками: " : "Incl. drafts: "}
              {formatMoney(allTotal, currency, lang)}
            </p>
          )}
        </div>
        <button type="button" className={button} disabled={busy || dirty.length === 0} onClick={() => void saveAll()}>
          {busy
            ? lang === "ru"
              ? "Сохранение…"
              : "Saving…"
            : lang === "ru"
              ? "Сохранить суммы"
              : "Save payouts"}
        </button>
      </div>
    </div>
  );
}
