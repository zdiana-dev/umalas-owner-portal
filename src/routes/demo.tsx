import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import {
  DOC_CATEGORIES,
  REPORT_TYPES,
  type DocCategory,
  type ReportType,
} from "@/lib/portal-queries";
import { SectionTitle } from "@/components/portal/Figures";
import { UnitCard } from "@/components/portal/UnitCard";
import { ArcMark } from "@/components/portal/ArcMark";
import { LangToggle } from "@/components/portal/LangToggle";
import { Reveal } from "@/components/portal/Reveal";

import { UnitSwitcher } from "@/components/portal/UnitSwitcher";
import { DocumentFolders } from "@/components/portal/DocumentFolders";
import { DEMO_DOCUMENTS, DEMO_REPORTS, DEMO_UNITS } from "@/lib/demo-data";
import heroAsset from "@/assets/umalas-login.jpg.asset.json";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo Owner Portal — The Umalas Signature" },
      {
        name: "description",
        content:
          "Preview the Owner Portal of The Umalas Signature with sample data: unit summary, cumulative ROI, documents and quarterly reports.",
      },
      { property: "og:title", content: "Demo Owner Portal — The Umalas Signature" },
      {
        property: "og:description",
        content: "Sample owner cabinet: unit summary, documents and quarterly ROI reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:image", content: heroAsset.url },
      { name: "twitter:image", content: heroAsset.url },
    ],
  }),
  component: DemoPage,
});

type Tab = "unit" | "documents" | "reports";

/** Colour carries meaning: ROI → violet, documents → gold, IPL/reports → teal. */
const SECTION_HUE: Record<Tab, string> = {
  unit: "var(--violet-600)",
  documents: "var(--gold-600)",
  reports: "var(--teal-600)",
};

const LEGAL_CATEGORIES = new Set<DocCategory>([
  "mou",
  "lease_agreement",
  "addendum",
  "bast",
  "booking_form",
  "management_agreement",
]);

function docHue(category: DocCategory) {
  return LEGAL_CATEGORIES.has(category) ? "var(--plum-900)" : "var(--gold-600)";
}

function usePrefersMotion() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return ok;
}

function DemoPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("unit");
  const [unitId, setUnitId] = useState(DEMO_UNITS[0]!.id);

  const unit = DEMO_UNITS.find((u) => u.id === unitId) ?? DEMO_UNITS[0]!;
  const tabs: Tab[] = ["unit", "documents", "reports"];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <a
            href="https://luxsomanagement.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-soft"
          >
            {t("brand.company")}
          </a>
          <LangToggle tone="dark" />
        </div>
      </header>

      <DemoHero onWatch={() => document.getElementById("live")?.scrollIntoView({ behavior: "smooth" })} />

      <Teasers />

      <main
        id="live"
        className="mx-auto w-full max-w-5xl flex-1 scroll-mt-8 px-5 py-10 sm:px-8 sm:py-16"
      >
        <Reveal>
          <SectionTitle note={t("demo.badge")}>{t("demo.live")}</SectionTitle>
        </Reveal>

        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="mt-10">
          <UnitSwitcher units={DEMO_UNITS} selectedId={unit.id} onSelect={setUnitId} />
        </div>

        <div key={tab} className="anim-pop mt-10 sm:mt-16">
          {tab === "unit" && <DemoUnit unitId={unit.id} />}
          {tab === "documents" && <DemoDocuments unitId={unit.id} />}
          {tab === "reports" && <DemoReports unitId={unit.id} />}
        </div>
      </main>

      <DemoFooter />
    </div>
  );
}

