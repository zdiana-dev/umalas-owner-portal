import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";
import type { Unit } from "@/lib/portal-queries";
import { SkeletonBlock } from "@/components/portal/Figures";

/**
 * Few units -> quiet inline pills.
 * Many units -> a searchable dropdown, so the page never turns into a wall of codes.
 */
export function UnitSwitcher({
  units,
  selectedId,
  onSelect,
  isLoading,
}: {
  units: Unit[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  isLoading?: boolean | undefined;
}) {
  const { t } = useI18n();

  if (isLoading) return <UnitSwitcherSkeleton />;
  if (units.length < 2) return null;
  if (units.length <= 8) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="eyebrow">{t("unit.switch")}</span>
        <div className="flex flex-wrap gap-2">
          {units.map((unit) => {
            const active = unit.id === selectedId;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => onSelect(unit.id)}
                className={`figure rounded-full border px-4 py-1.5 text-sm transition-colors duration-200 ${
                  active
                    ? "border-transparent bg-violet text-cream"
                    : "border-border text-muted-foreground hover:border-violet/40 hover:text-foreground"
                }`}
              >
                {unit.code}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return <UnitPicker units={units} selectedId={selectedId} onSelect={onSelect} />;
}

function UnitSwitcherSkeleton() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="eyebrow">{t("unit.switch")}</span>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className="h-[31px] w-20 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}

function UnitPicker({
  units,
  selectedId,
  onSelect,
}: {
  units: Unit[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = units.find((unit) => unit.id === selectedId);
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return units;
    return units.filter(
      (unit) =>
        unit.code.toLowerCase().includes(needle) ||
        (unit.building ?? "").toLowerCase().includes(needle) ||
        (unit.unit_type ?? "").toLowerCase().includes(needle),
    );
  }, [units, needle]);

  useEffect(() => {
    if (!open) return;
    // Focus reliably when the dropdown opens, even if autoFocus is suppressed
    // by React's conditional rendering.
    requestAnimationFrame(() => inputRef.current?.focus());

    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function highlight(text: string, isActive = false) {
    if (!needle) return <>{text}</>;
    const lower = text.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let index = lower.indexOf(needle, cursor);

    while (index !== -1 && cursor < text.length) {
      if (index > cursor) {
        parts.push(<span key={`pre-${cursor}`}>{text.slice(cursor, index)}</span>);
      }
      const match = text.slice(index, index + needle.length);
      parts.push(
        <mark
          key={`match-${index}`}
          className={`rounded-sm px-0.5 font-medium ${
            isActive
              ? "bg-cream/25 text-cream"
              : "bg-gold/20 text-foreground"
          }`}
        >
          {match}
        </mark>,
      );
      cursor = index + needle.length;
      index = lower.indexOf(needle, cursor);
    }

    if (cursor < text.length) {
      parts.push(<span key={`post-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return <>{parts}</>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="eyebrow">{t("unit.switch")}</span>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setQuery("");
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="figure flex min-w-44 items-center justify-between gap-4 rounded-full border border-border bg-card px-5 py-2.5 text-sm transition-all duration-200 hover:border-violet/40 hover:shadow-sm"
        >
          <span className="truncate">{selected?.code ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{units.length}</span>
        </button>

        {open && (
          <div className="absolute left-0 z-30 mt-3 min-w-80 max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="border-b border-hairline px-5 py-3">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  ref={inputRef}
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("unit.search")}
                  aria-label={t("unit.search")}
                  className="figure w-full bg-transparent pl-7 pr-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <ul role="listbox" className="max-h-80 overflow-y-auto py-2">
              {results.map((unit) => {
                const active = unit.id === selectedId;
                const caption = [unit.building, unit.unit_type]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={unit.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onSelect(unit.id);
                        setOpen(false);
                      }}
                      className={`group flex w-full items-center justify-between border-b border-hairline px-5 py-3.5 text-left transition-colors last:border-b-0 ${
                        active
                          ? "bg-violet text-cream"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className={`figure truncate text-sm font-medium tracking-wide ${active ? "text-cream" : ""}`}>
                          {highlight(unit.code, active)}
                        </span>
                        {caption && (
                          <span className={`text-xs ${active ? "text-cream/70" : "text-muted-foreground/80"}`}>
                            {highlight(caption, active)}
                          </span>
                        )}
                      </div>
                      {active && (
                        <span className="ml-4 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cream/30 bg-cream/10">
                          <svg
                            className="h-3 w-3 text-cream"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && (
                <li className="px-5 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-cream/50">
                    <svg
                      className="h-4 w-4 text-muted-foreground"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground">{t("unit.noMatches")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("unit.searchHint")}
                  </p>
                </li>
              )}
            </ul>

            <div className="border-t border-hairline px-5 py-2.5 text-right text-xs text-muted-foreground/70">
              {results.length} / {units.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
