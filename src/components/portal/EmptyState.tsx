import type { ReactNode } from "react";

import { ArcMark } from "@/components/portal/ArcMark";
import { cn } from "@/lib/utils";

/**
 * Calm empty state: the arc mark draws itself, then the copy fades in below.
 * No card, no border — an empty state is not content.
 */
export function EmptyState({
  title,
  hint,
  action,
  size = 56,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-md px-4 py-[120px] text-center", className)}>
      <ArcMark size={size} tone="gradient" animate className="mx-auto mb-7 sm:mb-8" />
      <p
        className="anim-fade-up font-display text-[22px] leading-[1.3] text-foreground"
        style={{ animationDelay: "1200ms" }}
      >
        {title}
      </p>
      {hint ? (
        <p
          className="anim-fade-up mt-3 text-sm leading-6 text-muted-foreground"
          style={{ animationDelay: "1270ms" }}
        >
          {hint}
        </p>
      ) : null}
      {action ? (
        <div className="anim-fade-up mt-5" style={{ animationDelay: "1340ms" }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

/** 25ms stagger, capped at the first 15 rows so long lists stay instant. */
export function staggerDelay(index: number) {
  return { animationDelay: `${Math.min(index, 15) * 25}ms` };
}