function DemoHero({ onWatch }: { onWatch: () => void }) {
  const { t } = useI18n();
  const motionOk = usePrefersMotion();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!motionOk) return;
    const onScroll = () => setOffset(Math.min(120, window.scrollY * 0.4));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [motionOk]);

  return (
    <section className="relative isolate overflow-hidden bg-plum-900">
      <img
        src={heroAsset.url}
        alt="The Umalas Signature at twilight"
        className="anim-ken-burns absolute inset-0 h-[130%] w-full object-cover opacity-35"
        style={{ transform: `translateY(${offset}px)`, willChange: "transform" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "var(--scrim-login)" }}
      />
      <div
        aria-hidden
        className="orb pointer-events-none absolute -top-24 -left-16 size-[26rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(176,141,87,0.30), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="orb-slow pointer-events-none absolute -right-20 bottom-[-6rem] size-[22rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(161,139,196,0.35), transparent 70%)" }}
      />


      <div className="relative mx-auto w-full max-w-5xl px-5 pt-28 pb-14 sm:px-8 sm:pt-36 sm:pb-20">
        <div className="anim-fade-up flex flex-col items-start gap-3">
          <ArcMark size={44} tone="ink" className="text-gold" />
          <p className="wordmark text-[11px] text-cream sm:text-xs">{t("brand.name")}</p>
        </div>

        <p className="chip chip-gold anim-fade-up mt-8" style={{ animationDelay: "80ms" }}>
          <span className="dot-pulse size-1.5 rounded-full bg-gold" aria-hidden />
          {t("demo.badgeLong")}
        </p>

        <h1
          className="anim-fade-up type-hero mt-5 max-w-2xl text-balance text-cream"
          style={{ animationDelay: "140ms" }}
        >
          {t("demo.title")}
        </h1>
        <p
          className="anim-fade-up mt-4 max-w-xl text-[15px] leading-6 text-cream/70"
          style={{ animationDelay: "200ms" }}
        >
          {t("demo.disclaimer")}
        </p>

        <div
          className="anim-fade-up mt-8 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "260ms" }}
        >
          <button
            type="button"
            onClick={onWatch}
            className="btn-gold rounded-sm px-6 py-3 text-[11px] tracking-[0.16em] uppercase"
          >
            {t("demo.cta")}
          </button>
          <Link
            to="/"
            className="btn-ghost-cream rounded-sm px-6 py-3 text-[11px] tracking-[0.16em] uppercase"
          >
            {t("demo.signIn")}
          </Link>
        </div>
      </div>

      <div className="rule-gold absolute inset-x-0 bottom-0 h-px" />
    </section>
  );
}

function Teasers() {
  const { t } = useI18n();
  const cards: { tab: Tab; index: string; body: TranslationKey }[] = [
    { tab: "unit", index: "01", body: "demo.t1Body" },
    { tab: "documents", index: "02", body: "demo.t2Body" },
    { tab: "reports", index: "03", body: "demo.t3Body" },
  ];

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-10 sm:grid-cols-3 sm:px-8 sm:py-16">
      {cards.map(({ tab, index, body }, i) => (
        <Reveal
          key={tab}
          as="article"
          delay={i * 110}
          className="teaser-card rounded-sm px-5 py-6"
        >
          <div className="contents" style={{ ["--teaser-hue" as string]: SECTION_HUE[tab] }}>
          <span
            aria-hidden
            className="figure pointer-events-none absolute top-2 right-4 text-6xl leading-none"
            style={{ color: SECTION_HUE[tab], opacity: 0.08 }}
          >
            {index}
          </span>
          <h3 className="type-section relative">{t(`nav.${tab}` as TranslationKey)}</h3>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{t(body)}</p>
            <div className="brand-rule teaser-rule mt-5 h-px w-full" />
          </div>
        </Reveal>
      ))}
    </section>
  );
}

