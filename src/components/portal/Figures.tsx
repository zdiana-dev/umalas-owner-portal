import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function prefersMotion() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a numeric figure up from zero over 700ms with an ease-out curve.
 * `render` keeps money/percent formatting in the caller's hands; tabular figures
 * mean the width never shifts mid-count. Static when motion is reduced.
 */
export function CountUp({
  value,
  render,
  duration = 700,
}: {
  value: number;
  render: (n: number) => ReactNode;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!prefersMotion() || !Number.isFinite(value) || value === 0) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(value * eased);
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return <>{render(shown)}</>;
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-hairline pb-3">
      <h2 className="type-section">{children}</h2>
      {note ? <span className="eyebrow">{note}</span> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-hairline pt-4", className)}>
      <p className="eyebrow">{label}</p>
      <p className="figure text-flow mt-3 text-2xl leading-none sm:type-figure">{value}</p>
      {sub ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3">
      <span className="text-xs leading-5 tracking-[0.06em] text-muted-foreground">{label}</span>
      <span className="figure text-sm leading-5">{value}</span>
    </div>
  );
}

/** Fills from 0 to its value over 900ms with the brand gradient. */
export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const [width, setWidth] = useState(prefersMotion() ? 0 : clamped);

  useEffect(() => {
    if (!prefersMotion()) {
      setWidth(clamped);
      return;
    }
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className="h-[3px] w-full bg-cream">
      <div
        className="brand-rule h-full"
        style={{
          width: `${width}%`,
          transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

/** Skeleton block with a slow left-to-right shimmer — never a centred spinner. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer h-4 w-full rounded-sm", className)} />;
}

export function SkeletonLines({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className={i === rows - 1 ? "w-2/3" : ""} />
      ))}
    </div>
  );
}
