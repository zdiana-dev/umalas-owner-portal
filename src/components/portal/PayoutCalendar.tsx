import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { formatDate, formatMoney } from "@/lib/format";
import { updateItem } from "@/lib/admin.functions";
import type { ReportRow } from "@/lib/portal-queries";
import { SectionTitle } from "@/components/portal/Figures";

type Status = "received" | "overdue" | "soon" | "scheduled" | "unset";

const copy = {
  ru: {
    title: "Календарь выплат",
    caption: "Ожидаемая и фактическая дата каждой выплаты",
    due: "Ожидается",
    got: "Получено",
    notSet: "Дата не указана",
    received: "Получено",
    overdue: "Просрочено",
    soon: "Скоро",
    scheduled: "Запланировано",
    late: (d: number) => `с задержкой ${d} дн.`,
    onTime: "в срок",
    early: (d: number) => `раньше на ${d} дн.`,
    overdueBy: (d: number) => `просрочка ${d} дн.`,
    inDays: (d: number) => (d === 0 ? "сегодня" : `через ${d} дн.`),
    remind: "Напоминания",
    none: "Нет выплат для календаря",
    saved: "Дата сохранена",
    error: "Ошибка",
    reminderOverdue: (n: number) => `Просрочено выплат: ${n}`,
    reminderSoon: (n: number) => `Ожидается в течение 7 дней: ${n}`,
    reminderClear: "Все выплаты получены — просрочек нет",
    upcoming: "Ожидаются выплаты",
    receivedTitle: "Полученные выплаты",
    totalUpcoming: "Итого ожидается",
    totalReceived: "Итого получено",
    noneUpcoming: "Нет ожидаемых выплат",
    noneReceived: "Пока нет полученных выплат",
  },
  en: {
    title: "Payout calendar",
    caption: "Expected and actual date of every payment",
    due: "Due",
    got: "Received",
    notSet: "No due date",
    received: "Received",
    overdue: "Overdue",
    soon: "Due soon",
    scheduled: "Scheduled",
    late: (d: number) => `${d} days late`,
    onTime: "on time",
    early: (d: number) => `${d} days early`,
    overdueBy: (d: number) => `${d} days overdue`,
    inDays: (d: number) => (d === 0 ? "today" : `in ${d} days`),
    remind: "Reminders",
    none: "No payments to show yet",
    saved: "Due date saved",
    error: "Error",
    reminderOverdue: (n: number) => `Overdue payments: ${n}`,
    reminderSoon: (n: number) => `Due within 7 days: ${n}`,
    reminderClear: "All payments received — nothing overdue",
    upcoming: "Payments upcoming",
    receivedTitle: "Payments received",
    totalUpcoming: "Total expected",
    totalReceived: "Total received",
    noneUpcoming: "No upcoming payments",
    noneReceived: "No payments received yet",
  },
} as const;

const pill =
  "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase";

const tone: Record<Status, string> = {
  received: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700",
  overdue: "border-rose/50 bg-rose/10 text-rose",
  soon: "border-violet/50 bg-violet/10 text-violet",
  scheduled: "border-hairline text-muted-foreground",
  unset: "border-hairline text-muted-foreground",
};

function startOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

type Entry = {
  report: ReportRow;
  status: Status;
  note: string;
};