function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Tab[];
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);

  return (
    <div ref={wrap} className="relative mt-8 flex flex-wrap gap-8 border-b border-hairline pb-3">
      {tabs.map((item) => (
        <button
          key={item}
          type="button"
          data-active={item === value}
          onClick={() => onChange(item)}
          className={`text-[11px] tracking-[0.16em] uppercase transition-colors duration-200 ${
            item === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`nav.${item}` as TranslationKey)}
        </button>
      ))}
      {bar && (
        <span
          aria-hidden
          className="tab-indicator"
          style={{ left: 0, transform: `translateX(${bar.x}px)`, width: bar.w }}
        />
      )}
    </div>
  );
}

function DemoFooter() {
  const { t } = useI18n();
  return (
    <footer className="surface-dark mt-4 rounded-none border-x-0 border-b-0 px-5 py-10 sm:px-8 sm:py-14">
      <Reveal className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center">
        <ArcMark size={36} tone="ink" className="text-gold" />
        <p className="wordmark text-[11px] text-cream sm:text-xs">{t("brand.name")}</p>
        <p className="text-[11px] tracking-[0.14em] text-cream/60 uppercase">{t("demo.place")}</p>
        <div className="rule-gold my-4 h-px w-full max-w-md" />
        <p className="text-xs leading-relaxed text-cream/55">{t("demo.note")}</p>
        <p className="text-xs leading-relaxed text-cream/40">{t("demo.rights")}</p>
      </Reveal>
    </footer>
  );
}

function DemoUnit({ unitId }: { unitId: string }) {
  const { t } = useI18n();
  const unit = DEMO_UNITS.find((u) => u.id === unitId)!;
  const roiReports = DEMO_REPORTS.filter(
    (r) => r.unit_id === unitId && r.report_type === "roi" && r.net_payout != null,
  );
  const received = roiReports.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0);
  const currency = roiReports[0]?.currency ?? "IDR";

  return (
    <div className="space-y-10 sm:space-y-16">
      <SectionTitle note={unit.code}>{t("unit.title")}</SectionTitle>
      <UnitCard
        unit={unit}
        received={received}
        currency={currency}
        hasSummary={roiReports.length > 0}
      />
    </div>
  );
}

function DemoDocuments({ unitId }: { unitId: string }) {
  const { t, lang } = useI18n();
  const [folder, setFolder] = useState<DocCategory | "all" | "my_documents">("my_documents");
  const rows = DEMO_DOCUMENTS.filter((d) => d.unit_id === unitId);
  const visible =
    folder === "all" || folder === "my_documents" ? rows : rows.filter((d) => d.category === folder);

  return (
    <div className="space-y-10">
      <SectionTitle note={t("demo.badge")}>{t("doc.title")}</SectionTitle>

      {rows.length > 0 && (
        <DocumentFolders rows={rows} selected={folder} onSelect={setFolder} t={t} />
      )}

      {folder === "all"
        ? DOC_CATEGORIES.map((category) => {
            const group = visible.filter((doc) => doc.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category}>
                <p className="eyebrow border-b border-hairline pb-2">
                  {t(`doc.${category}` as TranslationKey)}
                </p>
                <ul>
                  {group.map((doc, i) => (
                    <DemoDocumentRow key={doc.id} doc={doc} lang={lang} index={i} />
                  ))}
                </ul>
              </section>
            );
          })
        : visible.length > 0 && (
            <ul>
              {visible.map((doc, i) => (
                <DemoDocumentRow key={doc.id} doc={doc} lang={lang} index={i} />
              ))}
            </ul>
          )}
    </div>
  );
}

function DemoDocumentRow({
  doc,
  lang,
  index = 0,
}: {
  doc: { title: string; issued_date: string | null; category: DocCategory };
  lang: "ru" | "en";
  index?: number;
}) {
  const { t } = useI18n();
  return (
    <li
      className="row-brand anim-row-in flex flex-wrap items-center justify-between gap-3 py-3.5"
      style={{
        ["--row-accent" as string]: docHue(doc.category),
        ["--row-i" as string]: index,
      }}
    >
      <div className="min-w-0">
        <p className="text-[15px] leading-6">{doc.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(`doc.${doc.category}` as TranslationKey)} · {formatDate(doc.issued_date, lang)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="chip chip-palm">{t("status.published")}</span>
        <button
          type="button"
          onClick={() => toast.info(t("demo.fileHint"))}
          className="row-action text-[11px] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-violet"
        >
          {t("doc.download")}
        </button>
      </div>
    </li>
  );
}

function DemoReports({ unitId }: { unitId: string }) {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<ReportType | "all">("all");
  const rows = DEMO_REPORTS.filter(
    (r) => r.unit_id === unitId && (filter === "all" || r.report_type === filter),
  );
  const filters: (ReportType | "all")[] = ["all", ...REPORT_TYPES];

  return (
    <div className="space-y-10">
      <SectionTitle note={t("demo.badge")}>{t("rep.title")}</SectionTitle>

      <div className="flex flex-wrap gap-5 text-[11px] tracking-[0.16em] uppercase">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "text-foreground"
                : "text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {value === "all" ? t("rep.all") : t(`rep.${value}` as TranslationKey)}
          </button>
        ))}
      </div>

      <ul>
        {rows.map((report, i) => (
          <li
            key={report.id}
            className="row-brand anim-row-in flex flex-wrap items-center justify-between gap-3 py-4"
            style={{
              ["--row-i" as string]: i,
              ["--row-accent" as string]:
                report.report_type === "roi"
                  ? "var(--violet-600)"
                  : report.report_type === "ipl"
                    ? "var(--teal-600)"
                    : "var(--gold-600)",
            }}
          >
            <div className="min-w-0">
              <p className="text-[15px] leading-6">{report.period_label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`rep.${report.report_type}` as TranslationKey)}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <span
                className={`chip ${report.report_type === "ipl" ? "chip-teal" : "chip-violet"}`}
              >
                {t(`rep.${report.report_type}` as TranslationKey)}
              </span>
              <span className="figure text-sm">
                {report.net_payout != null
                  ? formatMoney(Number(report.net_payout), report.currency, lang)
                  : t("common.none")}
              </span>
              <button
                type="button"
                onClick={() => toast.info(t("demo.fileHint"))}
                className="row-action text-[11px] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-violet"
              >
                {t("rep.download")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
