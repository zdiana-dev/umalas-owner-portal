import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Inline spinner — the label swaps for this, the page never blanks. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 rounded-full border border-current border-t-transparent align-[-2px]",
        className,
      )}
      style={{ animation: "brand-spin 700ms linear infinite" }}
    />
  );
}

export function BrandButton({
  children,
  busy = false,
  className,
  ...button
}: { children: ReactNode; busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...button}
      disabled={button.disabled || busy}
      className={cn(
        "btn-brand anim-sweep flex w-full items-center justify-center gap-3 py-3.5 text-[11px] tracking-[0.18em] uppercase disabled:opacity-60",
        className,
      )}
    >
      {busy ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  );
}
