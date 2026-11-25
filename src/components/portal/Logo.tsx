import { cn } from "@/lib/utils";

import markAsset from "@/assets/umalas-mark.png.asset.json";
import lockupAsset from "@/assets/umalas-lockup.png.asset.json";

/**
 * The Umalas Signature mark — official emblem artwork (arc with the serif "U").
 * Single source of truth for the mark; swap the asset pointer to update it.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={markAsset.url}
      alt="The Umalas Signature"
      width={size}
      height={size}
      style={{ height: size }}
      className={cn("block w-auto shrink-0", className)}
    />
  );
}

export function Logo({
  size = 88,
  showWordmark = true,
  showManager = false,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  showManager?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {showWordmark ? (
        <img
          src={lockupAsset.url}
          alt="The Umalas Signature"
          style={{ height: Math.round(size * 1.3) }}
          className="block w-auto"
        />
      ) : (
        <LogoMark size={size} />
      )}
      {showManager && (
        <a
          href="https://luxsomanagement.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="eyebrow mt-3 text-[10px] tracking-[0.14em] text-muted-foreground transition-colors duration-200 hover:text-brand-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40 sm:text-[11px]"
        >
          Managed by LUXSO
        </a>
      )}
    </div>
  );
}