export function PayoutCalendar({
  reports,
  lang,
  editable = false,
  onSaved,
}: {
  reports: ReportRow[];
  lang: "ru" | "en";
  editable?: boolean;
  onSaved?: () => void;
}) {
  const c = copy[lang];
  const save = useServerFn(updateItem);
  const [busyId, setBusyId] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const today = startOfDay(new Date());
    const rows = reports
      .filter((r) => r.report_type === "roi" && (editable || r.is_published))
      .slice()
      .sort((a, b) => {
        const ka = a.paid_at ?? a.due_date ?? a.period_start ?? "";
        const kb = b.paid_at ?? b.due_date ?? b.period_start ?? "";
        return kb.localeCompare(ka);
      });

    return rows.map((report) => {
      const due = report.due_date ? startOfDay(report.due_date) : null;
      if (report.paid_at) {
        const paid = startOfDay(report.paid_at);
        let note = "";
        if (due) {
          const diff = daysBetween(paid, due);
          note = diff > 0 ? c.late(diff) : diff < 0 ? c.early(-diff) : c.onTime;
        }
        return { report, status: "received" as Status, note };
      }
      if (!due) return { report, status: "unset" as Status, note: "" };
      const diff = daysBetween(due, today);
      if (diff < 0) return { report, status: "overdue" as Status, note: c.overdueBy(-diff) };
      if (diff <= 7) return { report, status: "soon" as Status, note: c.inDays(diff) };
      return { report, status: "scheduled" as Status, note: c.inDays(diff) };
    });
  }, [reports, editable, c]);

  if (entries.length === 0) return null;

  const overdue = entries.filter((e) => e.status === "overdue").length;
  const soon = entries.filter((e) => e.status === "soon").length;

  const upcoming = entries.filter((e) => e.status !== "received");
  const received = entries.filter((e) => e.status === "received");

  function sumByCurrency(list: Entry[]) {
    const totals = new Map<string, number>();
    for (const { report } of list) {
      if (report.net_payout == null) continue;
      totals.set(report.currency, (totals.get(report.currency) ?? 0) + Number(report.net_payout));
    }
    return [...totals.entries()]
      .map(([cur, sum]) => formatMoney(sum, cur, lang))
      .join(" · ");
  }

  const upcomingTotal = sumByCurrency(upcoming);
  const receivedTotal = sumByCurrency(received);

  function renderList(list: Entry[]) {
    return (
      <ul>
        {list.map(({ report, status, note }) => (
          <li
            key={report.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-hairline py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{report.period_label}</p>
              <p className="eyebrow mt-1">
                {c.due}: {report.due_date ? formatDate(report.due_date, lang) : c.notSet}
                {report.paid_at ? ` · ${c.got}: ${formatDate(report.paid_at, lang)}` : ""}
                {note ? ` · ${note}` : ""}
              </p>
            </div>

            {report.net_payout != null && (
              <p className="text-sm tabular-nums">
                {formatMoney(Number(report.net_payout), report.currency, lang)}
              </p>
            )}

            <span className={`${pill} ${tone[status]}`}>{c[status === "unset" ? "scheduled" : status]}</span>

            {editable && (
              <input
                type="date"
                aria-label={c.due}
                disabled={busyId === report.id}
                defaultValue={report.due_date ?? ""}
                onChange={(e) => void setDue(report.id, e.target.value)}
                className="border-b border-input bg-transparent pb-1 text-xs outline-none focus:border-violet disabled:opacity-50"
              />
            )}
          </li>
        ))}
      </ul>
    );
  }

  async function setDue(id: string, value: string) {
    setBusyId(id);
    try {
      await save({ data: { kind: "report", id, due_date: value === "" ? null : value } });
      toast.success(c.saved);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.error);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle>{c.title}</SectionTitle>
        <p className="text-xs text-muted-foreground">{c.caption}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {overdue > 0 && <span className={`${pill} ${tone.overdue}`}>{c.reminderOverdue(overdue)}</span>}
        {soon > 0 && <span className={`${pill} ${tone.soon}`}>{c.reminderSoon(soon)}</span>}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-2">
          <p className="eyebrow text-violet">{c.upcoming}</p>
          {upcomingTotal && <p className="text-sm tabular-nums">{c.totalUpcoming}: {upcomingTotal}</p>}
        </div>
        {upcoming.length > 0 ? (
          renderList(upcoming)
        ) : (
          <p className="py-3 text-sm text-muted-foreground">{c.noneUpcoming}</p>
        )}
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-2">
          <p className="eyebrow text-emerald-700">{c.receivedTitle}</p>
          {receivedTotal && <p className="text-sm tabular-nums">{c.totalReceived}: {receivedTotal}</p>}
        </div>
        {received.length > 0 ? (
          renderList(received)
        ) : (
          <p className="py-3 text-sm text-muted-foreground">{c.noneReceived}</p>
        )}
      </div>
    </section>
  );
}
