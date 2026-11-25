import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  allProfilesQuery,
  documentsQuery,
  ownershipsQuery,
  projectsQuery,
  reportsQuery,
  unitsQuery,
} from "@/lib/portal-queries";
import { SectionTitle, SkeletonLines } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/units/")({
  component: AllUnitsPage,
});

const PAGE_SIZE = 25;

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";

type SortKey = "code" | "project" | "unit_type" | "building" | "floor" | "owners" | "docs" | "reps" | "latest";

type Row = {
  id: string;
  code: string;
  projectId: string | null;
  projectName: string;
  projectShort: string;
  unit_type: string | null;
  building: string | null;
  floor: number | null;
  owners: string;
  docs: number;
  reps: number;
  latest: string;
  latestSort: string;
  drafts: number;
};

function AllUnitsPage() {
  const { t } = useI18n();
  const units = useQuery(unitsQuery());
  const ownerships = useQuery(ownershipsQuery());
  const profiles = useQuery(allProfilesQuery());
  const documents = useQuery(documentsQuery());
  const reports = useQuery(reportsQuery());
  const projects = useQuery(projectsQuery());

  const [search, setSearch] = useState("");
  const [project, setProject] = useState("all");
  const [building, setBuilding] = useState("all");
  const [unitType, setUnitType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);

  const loading =
    units.isLoading ||
    ownerships.isLoading ||
    profiles.isLoading ||
    documents.isLoading ||
    reports.isLoading;

  const rows = useMemo<Row[]>(() => {
    const nameById = new Map((profiles.data ?? []).map((p) => [p.user_id, p.full_name || p.email]));
    const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
    const today = new Date().toISOString().slice(0, 10);
    return (units.data ?? []).map((unit) => {
      // Closed ownerships (end_date in the past) are history, not current owners.
      const owners = (ownerships.data ?? [])
        .filter((o) => o.unit_id === unit.id && (!o.end_date || o.end_date > today))
        .map((o) => nameById.get(o.owner_id) ?? "—")
        .filter(Boolean);

      const unitDocs = (documents.data ?? []).filter((d) => d.unit_id === unit.id);
      const unitReps = (reports.data ?? []).filter((r) => r.unit_id === unit.id);
      const published = unitReps.filter((r) => r.is_published);
      const latest = published
        .map((r) => ({ label: r.period_label, sort: r.period_start ?? "" }))
        .sort((a, b) => b.sort.localeCompare(a.sort))[0];
      return {
        id: unit.id,
        code: unit.code,
        projectId: unit.project_id,
        projectName: (unit.project_id && projectById.get(unit.project_id)?.name) || "",
        projectShort: (unit.project_id && projectById.get(unit.project_id)?.short_name) || "",
        unit_type: unit.unit_type,
        building: unit.building,
        floor: unit.floor,
        owners: owners.join(", "),
        docs: unitDocs.filter((d) => d.is_published).length,
        reps: published.length,
        latest: latest?.label ?? "—",
        latestSort: latest?.sort ?? "",
        drafts:
          unitDocs.filter((d) => !d.is_published).length +
          unitReps.filter((r) => !r.is_published).length,
      };
    });
  }, [units.data, ownerships.data, profiles.data, documents.data, reports.data, projects.data]);

  const buildings = useMemo(
    () => Array.from(new Set(rows.map((r) => r.building).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.unit_type).filter(Boolean) as string[])).sort(),
    [rows],
  );

  // Russian spellings typed into the search box map onto the Latin project names.
  const PROJECT_ALIASES: [string, string][] = [
    ["умалас", "umalas"],
    ["ски старс", "sky stars"],
    ["скай старс", "sky stars"],
    ["ски стар", "sky stars"],
    ["скай стар", "sky stars"],
    ["анойя", "anoya"],
    ["амара", "amara"],
  ];

  const filtered = useMemo(() => {
    const raw = search.trim().toLowerCase();
    const candidates = [raw];
    for (const [alias, latin] of PROJECT_ALIASES) {
      if (raw && raw.includes(alias)) candidates.push(raw.split(alias).join(latin));
    }
    const list = rows.filter((row) => {
      if (project !== "all" && (row.projectId ?? "none") !== project) return false;
      if (building !== "all" && (row.building ?? "") !== building) return false;
      if (unitType !== "all" && (row.unit_type ?? "") !== unitType) return false;
      if (!raw) return true;
      const haystack = `${row.code} ${row.owners} ${row.projectName} ${row.projectShort}`.toLowerCase();
      return candidates.some((candidate) => haystack.includes(candidate));
    });
    const dir = asc ? 1 : -1;
    return list.sort((a, b) => {
      switch (sortKey) {
        case "floor":
          return ((a.floor ?? -1) - (b.floor ?? -1)) * dir;
        case "docs":
          return (a.docs - b.docs) * dir;
        case "reps":
          return (a.reps - b.reps) * dir;
        case "latest":
          return a.latestSort.localeCompare(b.latestSort) * dir;
        case "owners":
          return a.owners.localeCompare(b.owners) * dir;
        case "project":
          return a.projectName.localeCompare(b.projectName) * dir;
        case "building":
          return (a.building ?? "").localeCompare(b.building ?? "") * dir;
        case "unit_type":
          return (a.unit_type ?? "").localeCompare(b.unit_type ?? "") * dir;
        default:
          return a.code.localeCompare(b.code) * dir;
      }
    });
  }, [rows, search, project, building, unitType, sortKey, asc]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
    setPage(0);
  }

  const columns: { key: SortKey; labelKey: TranslationKey; align?: string }[] = [
    { key: "code", labelKey: "admin.code" },
    { key: "project", labelKey: "admin.project" },
    { key: "unit_type", labelKey: "admin.unitType" },
    { key: "building", labelKey: "admin.building" },
    { key: "floor", labelKey: "admin.floor" },
    { key: "owners", labelKey: "admin.owner" },
    { key: "docs", labelKey: "admin.docsCount", align: "text-right" },
    { key: "reps", labelKey: "admin.repsCount", align: "text-right" },
    { key: "latest", labelKey: "admin.latestPeriod" },
  ];

  // Excel-friendly CSV (BOM + semicolons so Excel splits columns without an import wizard).
  function exportList() {
    const header = [
      t("admin.code"),
      t("admin.project"),
      t("admin.unitType"),
      t("admin.building"),
      t("admin.floor"),
      t("admin.owner"),
      t("admin.docsCount"),
      t("admin.repsCount"),
      t("admin.latestPeriod"),
    ];
    const cells = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      header.map(cells).join(";"),
      ...filtered.map((row) =>
        [
          row.code,
          row.projectName,
          row.unit_type ?? "",
          row.building ?? "",
          row.floor ?? "",
          row.owners,
          row.docs,
          row.reps,
          row.latest,
        ]
          .map(cells)
          .join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `units-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="space-y-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-5 gap-y-4 border-b border-hairline pb-3">
        <h2 className="type-section">{t("admin.allUnits")}</h2>
        <div className="flex shrink-0 items-center gap-5">
          <span className="eyebrow">{filtered.length} {t("admin.unitsCountLabel")}</span>
          <button
            type="button"
            onClick={exportList}
            className="figure rounded-full border border-violet px-5 py-2.5 text-[11px] tracking-[0.18em] uppercase transition-colors duration-200 hover:bg-violet hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
          >
            {t("admin.exportList")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="eyebrow">{t("admin.project")}</span>
          <select
            className={field}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("admin.filterAll")}</option>
            {(projects.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="none">{t("common.none")}</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">{t("admin.search")}</span>
          <input
            className={field}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="A-201 · Umalas"
          />
        </label>
        <label className="block">
          <span className="eyebrow">{t("admin.building")}</span>
          <select
            className={field}
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("admin.filterAll")}</option>
            {buildings.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">{t("admin.unitType")}</span>
          <select
            className={field}
            value={unitType}
            onChange={(e) => {
              setUnitType(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("admin.filterAll")}</option>
            {types.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <SkeletonLines rows={6} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-brand w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`py-2 text-left text-[10px] font-normal tracking-[0.14em] text-muted-foreground uppercase ${column.align ?? ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(column.key)}
                        className="transition-colors hover:text-foreground"
                      >
                        {t(column.labelKey)}
                        {sortKey === column.key ? (asc ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr
                    key={row.id}
                    className="group border-b border-hairline align-baseline transition-colors hover:bg-violet/5"
                    style={{ animationDelay: `${Math.min(index, 15) * 25}ms` }}
                  >
                    <td>
                      <Link
                        to="/admin/units/$unitId"
                        params={{ unitId: row.id }}
                        className="figure block py-3 transition-colors group-hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                      >
                        {row.code}
                        {row.drafts > 0 && (
                          <span className="ml-3 border border-rose px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-rose uppercase">
                            {t("admin.draft")}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.projectName || "—"}
                      </Link>
                    </td>
                    <td>
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.unit_type ?? "—"}
                      </Link>
                    </td>
                    <td>
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.building ?? "—"}
                      </Link>
                    </td>
                    <td className="figure">
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.floor ?? "—"}
                      </Link>
                    </td>
                    <td>
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.owners ? row.owners : <span className="text-rose">{t("admin.noOwner")}</span>}
                      </Link>
                    </td>
                    <td className="figure text-right">
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.docs}
                      </Link>
                    </td>
                    <td className="figure text-right">
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.reps}
                      </Link>
                    </td>
                    <td>
                      <Link to="/admin/units/$unitId" params={{ unitId: row.id }} className="block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                        {row.latest}
                      </Link>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-6 text-muted-foreground">
                      {t("admin.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-[11px] tracking-[0.12em] uppercase">
              <button
                type="button"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                {t("admin.prev")}
              </button>
              <span className="text-muted-foreground">
                {current + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                {t("admin.next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
