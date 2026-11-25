import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import {
  allProfilesQuery,
  ownershipsQuery,
  projectsQuery,
  unitsQuery,
  type Profile,
} from "@/lib/portal-queries";
import { createOwner, linkOwnership, saveUnit, unlinkOwnership } from "@/lib/admin.functions";
import { SectionTitle } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: UnitsOwnersPage,
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep";

function UnitsOwnersPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const units = useQuery(unitsQuery());
  const profiles = useQuery(allProfilesQuery());
  const ownerships = useQuery(ownershipsQuery());
  const projects = useQuery(projectsQuery());

  const saveUnitFn = useServerFn(saveUnit);
  const createOwnerFn = useServerFn(createOwner);
  const linkFn = useServerFn(linkOwnership);
  const unlinkFn = useServerFn(unlinkOwnership);

  const [unitForm, setUnitForm] = useState({
    code: "",
    project_id: "",
    building: "",
    floor: "",
    unit_type: "1 BR",
    purchase_price: "",
    purchase_currency: "IDR",
    purchase_date: "",
    is_investment_contract: false,
  });
  const [ownerForm, setOwnerForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [link, setLink] = useState({ owner_id: "", unit_id: "" });
  const [busy, setBusy] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [linkSearch, setLinkSearch] = useState("");

  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((item) => [item.id, item])),
    [projects.data],
  );

  const profileById = useMemo(
    () => new Map((profiles.data ?? []).map((item) => [item.user_id, item])),
    [profiles.data],
  );

  const ownersByUnit = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const row of ownerships.data ?? []) {
      const owner = profileById.get(row.owner_id);
      if (!owner) continue;
      const list = map.get(row.unit_id) ?? [];
      if (!list.some((o) => o.user_id === owner.user_id)) list.push(owner);
      map.set(row.unit_id, list);
    }
    return map;
  }, [ownerships.data, profileById]);

  const unitList = (units.data ?? []).filter((unit) => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return true;
    const project = unit.project_id ? projectById.get(unit.project_id) : undefined;
    const owners = ownersByUnit.get(unit.id) ?? [];
    return [
      unit.code,
      unit.building,
      unit.unit_type,
      unit.floor,
      project?.name,
      project?.short_name,
      project?.code,
      ...owners.map((o) => `${o.full_name} ${o.email}`),
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .some((v) => v.includes(q));
  });

  const ownerList = (profiles.data ?? []).filter((profile) => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return true;
    return `${profile.full_name} ${profile.email}`.toLowerCase().includes(q);
  });

  const linkList = (ownerships.data ?? []).filter((row) => {
    const q = linkSearch.trim().toLowerCase();
    if (!q) return true;
    const owner = (profiles.data ?? []).find((p) => p.user_id === row.owner_id);
    const unit = (units.data ?? []).find((u) => u.id === row.unit_id);
    return `${unit?.code ?? ""} ${owner?.full_name ?? ""} ${owner?.email ?? ""}`
      .toLowerCase()
      .includes(q);
  });


  async function run(action: () => Promise<unknown>, invalidate: string[]) {
    setBusy(true);
    try {
      await action();
      for (const key of invalidate) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-14">
      <section className="space-y-6">
        <SectionTitle>{t("admin.newUnit")}</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-3">
          <label className="block">
            <span className="eyebrow">{t("admin.project")}</span>
            <select
              className={field}
              value={unitForm.project_id}
              onChange={(e) => setUnitForm({ ...unitForm, project_id: e.target.value })}
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
            <span className="eyebrow">{t("admin.code")}</span>
            <input
              className={field}
              value={unitForm.code}
              onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.building")}</span>
            <input
              className={field}
              value={unitForm.building}
              onChange={(e) => setUnitForm({ ...unitForm, building: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.floor")}</span>
            <input
              className={field}
              inputMode="numeric"
              value={unitForm.floor}
              onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.unitType")}</span>
            <select
              className={field}
              value={unitForm.unit_type}
              onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
            >
              <option value="1 BR">1 BR</option>
              <option value="2 BR">2 BR</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.price")}</span>
            <input
              className={field}
              inputMode="decimal"
              value={unitForm.purchase_price}
              onChange={(e) => setUnitForm({ ...unitForm, purchase_price: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.purchaseDate")}</span>
            <input
              type="date"
              className={field}
              value={unitForm.purchase_date}
              onChange={(e) => setUnitForm({ ...unitForm, purchase_date: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-violet"
              checked={unitForm.is_investment_contract}
              onChange={(e) =>
                setUnitForm({ ...unitForm, is_investment_contract: e.target.checked })
              }
            />
            <span className="eyebrow">{t("admin.investmentContract")}</span>
          </label>
        </div>
        <button
          type="button"
          className={button}
          disabled={busy || !unitForm.code.trim()}
          onClick={() =>
            void run(
              () =>
                saveUnitFn({
                  data: {
                    code: unitForm.code.trim(),
                    project_id: unitForm.project_id || null,
                    building: unitForm.building.trim() || null,
                    floor: unitForm.floor ? Number(unitForm.floor) : null,
                    unit_type: unitForm.unit_type,
                    purchase_price: unitForm.purchase_price
                      ? Number(unitForm.purchase_price)
                      : null,
                    purchase_currency: unitForm.purchase_currency,
                    purchase_date: unitForm.purchase_date || null,
                    is_investment_contract: unitForm.is_investment_contract,
                  },
                }),
              ["units"],
            ).then(() =>
              setUnitForm({
                ...unitForm,
                code: "",
                purchase_price: "",
                is_investment_contract: false,
              }),
            )
          }
        >
          {t("admin.save")}
        </button>

        <label className="block max-w-sm">
          <span className="eyebrow">{t("admin.search")}</span>
          <input
            className={field}
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            placeholder={t("admin.searchUnitHint")}
          />
        </label>

        <ul className="border-t border-hairline">
          {unitList.map((unit) => (
            <li key={unit.id} className="border-b border-hairline">
              <Link
                to="/admin/units/$unitId"
                params={{ unitId: unit.id }}
                className="group flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm transition-colors hover:bg-violet/5"
              >
                <span className="flex w-64 min-w-0 shrink-0 flex-col gap-1">
                  <span className="figure">{unit.code}</span>
                  <span className="truncate text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                    {[
                      unit.project_id ? projectById.get(unit.project_id)?.name : null,
                      (ownersByUnit.get(unit.id) ?? [])
                        .map((o) => o.full_name.trim() || o.email)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </span>
                <span className="text-muted-foreground transition-colors group-hover:text-foreground">
                  {unit.unit_type ?? "—"} · {t("admin.floor")} {unit.floor ?? "—"}
                  {unit.is_investment_contract && (
                    <span className="ml-2 inline-block rounded-sm bg-violet/10 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-violet uppercase">
                      {t("admin.investmentContractShort")}
                    </span>
                  )}
                </span>
                <span className="figure">
                  {unit.purchase_price
                    ? formatMoney(Number(unit.purchase_price), unit.purchase_currency, lang)
                    : "—"}
                </span>
              </Link>
            </li>
          ))}
          {unitList.length === 0 && (
            <li className="border-b border-hairline py-3 text-sm text-muted-foreground">
              {t("admin.noMatches")}
            </li>
          )}
        </ul>

      </section>

      <section className="space-y-6">
        <SectionTitle>{t("admin.newOwner")}</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow">{t("admin.fullName")}</span>
            <input
              className={field}
              value={ownerForm.full_name}
              onChange={(e) => setOwnerForm({ ...ownerForm, full_name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.email")}</span>
            <input
              className={field}
              type="email"
              value={ownerForm.email}
              onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.phone")}</span>
            <input
              className={field}
              value={ownerForm.phone}
              onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.password")}</span>
            <input
              className={field}
              type="password"
              value={ownerForm.password}
              onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          className={button}
          disabled={busy || !ownerForm.email || ownerForm.password.length < 8}
          onClick={() =>
            void run(
              () =>
                createOwnerFn({
                  data: {
                    full_name: ownerForm.full_name.trim(),
                    email: ownerForm.email.trim(),
                    phone: ownerForm.phone.trim() || null,
                    password: ownerForm.password,
                    language: "ru",
                  },
                }),
              ["profiles"],
            ).then(() => setOwnerForm({ full_name: "", email: "", phone: "", password: "" }))
          }
        >
          {t("admin.save")}
        </button>

        <label className="block max-w-sm">
          <span className="eyebrow">{t("admin.search")}</span>
          <input
            className={field}
            value={ownerSearch}
            onChange={(e) => setOwnerSearch(e.target.value)}
            placeholder="name@mail.com"
          />
        </label>

        <ul className="border-t border-hairline">
          {ownerList.map((profile) => (
            <li
              key={profile.user_id}
              className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-3 text-sm"
            >
              <span>{profile.full_name || "—"}</span>
              <span className="text-muted-foreground">{profile.email}</span>
              <span className="eyebrow">{profile.role}</span>
            </li>
          ))}
          {ownerList.length === 0 && (
            <li className="border-b border-hairline py-3 text-sm text-muted-foreground">
              {t("admin.noMatches")}
            </li>
          )}
        </ul>

      </section>

      <section className="space-y-6">
        <SectionTitle>{t("admin.link")}</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow">{t("admin.owner")}</span>
            <select
              className={field}
              value={link.owner_id}
              onChange={(e) => setLink({ ...link, owner_id: e.target.value })}
            >
              <option value="">—</option>
              {(profiles.data ?? []).map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.unit")}</span>
            <select
              className={field}
              value={link.unit_id}
              onChange={(e) => setLink({ ...link, unit_id: e.target.value })}
            >
              <option value="">—</option>
              {(units.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={button}
          disabled={busy || !link.owner_id || !link.unit_id}
          onClick={() =>
            void run(
              () =>
                linkFn({
                  data: { owner_id: link.owner_id, unit_id: link.unit_id, start_date: null, end_date: null },
                }),
              ["ownerships"],
            )
          }
        >
          {t("admin.link")}
        </button>

        <label className="block max-w-sm">
          <span className="eyebrow">{t("admin.search")}</span>
          <input
            className={field}
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
            placeholder="A102"
          />
        </label>

        <ul className="border-t border-hairline">
          {linkList.map((row) => {

            const owner = (profiles.data ?? []).find((p) => p.user_id === row.owner_id);
            const unit = (units.data ?? []).find((u) => u.id === row.unit_id);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline py-3 text-sm"
              >
                <span className="figure">{unit?.code ?? "—"}</span>
                <span>{owner?.full_name || owner?.email || "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.start_date, lang)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => unlinkFn({ data: { id: row.id } }), ["ownerships"])}
                  className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-rose"
                >
                  {t("admin.unlink")}
                </button>
              </li>
            );
          })}
          {linkList.length === 0 && (
            <li className="border-b border-hairline py-3 text-sm text-muted-foreground">
              {t("admin.noMatches")}
            </li>
          )}
        </ul>

      </section>
    </div>
  );
}
