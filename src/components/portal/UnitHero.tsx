import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsQuery } from "@/lib/portal-queries";

import { useI18n } from "@/lib/i18n";
import type { Unit } from "@/lib/portal-queries";
import heroAsset from "@/assets/umalas-login.jpg.asset.json";

/** Scrim spelled out here so the cabinet band always matches the demo hero. */
const SCRIM =
  "linear-gradient(115deg, rgba(30,22,45,0.82) 0%, rgba(108,84,144,0.55) 45%, rgba(156,84,84,0.30) 100%)";

type HeroUnit = {
  id?: string;
  code: string;
  building?: string | null;
  floor?: number | string | null;
  unit_type?: string | null;
  coefficient?: number | string | null;
  project_id?: string | null;
};

export function UnitHero({
  unit,
  variant = "unit",
  title,
  units,
  onSelect,
  imageUrl,
  className,
}: {
  unit: HeroUnit;
  /** "unit" = tall profile hero, "band" = short section band. */
  variant?: "unit" | "band";
  /** Section name shown as the heading in the "band" variant. */
  title?: ReactNode;
  units?: Unit[] | undefined;
  onSelect?: ((id: string) => void) | undefined;
  imageUrl?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { data: projects } = useQuery(projectsQuery());
  const projectCover = projects?.find((p) => p.id === unit.project_id)?.logo_url;
  const src = imageUrl ?? projectCover ?? heroAsset.url;
  const tall = variant === "unit";
  const heightClass = tall ? "min-h-[200px] sm:min-h-[300px]" : "min-h-[120px] sm:min-h-[160px]";

  const place = [
    unit.building ? `${t("unit.building")} ${unit.building}` : null,
    unit.floor != null && unit.floor !== "" ? `${t("unit.floor")} ${unit.floor}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  const coefficient =
    unit.coefficient != null && unit.coefficient !== ""
      ? `${t("unit.coefficient")} ${unit.coefficient}`
      : null;
  const subtitle = [unit.unit_type, coefficient].filter(Boolean).join(" · ");

  const switcher =
    units && units.length > 1 && onSelect ? (
      <div className="flex flex-wrap gap-2">
        {units.map((item) => {
          const active = item.id === unit.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`figure rounded-full border px-3.5 py-1 text-xs transition-colors duration-200 ${
                active
                  ? "border-cream bg-cream text-plum-900"
                  : "border-cream/40 text-cream/80 hover:border-cream hover:text-cream"
              }`}
            >
              {item.code}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <section
      className={`relative isolate -mx-5 overflow-hidden bg-plum-900 sm:-mx-8 ${heightClass} ${className ?? ""}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        className="anim-hero-zoom absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center 60%" }}
      />
      <div aria-hidden className="absolute inset-0" style={{ background: SCRIM }} />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-24"
        style={{ background: "linear-gradient(to top, rgba(30,22,45,0.55), transparent)" }}
      />

      <div
        className={`relative mx-auto flex w-full max-w-[1100px] flex-col justify-end px-5 sm:px-8 ${
          tall ? "min-h-[200px] py-8 sm:min-h-[300px] sm:py-10" : "min-h-[120px] py-6 sm:min-h-[160px] sm:py-7"
        }`}
      >
        {tall ? (
          <>
            {place ? (
              <p className="chip chip-gold anim-fade-up self-start">{place}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h1
                  className="anim-fade-up font-display text-[30px] leading-none text-cream sm:text-[44px]"
                  style={{ animationDelay: "60ms" }}
                >
                  {unit.code}
                </h1>
                {subtitle ? (
                  <p
                    className="anim-fade-up mt-3 text-[13px] leading-5 text-cream/75 sm:text-sm"
                    style={{ animationDelay: "120ms" }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {switcher ? (
                <div className="anim-fade-up w-full sm:w-auto" style={{ animationDelay: "180ms" }}>
                  {switcher}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <h1 className="anim-fade-up font-display text-[26px] leading-none text-cream sm:text-[34px]">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-4">
              {switcher ?? (
                <span
                  className="figure anim-fade-up text-sm text-cream/70"
                  style={{ animationDelay: "60ms" }}
                >
                  {unit.code}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
