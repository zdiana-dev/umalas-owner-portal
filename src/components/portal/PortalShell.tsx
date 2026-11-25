import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MessageCircle, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { profileQuery, projectsQuery } from "@/lib/portal-queries";
import { staffContextQuery } from "@/lib/staff-queries";
import { logLoginOnce } from "@/lib/activity";
import { useOwnerUnits } from "@/lib/selected-unit";
import { LangToggle } from "@/components/portal/LangToggle";
import { LogoMark } from "@/components/portal/Logo";
import { CurrencyConverter } from "@/components/portal/CurrencyConverter";
import { NotificationBell } from "@/components/portal/NotificationBell";
import { Button } from "@/components/ui/button";
import skyStarsLogo from "@/assets/sky-stars-logo.png";

import { SUPPORT_WHATSAPP } from "@/lib/support";


const linkClass =
  "relative py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground";

export function PortalShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery());
  const { data: staff } = useQuery(staffContextQuery());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMulti, units, selected } = useOwnerUnits();
  const { data: projects } = useQuery(projectsQuery());
  // Brand follows the villa being viewed: route unit on admin unit pages,
  // otherwise the currently selected unit, never just the first row.
  const routeUnitId = /^\/(?:admin\/)?units\/([^/?]+)/.exec(pathname)?.[1];
  const routeUnit = routeUnitId ? units.find((u) => u.id === routeUnitId) : undefined;
  const brandUnit = routeUnit ?? selected ?? units[0];
  const staffProjectId = staff?.roles.includes("luxso") ? staff.projectIds[0] : undefined;
  const project = projects?.find((p) => p.id === (staffProjectId ?? brandUnit?.project_id));
  const brandName = project?.name || t("brand.name");
  const brandCompany = project ? project.managed_by : t("brand.company");

  // Record the sign-in once per browser session for the activity journal.
  useEffect(() => {
    void logLoginOnce();
  }, []);


  // Sliding underline: measure the active nav item and move the rule to it.
  const navRef = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>("[data-nav-active='true']");
      if (!active) return setIndicator(null);
      const navBox = nav.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setIndicator({ left: box.left - navBox.left, width: box.width });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname, profile?.role, isMulti, t]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const isFinance = staff?.roles.includes("finance") ?? false;
  const isLuxso = staff?.roles.includes("luxso") ?? false;
  const isStaff = isFinance || isLuxso;
  const items = isFinance
    ? [{ to: "/finance", label: t("staff.finance") }, { to: "/profile", label: t("nav.profile") }]
    : isLuxso
      ? [{ to: "/management", label: t("staff.management") }, { to: "/profile", label: t("nav.profile") }]
      : [
    ...(profile?.role === "admin" ? [] : [{ to: "/dashboard", label: t("nav.dashboard") }]),
    isMulti
      ? { to: "/portfolio", label: t("portfolio.nav") }
      : { to: "/unit", label: t("nav.unit") },
    { to: "/documents", label: t("nav.documents") },
    { to: "/reports", label: t("nav.reports") },
    ...(profile?.role === "admin" ? [] : [{ to: "/calendar", label: t("nav.calendar") }]),
    ...(profile?.role === "admin" ? [] : [{ to: "/assistant", label: t("nav.assistant") }]),
    { to: "/messages", label: t("nav.messages") },
    { to: "/profile", label: t("nav.profile") },
    ...(profile?.role === "admin" ? [{ to: "/admin", label: t("nav.admin") }] : []),
        ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className="sticky top-0 z-20 border-b border-hairline bg-background/75"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3.5 sm:min-h-[76px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-8">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 sm:gap-3">
            {project?.code === "skystar" ? (
              <img
                src={skyStarsLogo}
                alt={brandName}
                width={1024}
                height={1024}
                className="block size-10 shrink-0 object-contain brightness-0"
              />
            ) : project?.mark_url ? (
              <img
                src={project.mark_url}
                alt={brandName}
                style={{ height: 32 }}
                className="block w-auto shrink-0"
              />
            ) : !project || project.code === "umalas" ? (
              <LogoMark size={32} />
            ) : null}
            <span className="min-w-0 leading-snug sm:leading-tight">
              <span className="wordmark block truncate text-[10px] text-foreground sm:text-[11px]">
                {brandName}
              </span>
              {brandCompany ? (
                <span className="eyebrow block truncate text-[10px] sm:text-[11px]">
                  {brandCompany}
                </span>
              ) : null}
            </span>
          </Link>

          <nav
            ref={navRef}
            className="relative flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] tracking-[0.1em] uppercase sm:gap-5 sm:text-[11px] sm:tracking-[0.14em]"
          >
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={linkClass}
                activeProps={{ className: "text-foreground", "data-nav-active": "true" }}
              >
                {item.label}
              </Link>
            ))}
            <NotificationBell />
            <LangToggle />

            <button type="button" onClick={signOut} className={linkClass}>
              {t("nav.signOut")}
            </button>
            {indicator ? (
              <span
                aria-hidden
                className="brand-rule pointer-events-none absolute bottom-0 h-[2px]"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transition:
                    "left 240ms cubic-bezier(0.16, 1, 0.3, 1), width 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            ) : null}
          </nav>
        </div>
        <div className="brand-rule h-[2px] w-full" />
      </header>

      <main key={pathname} className="anim-rise mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
        {children}
        <div className="mt-12">
          <CurrencyConverter />
        </div>
      </main>

      <footer className="border-t border-hairline px-4 py-6 text-center text-[10px] leading-relaxed tracking-[0.08em] text-muted-foreground uppercase sm:px-8 sm:text-[11px] sm:tracking-[0.12em]">
        <div className="space-y-2">
          <p>
            {t("brand.name")} —{" "}
            <a
              href={t("brand.companyUrl")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-colors duration-200 hover:text-violet"
            >
              {t("brand.company")}
            </a>
          </p>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#25D366] transition-colors duration-200 hover:text-[#128C7E]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t("support.whatsapp")}
          </a>
        </div>
      </footer>

      {profile?.role !== "admin" && !isStaff ? (
        <Button
          asChild
          className="fixed bottom-20 right-5 z-30 h-11 rounded-sm px-4 text-xs uppercase tracking-[0.12em] shadow-lg sm:right-6"
        >
          <Link to="/assistant" aria-label={t("assistant.askButton")}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("assistant.askButton")}
          </Link>
        </Button>
      ) : null}

      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("support.whatsapp")}
        className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
