import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { profileQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — The Umalas Signature" },
      {
        name: "description",
        content: "Manage units and owners, and upload owner documents and reports.",
      },
      { property: "og:title", content: "Administration — The Umalas Signature" },
      { property: "og:description", content: "Units, owners and file uploads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

const links: { to: string; labelKey: TranslationKey; exact?: boolean }[] = [
  { to: "/admin", labelKey: "admin.unitsOwners", exact: true },
  { to: "/admin/dashboard", labelKey: "admin.dashboard" },
  { to: "/admin/payouts", labelKey: "admin.payouts" },
  { to: "/admin/staff", labelKey: "staff.access" },
  { to: "/admin/owners", labelKey: "admin.ownersScreen" },
  { to: "/admin/units", labelKey: "admin.allUnits" },
  { to: "/admin/upload", labelKey: "admin.upload" },
  { to: "/admin/import", labelKey: "admin.import" },
  { to: "/admin/bulk", labelKey: "admin.bulk" },
  { to: "/admin/email", labelKey: "admin.emailTemplate" },
  { to: "/admin/messages", labelKey: "admin.messages" },
  { to: "/admin/activity", labelKey: "admin.activity" },
  { to: "/admin/logins", labelKey: "admin.logins" },
];


function AdminLayout() {
  const { t } = useI18n();
  const profile = useQuery(profileQuery());

  if (profile.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (profile.data?.role !== "admin") {
    return <p className="text-sm text-muted-foreground">{t("admin.noAccess")}</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl">{t("admin.title")}</h1>
        <div className="brand-rule mt-4 h-[2px] w-full" />
      </div>
      <nav className="flex flex-wrap gap-6 text-[11px] tracking-[0.14em] uppercase">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            activeOptions={{ exact: Boolean(link.exact) }}
            className="text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {t("staff.preview")}:
        </span>
        <Link
          to="/finance"
          className="rounded-full border border-border px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-accent"
        >
          {t("staff.previewFinance")}
        </Link>
        <Link
          to="/management"
          search={{ project: "e2d321b6-f5e9-4948-81de-ad4124ad6256" }}
          className="rounded-full border border-border px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-accent"
        >
          {t("staff.previewLuxsoUmalas")}
        </Link>
        <Link
          to="/management"
          search={{ project: "f70e8810-692f-4397-8ad5-bf0028f3848a" }}
          className="rounded-full border border-border px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-accent"
        >
          {t("staff.previewLuxsoSky")}
        </Link>
      </div>
      <Outlet />
    </div>
  );
}
