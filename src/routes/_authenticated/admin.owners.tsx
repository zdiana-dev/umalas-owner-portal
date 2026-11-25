import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, Plus, X } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { unitsQuery } from "@/lib/portal-queries";
import {
  closeOwnership,
  getOwnerLoginLink,
  inviteOwner,
  linkOwnership,
  listOwners,
  sendOwnerLink,
  sendAnoyaOwnerLoginEmail,
  setOwnerTempPassword,
  sendPendingOwnerLinks,
  updateOwner,
} from "@/lib/admin.functions";
import { SectionTitle } from "@/components/portal/Figures";
import { InviteTimeline } from "@/components/portal/InviteTimeline";
import { OwnerActivity } from "@/components/portal/OwnerActivity";
import { OwnerChatLog } from "@/components/portal/OwnerChatLog";
import { PaymentDocuments } from "@/components/portal/PaymentDocuments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/owners")({
  component: OwnersPage,
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";
const ghost =
  "text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground disabled:opacity-50";

type EditState = {
  full_name: string;
  email: string;
  phone: string;
  preferred_language: "ru" | "en";
};

type FilterKey = "all" | "multi" | "none" | "never" | "uninvited";
type SortKey = "name" | "units" | "signin";

const COPY = {
  ru: {
    add: "Добавить собственника",
    searchPlaceholder: "Имя, почта, телефон или код объекта",
    filters: {
      all: "Все",
      multi: "С несколькими объектами",
      none: "Без объектов",
      never: "Не заходили в кабинет",
      uninvited: "Приглашение не отправлено",
    } as Record<FilterKey, string>,
    sort: { name: "По имени", units: "По объектам", signin: "По входу" } as Record<SortKey, string>,
    sortLabel: "Сортировка",
    selectFound: "Выбрать всех найденных",
    selected: "Выбрано",
    sendInvites: "Отправить приглашения",
    found: "Найдено",
    ownersCount: (n: number) =>
      `${n} ${n % 10 === 1 && n % 100 !== 11 ? "собственник" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "собственника" : "собственников"}`,
    unitsCount: (n: number) =>
      `${n} ${n % 10 === 1 && n % 100 !== 11 ? "объект" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "объекта" : "объектов"}`,
    notInvited: "Не приглашён",
    inviteSent: "Приглашение отправлено",
    signedInAt: (d: string) => `Заходил ${d}`,
    clear: "Сбросить",
    pendingNote: (n: number) => `${n} собственников ещё не заходили в кабинет`,
    sendPending: "Отправить ссылки для входа",
    sending: "Отправляем…",
    linksSent: "Ссылок отправлено",
    domainNote:
      "Рассылка всем собственникам: новый адрес clients.theumalas.com и пошаговая инструкция на русском и английском",
    sendAll: "Отправить всем",
  },

  en: {
    add: "Add owner",
    searchPlaceholder: "Name, email, phone or unit code",
    filters: {
      all: "All",
      multi: "Multiple units",
      none: "No units",
      never: "Never signed in",
      uninvited: "Invite not sent",
    } as Record<FilterKey, string>,
    sort: { name: "By name", units: "By units", signin: "By sign-in" } as Record<SortKey, string>,
    sortLabel: "Sort",
    selectFound: "Select all found",
    selected: "Selected",
    sendInvites: "Send invites",
    found: "Found",
    ownersCount: (n: number) => `${n} owner${n === 1 ? "" : "s"}`,
    unitsCount: (n: number) => `${n} unit${n === 1 ? "" : "s"}`,
    notInvited: "Not invited",
    inviteSent: "Invite sent",
    signedInAt: (d: string) => `Signed in ${d}`,
    clear: "Reset",
    pendingNote: (n: number) => `${n} owners have never signed in`,
    sendPending: "Send login links",
    sending: "Sending…",
    linksSent: "Links sent",
    domainNote:
      "Mailing to every owner: the new address clients.theumalas.com plus step-by-step instructions in English and Russian",
    sendAll: "Send to all",
  },
} as const;

/** Owner-facing portal address used in every mailing link. */
const PORTAL_URL = "https://clients.theumalas.com";


function shortDate(value: string | null | undefined, lang: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function OwnersPage() {
  const { t, lang } = useI18n();
  const copy = COPY[lang === "en" ? "en" : "ru"];
  const queryClient = useQueryClient();

  const listFn = useServerFn(listOwners);
  const inviteFn = useServerFn(inviteOwner);
  const updateFn = useServerFn(updateOwner);
  const sendFn = useServerFn(sendOwnerLink);
  const sendAnoyaEmailFn = useServerFn(sendAnoyaOwnerLoginEmail);
  const loginLinkFn = useServerFn(getOwnerLoginLink);
  const tempFn = useServerFn(setOwnerTempPassword);
  const pendingFn = useServerFn(sendPendingOwnerLinks);
  const linkFn = useServerFn(linkOwnership);
  const closeFn = useServerFn(closeOwnership);

  const owners = useQuery({ queryKey: ["admin", "owners"], queryFn: () => listFn({}) });
  const units = useQuery(unitsQuery());

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    full_name: "",
    email: "",
    phone: "",
    preferred_language: "ru" as "ru" | "en",
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, { unit_id: string; start: string }>>({});
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingSent, setPendingSent] = useState(0);

  const origin = typeof window === "undefined" ? null : window.location.origin;

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      const result = (await action()) as { ok?: boolean; message?: string | null } | undefined;
      if (result && result.ok === false) {
        toast.error(result.message ?? t("common.error"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "owners"] });
      await queryClient.invalidateQueries({ queryKey: ["ownerships"] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(message ?? t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const ownerRows = (owners.data?.owners ?? []).filter((o) => o.role === "owner");
  const ownerships = owners.data?.ownerships ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const unitCode = (id: string) => (units.data ?? []).find((u) => u.id === id)?.code ?? "—";

  /** Closed links (end_date in the past) never count as current ownership. */
  const isActive = (o: { start_date: string; end_date: string | null }) =>
    o.start_date <= today && (!o.end_date || o.end_date > today);

  const activeCodes = useMemo(() => {
    const map = new Map<string, string[]>();
    ownerships.filter(isActive).forEach((o) => {
      const list = map.get(o.owner_id) ?? [];
      list.push(unitCode(o.unit_id));
      map.set(o.owner_id, list);
    });
    map.forEach((list) => list.sort((a, b) => a.localeCompare(b)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerships, units.data]);

  const codesOf = (ownerId: string) => activeCodes.get(ownerId) ?? [];

  const query = ownerSearch.trim().toLowerCase();
  const filteredOwners = useMemo(() => {
    const list = ownerRows.filter((owner) => {
      const codes = codesOf(owner.user_id);
      const sentAt = owner.last_invite_at ?? owner.invited_at ?? owner.recovery_sent_at ?? null;
      if (filter === "multi" && codes.length < 2) return false;
      if (filter === "none" && codes.length > 0) return false;
      if (filter === "never" && owner.last_sign_in_at) return false;
      if (filter === "uninvited" && sentAt) return false;
      if (!query) return true;
      const haystack = [owner.full_name, owner.email, owner.phone, codes.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    return list.sort((a, b) => {
      if (sort === "units") return codesOf(b.user_id).length - codesOf(a.user_id).length;
      if (sort === "signin")
        return (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? "");
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerRows, activeCodes, query, filter, sort]);

  async function inviteSelected() {
    setBusy(true);
    const failures: string[] = [];
    for (const email of selected) {
      try {
        await sendFn({ data: { email, kind: "invite", redirect_to: origin } });
      } catch (error) {
        failures.push(`${email}: ${error instanceof Error ? error.message : t("common.error")}`);
      }
    }
    setBusy(false);
    setSelected([]);
    if (failures.length === 0) toast.success(t("admin.inviteSent"));
    else toast.error(failures.join(" · "));
  }

  const filters: FilterKey[] = ["all", "multi", "none", "never", "uninvited"];
  const sorts: SortKey[] = ["name", "units", "signin"];

  const neverSignedIn = ownerRows.filter(
    (o) => !o.last_sign_in_at && codesOf(o.user_id).length > 0,
  ).length;

  async function sendAllPending(audience: "pending" | "all" = "pending") {
    setPendingBusy(true);
    let total = 0;
    try {
      // The mail service accepts a limited number of links per minute, so the
      // batches are small and paced; a rate-limited batch simply waits and retries.
      for (let round = 0; round < 60; round += 1) {
        const result = await pendingFn({
          data: { redirect_to: PORTAL_URL, limit: 8, audience },
        });

        total += result.sent;
        setPendingSent(total);
        if (result.remaining === 0) break;
        const rateLimited = result.failures.some((f) => /rate limit/i.test(f));
        if (result.failures.length > 0 && !rateLimited) {
          toast.error(result.failures.slice(0, 2).join(" · "));
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, rateLimited ? 60_000 : 15_000));
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "owners"] });
      toast.success(`${copy.linksSent}: ${total}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setPendingBusy(false);
    }
  }

  return (
    <div className="space-y-8 pb-28">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle>{t("admin.ownersScreen")}</SectionTitle>
          <button
            type="button"
            className={`${button} flex items-center gap-2`}
            onClick={() => setInviteOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {copy.add}
          </button>
        </div>

        {neverSignedIn > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-violet bg-cream px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {copy.pendingNote(neverSignedIn)}
              {pendingBusy || pendingSent > 0 ? ` · ${copy.linksSent}: ${pendingSent}` : ""}
            </p>
            <button
              type="button"
              className={button}
              disabled={pendingBusy}
              onClick={() => void sendAllPending()}
            >
              {pendingBusy ? copy.sending : copy.sendPending}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-rose bg-cream px-4 py-3">
          <p className="text-xs text-muted-foreground">{copy.domainNote}</p>
          <button
            type="button"
            className={button}
            disabled={pendingBusy}
            onClick={() => void sendAllPending("all")}
          >
            {pendingBusy ? copy.sending : copy.sendAll}
          </button>
        </div>




        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <label className="block w-full max-w-md">
              <span className="eyebrow">{t("admin.search")}</span>
              <input
                className={field}
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </label>
            <button
              type="button"
              className={ghost}
              onClick={() => setSelected(filteredOwners.map((o) => o.email))}
            >
              {copy.selectFound}
            </button>
            <label className="ml-auto flex items-center gap-3 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {copy.sortLabel}
              <select
                className="border-b border-input bg-transparent pb-1 text-xs tracking-normal normal-case outline-none focus:border-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                {sorts.map((key) => (
                  <option key={key} value={key}>
                    {copy.sort[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {filters.map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`border px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                      active
                        ? "border-violet bg-cream text-foreground"
                        : "border-hairline text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {copy.filters[key]}
                  </button>
                );
              })}
            </div>
            <p className="figure text-xs text-muted-foreground">
              {query || filter !== "all"
                ? `${copy.found} ${filteredOwners.length}`
                : copy.ownersCount(ownerRows.length)}
            </p>
          </div>
        </div>

        {owners.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : ownerRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noOwners")}</p>
        ) : filteredOwners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noMatches")}</p>
        ) : (
          <ul className="border-t border-hairline">
            {filteredOwners.map((owner) => {
              const open = expanded === owner.user_id;
              const codes = codesOf(owner.user_id);
              const links = ownerships.filter((o) => o.owner_id === owner.user_id);
              const draft = linkDraft[owner.user_id] ?? { unit_id: "", start: "" };
              const sentAt =
                owner.last_invite_at ?? owner.invited_at ?? owner.recovery_sent_at ?? null;
              const status = owner.last_sign_in_at
                ? {
                    className: "chip-palm",
                    label: copy.signedInAt(shortDate(owner.last_sign_in_at, lang)),
                  }
                : sentAt
                  ? { className: "chip-violet", label: copy.inviteSent }
                  : { className: "chip-gold", label: copy.notInvited };

              return (
                <li key={owner.user_id} className="border-b border-hairline">
                  <div className="flex min-h-16 items-center gap-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-violet"
                      checked={selected.includes(owner.email)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, owner.email]
                            : prev.filter((email) => email !== owner.email),
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      aria-label={owner.email}
                    />
                    <button
                      type="button"
                      className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-left"
                      onClick={() => {
                        if (open) {
                          setExpanded(null);
                          setEdit(null);
                          return;
                        }
                        setExpanded(owner.user_id);
                        setEdit({
                          full_name: owner.full_name ?? "",
                          email: owner.email ?? "",
                          phone: owner.phone ?? "",
                          preferred_language: owner.preferred_language === "en" ? "en" : "ru",
                        });
                      }}
                    >
                      <span className="min-w-52 flex-1">
                        <span className="block text-[15px] leading-tight">
                          {owner.full_name || owner.email}
                          {codes.length > 1 ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              · {copy.unitsCount(codes.length)}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {owner.email}
                          {owner.phone ? ` · ${owner.phone}` : ""}
                        </span>
                      </span>

                      <span className="flex flex-wrap items-center gap-1.5">
                        {codes.slice(0, 4).map((code) => (
                          <span
                            key={code}
                            className="figure border border-hairline bg-cream/60 px-2 py-0.5 text-[11px] text-foreground"
                          >
                            {code}
                          </span>
                        ))}
                        {codes.length > 4 ? (
                          <span className="figure text-[11px] text-muted-foreground">
                            +{codes.length - 4}
                          </span>
                        ) : null}
                      </span>

                      <span
                        className={`${status.className} shrink-0 border px-2 py-1 text-[10px] tracking-[0.12em] uppercase`}
                      >
                        {status.label}
                      </span>
                    </button>
                    {owner.phone ? (
                      <a
                        href={`https://wa.me/${owner.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp ${owner.full_name || owner.email}`}
                        title="WhatsApp"
                        className="shrink-0 rounded-full border border-hairline p-2 text-[#25D366] transition hover:border-[#25D366] hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>

                  {open && edit ? (
                    <div className="space-y-6 bg-cream/40 p-5">
                      <InviteTimeline status={owner} variant="line" />

                      <div className="grid gap-6 sm:grid-cols-2">
                        <label className="block">
                          <span className="eyebrow">{t("admin.fullName")}</span>
                          <input
                            className={field}
                            value={edit.full_name}
                            onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="eyebrow">{t("admin.email")}</span>
                          <input
                            className={field}
                            type="email"
                            value={edit.email}
                            onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="eyebrow">{t("admin.phone")}</span>
                          <input
                            className={field}
                            value={edit.phone}
                            onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="eyebrow">{t("admin.language")}</span>
                          <select
                            className={field}
                            value={edit.preferred_language}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                preferred_language: e.target.value as "ru" | "en",
                              })
                            }
                          >
                            <option value="ru">RU</option>
                            <option value="en">EN</option>
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-6">
                        <button
                          type="button"
                          className={button}
                          disabled={busy || !edit.full_name.trim() || !edit.email.trim()}
                          onClick={() =>
                            void run(() =>
                              updateFn({
                                data: {
                                  user_id: owner.user_id,
                                  full_name: edit.full_name.trim(),
                                  email: edit.email.trim(),
                                  phone: edit.phone.trim() || null,
                                  preferred_language: edit.preferred_language,
                                },
                              }),
                            )
                          }
                        >
                          {t("admin.save")}
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                sendFn({
                                  data: { email: owner.email, kind: "invite", redirect_to: origin },
                                }),
                              t("admin.inviteSent"),
                            )
                          }
                        >
                          {t("admin.inviteResend")}
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                sendFn({
                                  data: {
                                    email: owner.email,
                                    kind: "recovery",
                                    redirect_to: origin,
                                  },
                                }),
                              t("admin.linkSent"),
                            )
                          }
                        >
                          {t("admin.resetPassword")}
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const res = await tempFn({ data: { email: owner.email } });
                              if (res?.temp_password) {
                                try {
                                  await navigator.clipboard.writeText(res.temp_password);
                                } catch {
                                  /* clipboard unavailable */
                                }
                                toast.success(
                                  `${lang === "ru" ? "Временный пароль (скопирован)" : "Temporary password (copied)"}: ${res.temp_password}`,
                                  { duration: 60000 },
                                );
                              }
                            })
                          }
                        >
                          {lang === "ru" ? "Временный пароль" : "Temp password"}
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const res = await loginLinkFn({
                                data: {
                                  email: owner.email,
                                  kind: "recovery",
                                  redirect_to: "https://clients.theumalas.com",
                                },
                              });
                              if (res?.url) {
                                try {
                                  await navigator.clipboard.writeText(res.url);
                                } catch {
                                  /* clipboard unavailable */
                                }
                                toast.success(
                                  `${lang === "ru" ? "Ссылка для входа (скопирована)" : "Login link (copied)"}: ${res.url}`,
                                  { duration: 60000 },
                                );
                              }
                            })
                          }
                        >
                          {lang === "ru" ? "Ссылка для входа" : "Login link"}
                        </button>
                        <button
                          type="button"
                          className={ghost}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => sendAnoyaEmailFn({ data: { email: owner.email } }),
                              lang === "ru" ? "Письмо Anoya отправлено" : "Anoya email sent",
                            )
                          }
                        >
                          {lang === "ru" ? "Отправить письмо Anoya" : "Send Anoya login email"}
                        </button>
                      </div>

                      <ul className="space-y-2 border-t border-hairline pt-4">
                        {links.map((row) => {
                          const closed = Boolean(row.end_date && row.end_date <= today);
                          return (
                            <li
                              key={row.id}
                              className={`flex flex-wrap items-baseline gap-3 text-xs ${
                                closed ? "text-muted-foreground/50" : "text-muted-foreground"
                              }`}
                            >
                              <span
                                className={`figure ${closed ? "" : "text-foreground"}`}
                              >
                                {unitCode(row.unit_id)}
                              </span>
                              <span>
                                {formatDate(row.start_date, lang)} —{" "}
                                {row.end_date ? formatDate(row.end_date, lang) : "…"}
                              </span>
                              {closed ? (
                                <span className="eyebrow">{t("admin.ownershipClosed")}</span>
                              ) : (
                                <button
                                  type="button"
                                  className={ghost}
                                  disabled={busy}
                                  onClick={() =>
                                    void run(() => closeFn({ data: { id: row.id, end_date: null } }))
                                  }
                                >
                                  {t("admin.closeOwnership")}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="flex flex-wrap items-end gap-4">
                        <label className="block min-w-40">
                          <span className="eyebrow">{t("admin.unit")}</span>
                          <select
                            className={field}
                            value={draft.unit_id}
                            onChange={(e) =>
                              setLinkDraft({
                                ...linkDraft,
                                [owner.user_id]: { ...draft, unit_id: e.target.value },
                              })
                            }
                          >
                            <option value="">—</option>
                            {(units.data ?? []).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.code}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="eyebrow">{t("admin.startDate")}</span>
                          <input
                            type="date"
                            className={field}
                            value={draft.start}
                            onChange={(e) =>
                              setLinkDraft({
                                ...linkDraft,
                                [owner.user_id]: { ...draft, start: e.target.value },
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={button}
                          disabled={busy || !draft.unit_id}
                          onClick={() =>
                            void run(() =>
                              linkFn({
                                data: {
                                  owner_id: owner.user_id,
                                  unit_id: draft.unit_id,
                                  start_date: draft.start || null,
                                  end_date: null,
                                },
                              }),
                            ).then(() =>
                              setLinkDraft({
                                ...linkDraft,
                                [owner.user_id]: { unit_id: "", start: "" },
                              }),
                            )
                          }
                        >
                          {t("admin.link")}
                        </button>
                      </div>

                      <div className="border-t border-hairline pt-5">
                        <p className="eyebrow mb-3">{t("paydocs.title")}</p>
                        <PaymentDocuments ownerId={owner.user_id} adminView />
                      </div>

                      <OwnerActivity userId={owner.user_id} />

                      <OwnerChatLog userId={owner.user_id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <p className="figure text-xs text-muted-foreground">
              {copy.selected} {selected.length}
            </p>
            <div className="flex items-center gap-6">
              <button type="button" className={ghost} onClick={() => setSelected([])}>
                <X className="mr-1 inline h-3.5 w-3.5" />
                {copy.clear}
              </button>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => void inviteSelected()}
              >
                {copy.sendInvites}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-xl border-hairline bg-background sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="type-section">{t("admin.inviteOwner")}</DialogTitle>
          </DialogHeader>
          <p className="border-l-2 border-violet bg-cream px-4 py-3 text-xs text-muted-foreground">
            {t("admin.inviteNote")}
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">{t("admin.fullName")}</span>
              <input
                className={field}
                value={invite.full_name}
                onChange={(e) => setInvite({ ...invite, full_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.email")}</span>
              <input
                className={field}
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.phone")}</span>
              <input
                className={field}
                value={invite.phone}
                onChange={(e) => setInvite({ ...invite, phone: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="eyebrow">{t("admin.language")}</span>
              <select
                className={field}
                value={invite.preferred_language}
                onChange={(e) =>
                  setInvite({ ...invite, preferred_language: e.target.value as "ru" | "en" })
                }
              >
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
            </label>
          </div>
          <div>
            <button
              type="button"
              className={button}
              disabled={busy || !invite.full_name.trim() || !invite.email.trim()}
              onClick={() =>
                void run(
                  () =>
                    inviteFn({
                      data: {
                        full_name: invite.full_name.trim(),
                        email: invite.email.trim(),
                        phone: invite.phone.trim() || null,
                        preferred_language: invite.preferred_language,
                        redirect_to: origin,
                      },
                    }),
                  t("admin.inviteSent"),
                ).then(() => {
                  setInvite({ full_name: "", email: "", phone: "", preferred_language: "ru" });
                  setInviteOpen(false);
                })
              }
            >
              {t("admin.inviteOwner")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
