import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  DOC_CATEGORIES,
  documentsQuery,
  unitsQuery,
  type DocCategory,
} from "@/lib/portal-queries";
import { uploadFiles } from "@/lib/admin.functions";
import { SectionTitle } from "@/components/portal/Figures";
import {
  ACCEPTED_EXTENSIONS,
  detectCategory,
  detectExclusion,
  isAccepted,
  matchUnit,
  titleFromName,
  type ExclusionReason,
} from "@/lib/bulk-import";

export const Route = createFileRoute("/_authenticated/admin/bulk")({
  head: () => ({
    meta: [
      { title: "Массовая загрузка документов — The Umalas Signature" },
      {
        name: "description",
        content:
          "Загрузка архива подписанных документов целыми папками: автоматическое сопоставление юнита и категории, исключение личных файлов и черновиков.",
      },
      { property: "og:title", content: "Массовая загрузка документов — The Umalas Signature" },
      { property: "og:description", content: "Импорт архива документов папками." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkUploadPage,
});

const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet";
const ghost =
  "text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet";
const cell =
  "border-b border-input bg-transparent py-1 text-xs outline-none focus:border-violet focus-visible:ring-1 focus-visible:ring-violet";

type Status = "ready" | "no_unit" | "excluded" | "duplicate";

type Row = {
  id: string;
  file: File;
  path: string;
  name: string;
  title: string;
  unitId: string;
  category: DocCategory;
  categoryGuessed: boolean;
  ambiguous: boolean;
  excluded: ExclusionReason | null;
  duplicate: boolean;
  checked: boolean;
};

type Failure = { name: string; error: string };

const PAGE_SIZE = 100;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return window.btoa(binary);
}

type Picked = { file: File; path: string };

/** Recursively read a dropped directory entry so nesting (and unit folders) survive. */
async function readEntry(entry: any, prefix: string): Promise<Picked[]> {
  if (!entry) return [];
  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) =>
      entry.file(resolve, reject),
    );
    return [{ file, path: `${prefix}${file.name}` }];
  }
  const reader = entry.createReader();
  const entries: any[] = [];
  for (;;) {
    const batch: any[] = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  const out: Picked[] = [];
  for (const child of entries) {
    out.push(...(await readEntry(child, `${prefix}${entry.name}/`)));
  }
  return out;
}

function statusOf(row: Row): Status {
  if (row.excluded) return "excluded";
  if (row.duplicate) return "duplicate";
  if (!row.unitId) return "no_unit";
  return "ready";
}

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    ready: { label: "Готов", className: "border-palm/30 bg-palm/10 text-palm" },
    no_unit: { label: "Не определён юнит", className: "border-gold/40 bg-gold/10 text-gold" },
    excluded: { label: "Исключён", className: "border-hairline text-muted-foreground" },
    duplicate: { label: "Уже загружен", className: "border-violet/30 bg-violet/10 text-violet" },
  };
  const chip = map[status];
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

function BulkUploadPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const upload = useServerFn(uploadFiles);
  const units = useQuery(unitsQuery());
  const documents = useQuery(documentsQuery());

  const [rows, setRows] = useState<Row[]>([]);
  const [skippedTypes, setSkippedTypes] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "attention" | "excluded">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [failures, setFailures] = useState<Failure[]>([]);
  const [summary, setSummary] = useState<{
    uploaded: number;
    unitIds: string[];
    excluded: number;
    reasons: Record<string, number>;
    duplicates: number;
    failed: number;
    skippedTypes: number;
  } | null>(null);

  const unitList = units.data ?? [];
  const unitById = useMemo(
    () => new Map(unitList.map((unit) => [unit.id, unit.code])),
    [unitList],
  );

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents.data ?? []) {
      if (doc.unit_id) set.add(`${doc.unit_id}::${doc.title.trim().toLowerCase()}`);
    }
    return set;
  }, [documents.data]);

  function buildRows(picked: Picked[]) {
    const codeToId = new Map(unitList.map((unit) => [unit.code.toUpperCase(), unit.id]));
    const codes = unitList.map((unit) => unit.code);
    let skipped = 0;
    const next: Row[] = [];

    picked.forEach((item, index) => {
      if (!isAccepted(item.file.name)) {
        skipped += 1;
        return;
      }
      const match = matchUnit(item.path, codes);
      const unitId =
        match.kind === "matched" ? (codeToId.get(match.code.toUpperCase()) ?? "") : "";
      const guessed = detectCategory(item.file.name);
      const title = titleFromName(item.file.name);
      next.push({
        id: `${index}-${item.path}`,
        file: item.file,
        path: item.path,
        name: item.file.name,
        title,
        unitId,
        category: guessed ?? "other",
        categoryGuessed: guessed != null,
        ambiguous: match.kind === "ambiguous",
        excluded: detectExclusion(item.path),
        duplicate: Boolean(unitId) && existingKeys.has(`${unitId}::${title.toLowerCase()}`),
        checked: false,
      });
    });

    for (const row of next) row.checked = !row.excluded && !row.duplicate;

    setSkippedTypes(skipped);
    setRows(next);
    setSelected(new Set());
    setPage(0);
    setSummary(null);
    setFailures([]);
    if (next.length === 0 && skipped > 0) toast.error("Подходящих файлов не найдено");
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const items = Array.from(event.dataTransfer.items ?? []);
    const entries = items
      .map((item) => (typeof (item as any).webkitGetAsEntry === "function" ? (item as any).webkitGetAsEntry() : null))
      .filter(Boolean);
    if (entries.length > 0) {
      const picked: Picked[] = [];
      for (const entry of entries) picked.push(...(await readEntry(entry, "")));
      buildRows(picked);
      return;
    }
    buildRows(
      Array.from(event.dataTransfer.files ?? []).map((file) => ({ file, path: file.name })),
    );
  }

  function onPick(files: FileList | null) {
    if (!files) return;
    buildRows(
      Array.from(files).map((file) => ({
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      })),
    );
  }

  function patch(id: string, updates: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  const excludedRows = rows.filter((row) => row.excluded);
  const readyRows = rows.filter((row) => statusOf(row) === "ready" && row.checked);
  const attentionRows = rows.filter((row) => {
    const status = statusOf(row);
    return status === "no_unit" || status === "duplicate" || (!row.categoryGuessed && !row.excluded);
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = statusOf(row);
      if (filter === "ready" && status !== "ready") return false;
      if (filter === "excluded" && status !== "excluded") return false;
      if (
        filter === "attention" &&
        !(status === "no_unit" || status === "duplicate" || (!row.categoryGuessed && !row.excluded))
      )
        return false;
      if (!query) return true;
      const code = (unitById.get(row.unitId) ?? "").toLowerCase();
      return row.name.toLowerCase().includes(query) || code.includes(query);
    });
  }, [rows, filter, search, unitById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(target: Row[]) {
    if (target.length === 0) return;
    cancelRef.current = false;
    setRunning(true);
    setFailures([]);
    setProgress({ done: 0, total: target.length, current: "" });

    const failed: Failure[] = [];
    const uploadedUnits = new Set<string>();
    let uploaded = 0;

    const queue = [...target];
    while (queue.length > 0 && !cancelRef.current) {
      const batch = queue.splice(0, 5);
      setProgress((p) => ({ ...p, current: batch[0]!.name }));
      await Promise.all(
        batch.map(async (row) => {
          try {
            await upload({
              data: {
                unit_id: row.unitId,
                kind: "document" as const,
                category: row.category,
                publish: false,
                files: [
                  {
                    name: row.file.name,
                    contentType: row.file.type || "application/octet-stream",
                    contentBase64: await toBase64(row.file),
                    unit_id: row.unitId,
                    category: row.category,
                    title: row.title,
                  },
                ],
              },
            });
            uploaded += 1;
            uploadedUnits.add(row.unitId);
          } catch (error) {
            failed.push({
              name: row.name,
              error: error instanceof Error ? error.message : String(error),
            });
          } finally {
            setProgress((p) => ({ ...p, done: p.done + 1 }));
          }
        }),
      );
    }

    await queryClient.invalidateQueries({ queryKey: ["documents"] });

    const reasons: Record<string, number> = {};
    for (const row of excludedRows) {
      reasons[row.excluded!] = (reasons[row.excluded!] ?? 0) + 1;
    }

    setFailures(failed);
    setRunning(false);
    setSummary({
      uploaded,
      unitIds: [...uploadedUnits],
      excluded: excludedRows.length,
      reasons,
      duplicates: rows.filter((row) => row.duplicate && !row.checked).length,
      failed: failed.length,
      skippedTypes,
    });
    if (failed.length === 0) toast.success("Загрузка завершена");
    else toast.error("Загрузка завершена с ошибками");
  }

  function reset() {
    setRows([]);
    setSelected(new Set());
    setSummary(null);
    setFailures([]);
    setSkippedTypes(0);
    setSearch("");
    setFilter("all");
    setPage(0);
  }

  if (summary) {
    return (
      <div className="space-y-10">
        <SectionTitle>Массовая загрузка</SectionTitle>
        <section className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Загружено", value: summary.uploaded },
            { label: "Юнитов затронуто", value: summary.unitIds.length },
            { label: "Исключено", value: summary.excluded },
            { label: "Дубликатов", value: summary.duplicates },
            { label: "Ошибок", value: summary.failed },
          ].map((item) => (
            <div key={item.label} className="border-t border-hairline pt-3">
              <p className="eyebrow">{item.label}</p>
              <p className="figure mt-2 text-2xl">{item.value}</p>
            </div>
          ))}
        </section>

        {Object.keys(summary.reasons).length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Причины исключения:{" "}
            {Object.entries(summary.reasons)
              .map(([reason, count]) => `${reason} — ${count}`)
              .join(" · ")}
          </p>
        ) : null}
        {summary.skippedTypes > 0 ? (
          <p className="text-xs text-muted-foreground">
            Пропущено файлов неподдерживаемого формата: {summary.skippedTypes}
          </p>
        ) : null}

        {summary.unitIds.length > 0 ? (
          <section className="space-y-3">
            <p className="eyebrow">Юниты — можно публиковать</p>
            <div className="flex flex-wrap gap-2">
              {summary.unitIds.map((id) => (
                <Link
                  key={id}
                  to="/admin/units/$unitId"
                  params={{ unitId: id }}
                  className="figure border border-hairline bg-cream px-2 py-1 text-[11px] transition-colors hover:border-violet hover:text-violet"
                >
                  {unitById.get(id) ?? id.slice(0, 8)}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {failures.length > 0 ? (
          <section className="space-y-3">
            <p className="eyebrow text-rose">Не удалось загрузить</p>
            <ul className="space-y-1 text-xs text-rose">
              {failures.map((failure, index) => (
                <li key={index}>
                  {failure.name} — {failure.error}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={button}
              onClick={() => {
                const names = new Set(failures.map((failure) => failure.name));
                void run(rows.filter((row) => names.has(row.name)));
              }}
            >
              Повторить неудачные
            </button>
          </section>
        ) : null}

        <button type="button" className={button} onClick={reset}>
          Загрузить ещё
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <SectionTitle>Массовая загрузка</SectionTitle>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => void onDrop(event)}
        className={`border border-dashed bg-cream px-6 py-12 text-center transition-colors ${
          dragging ? "border-violet" : "border-hairline"
        }`}
      >
        <p className="font-display text-lg">Перетащите папки или файлы сюда</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Структура папок сохраняется — по ней определяются юнит и подписанные оригиналы.
          Форматы: {ACCEPTED_EXTENSIONS.join(", ")}.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
          <label className={`${button} cursor-pointer`}>
            выбрать файлы
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => onPick(event.target.files)}
            />
          </label>
          <label className={`${ghost} cursor-pointer`}>
            выбрать папку
            <input
              type="file"
              multiple
              // @ts-expect-error non-standard directory picker attributes
              webkitdirectory="true"
              directory="true"
              className="hidden"
              onChange={(event) => onPick(event.target.files)}
            />
          </label>
        </div>
      </section>

      {rows.length > 0 ? (
        <>
          {excludedRows.length > 0 ? (
            <p className="border-l-2 border-rose bg-cream px-4 py-3 text-sm">
              <span className="figure">{excludedRows.length}</span> файлов исключено — личные
              документы и черновики
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-hairline pb-5 text-[12px] tracking-[0.13em] uppercase">
            {(
              [
                ["all", "Все", rows.length],
                ["ready", "Готовы", rows.filter((row) => statusOf(row) === "ready").length],
                ["attention", "Требуют внимания", attentionRows.length],
                ["excluded", "Исключены", excludedRows.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
                className={`flex items-baseline gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                  filter === value
                    ? "text-foreground"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }`}
              >
                <span>{label}</span>
                <span className="figure text-[11px] opacity-70">{count}</span>
              </button>
            ))}
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Файл или код объекта"
              className="ml-auto w-56 border-b border-input bg-transparent pb-1 text-xs tracking-normal normal-case outline-none focus:border-violet"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  {["", "Файл", "Юнит", "Категория", "Размер", "Статус"].map((head, index) => (
                    <th key={index} className="eyebrow py-2 pr-4 font-normal">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const status = statusOf(row);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-hairline/70 ${row.excluded ? "opacity-50" : ""}`}
                    >
                      <td className="py-3 pr-4 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="accent-violet"
                            disabled={Boolean(row.excluded)}
                            checked={row.checked}
                            onChange={(event) => patch(row.id, { checked: event.target.checked })}
                          />
                          <input
                            type="checkbox"
                            aria-label="Выбрать строку"
                            className="accent-rose"
                            checked={selected.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p className={row.excluded ? "line-through" : ""}>{row.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.path}</p>
                        {row.excluded ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {row.excluded} ·{" "}
                            <button
                              type="button"
                              className="underline transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                              onClick={() => patch(row.id, { excluded: null, checked: true })}
                            >
                              всё равно загрузить
                            </button>
                          </p>
                        ) : null}
                        {row.ambiguous ? (
                          <p className="mt-1 text-[11px] text-rose">неоднозначно — два кода в пути</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <select
                          className={`${cell} ${row.unitId ? "" : "text-rose"}`}
                          value={row.unitId}
                          onChange={(event) => patch(row.id, { unitId: event.target.value })}
                        >
                          <option value="">— не определён —</option>
                          {unitList.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <select
                          className={`${cell} ${row.categoryGuessed ? "" : "text-gold"}`}
                          value={row.category}
                          onChange={(event) =>
                            patch(row.id, {
                              category: event.target.value as DocCategory,
                              categoryGuessed: true,
                            })
                          }
                        >
                          {DOC_CATEGORIES.map((value) => (
                            <option key={value} value={value}>
                              {t(`doc.${value}` as TranslationKey)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="figure py-3 pr-4 align-top text-xs text-muted-foreground">
                        {formatSize(row.file.size)}
                      </td>
                      <td className="py-3 align-top">
                        <StatusChip status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center gap-6">
              <button
                type="button"
                className={ghost}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Назад
              </button>
              <span className="figure text-xs text-muted-foreground">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className={ghost}
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Дальше
              </button>
            </div>
          ) : null}

          <section className="space-y-4">
            <button
              type="button"
              className={button}
              disabled={running || readyRows.length === 0}
              onClick={() => void run(rows.filter((row) => row.checked && row.unitId && !row.excluded))}
            >
              Загрузить {readyRows.length} файлов
            </button>
            <p className="text-xs text-muted-foreground">
              Все файлы загружаются черновиками. Публикация — отдельным действием на странице
              юнита.
            </p>
            {running ? (
              <div className="space-y-2">
                <div className="h-[3px] w-full bg-hairline">
                  <div
                    className="brand-rule h-[3px] transition-all"
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Загружено <span className="figure">{progress.done}</span> из{" "}
                  <span className="figure">{progress.total}</span> · {progress.current}
                </p>
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    cancelRef.current = true;
                    toast.message("Остановимся после текущей партии");
                  }}
                >
                  Остановить
                </button>
              </div>
            ) : null}
          </section>

          {selected.size > 0 ? (
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-5 border border-hairline bg-background px-4 py-3 shadow-sm">
              <span className="text-xs">
                Выбрано <span className="figure">{selected.size}</span>
              </span>
              <label className="flex items-center gap-2 text-xs">
                Назначить юнит
                <select
                  className={cell}
                  value=""
                  onChange={(event) => {
                    const unitId = event.target.value;
                    if (!unitId) return;
                    setRows((current) =>
                      current.map((row) => (selected.has(row.id) ? { ...row, unitId } : row)),
                    );
                  }}
                >
                  <option value="">—</option>
                  {unitList.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                Назначить категорию
                <select
                  className={cell}
                  value=""
                  onChange={(event) => {
                    const category = event.target.value as DocCategory;
                    if (!category) return;
                    setRows((current) =>
                      current.map((row) =>
                        selected.has(row.id) ? { ...row, category, categoryGuessed: true } : row,
                      ),
                    );
                  }}
                >
                  <option value="">—</option>
                  {DOC_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`doc.${value}` as TranslationKey)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={ghost} onClick={() => setSelected(new Set())}>
                Снять выбор
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
