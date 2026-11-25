import { createFileRoute, Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/portal/LangToggle";
import { ArcMark } from "@/components/portal/ArcMark";
import officialLockup from "@/assets/umalas-lockup-official.png.asset.json";

export const Route = createFileRoute("/help/admin")({
  head: () => ({
    meta: [
      { title: "Admin access help — The Umalas Signature" },
      {
        name: "description",
        content:
          "Step-by-step instructions for administrators signing in to The Umalas Signature owner portal.",
      },
      { property: "og:title", content: "Admin access help — The Umalas Signature" },
      {
        property: "og:description",
        content: "How to sign in to the administrator area of The Umalas Signature owner portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHelpPage,
});

function step(index: number) {
  return { animationDelay: `${index * 70}ms` } as React.CSSProperties;
}

const ADMIN_EMAILS = ["z.diana@magnumestate.pro"];

function AdminHelpPage() {
  const { t } = useI18n();

  const steps = [
    { title: t("helpAdmin.step1Title"), body: t("helpAdmin.step1Body") },
    { title: t("helpAdmin.step2Title"), body: t("helpAdmin.step2Body") },
    { title: t("helpAdmin.step3Title"), body: t("helpAdmin.step3Body") },
    { title: t("helpAdmin.step4Title"), body: t("helpAdmin.step4Body") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <a
            href="https://luxsomanagement.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium uppercase tracking-[0.16em] text-violet transition-colors hover:text-violet-deep"
          >
            {t("brand.company")}
          </a>
          <LangToggle />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero band */}
        <section className="relative overflow-hidden bg-plum-900 px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-600 blur-[100px]" />
            <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-rose-600 blur-[100px]" />
          </div>
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="anim-fade-up mb-6 flex justify-center" style={step(0)}>
              <ArcMark size={48} tone="white" />
            </div>
            <p className="anim-fade-up eyebrow mb-3 text-gold/80" style={step(1)}>
              {t("helpAdmin.adminOnly")}
            </p>
            <h1
              className="anim-fade-up font-display text-[32px] leading-[1.1] text-cream sm:text-[48px]"
              style={step(2)}
            >
              {t("helpAdmin.title")}
            </h1>
            <p
              className="anim-fade-up mx-auto mt-4 max-w-xl text-[15px] leading-7 text-cream/70"
              style={step(3)}
            >
              {t("helpAdmin.subtitle")}
            </p>
            <div
              className="anim-fade-up brand-rule mx-auto mt-8 h-[2px] w-24"
              style={step(4)}
            />
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-6 sm:gap-8">
            {steps.map((s, i) => (
              <div
                key={i}
                className="anim-fade-up group relative overflow-hidden rounded-sm border border-hairline bg-card p-6 transition-shadow duration-300 hover:shadow-[0_12px_40px_-16px_rgba(108,84,144,0.14)] sm:p-8"
                style={step(5 + i)}
              >
                <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-rose via-cream to-violet opacity-60" />
                <h2 className="font-display text-[22px] text-foreground">{s.title}</h2>
                <p className="type-body mt-2 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Email examples */}
          <div
            className="anim-fade-up mt-8 rounded-sm border border-hairline bg-card p-6 sm:mt-10 sm:p-8"
            style={step(9)}
          >
            <h3 className="font-display text-lg text-foreground">{t("helpAdmin.examples")}</h3>
            <div className="mt-4 space-y-3">
              {ADMIN_EMAILS.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-3 rounded-sm border border-hairline bg-background px-4 py-3 font-mono text-sm text-foreground"
                >
                  <span className="h-2 w-2 rounded-full bg-violet" />
                  {email}
                </div>
              ))}
            </div>
            <p className="type-body mt-4 text-muted-foreground">{t("helpAdmin.note")}</p>
          </div>

          {/* Back to login */}
          <div className="anim-fade-up mt-10 flex justify-center" style={step(10)}>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-sm border border-violet px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-violet transition-colors duration-200 hover:bg-violet hover:text-cream"
            >
              {t("helpAdmin.back")}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-plum-900 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
          <img
            src={officialLockup.url}
            alt={t("brand.name")}
            className="h-auto w-[120px] opacity-90"
          />
          <div className="h-px w-24 bg-gold/40" />
          <p className="text-center text-[11px] uppercase tracking-[0.14em] text-cream/60">
            {t("brand.name")} — {t("brand.company")}
          </p>
        </div>
      </footer>
    </div>
  );
}
