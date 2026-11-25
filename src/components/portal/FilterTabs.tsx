import { useLayoutEffect, useRef, useState } from "react";

export type FilterTab<T extends string> = {
  value: T;
  label: string;
  count: number;
  /** never grey out the "all" tab */
  alwaysEnabled?: boolean;
};

/**
 * Filter tabs with the shared sliding brand-gradient indicator (280ms).
 * Tabs with zero items are greyed out and not clickable.
 */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const active = wrap.querySelector<HTMLElement>("[data-tab-active='true']");
      if (!active) return setIndicator(null);
      const box = active.getBoundingClientRect();
      const wrapBox = wrap.getBoundingClientRect();
      setIndicator({ left: box.left - wrapBox.left, width: box.width });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tabs, value]);

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-hairline pb-5 text-[12px] tracking-[0.13em] uppercase"
    >
      {tabs.map((tab) => {
        const disabled = !tab.alwaysEnabled && tab.count === 0;
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tab.value)}
            data-tab-active={active ? "true" : undefined}
            className={`focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
              active
                ? "flex items-baseline gap-2 text-foreground"
                : disabled
                  ? "flex cursor-not-allowed items-baseline gap-2 text-muted-foreground/40"
                  : "flex items-baseline gap-2 text-muted-foreground transition-colors hover:text-foreground"
            }`}
          >
            <span>{tab.label}</span>
            <span className="figure text-[11px] opacity-70">{tab.count}</span>
          </button>
        );
      })}
      {indicator ? (
        <span
          aria-hidden
          className="tab-indicator"
          style={{ left: 0, transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      ) : null}
    </div>
  );
}
