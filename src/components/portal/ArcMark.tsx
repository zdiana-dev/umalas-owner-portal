import { useId } from "react";

const CIRC = 2 * Math.PI * 44;

import { cn } from "@/lib/utils";

/**
 * Vector version of the Umalas arc mark (300° circle + serif "U").
 * Used where the raster lockup cannot adapt: white over the login photograph,
 * brand-gradient stroke on the form side, and the animated empty state.
 */
export function ArcMark({
  size = 40,
  tone = "gradient",
  animate = false,
  className,
}: {
  size?: number;
  tone?: "gradient" | "white" | "ink";
  animate?: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `arc-${id}`;
  const stroke =
    tone === "gradient" ? `url(#${gradientId})` : tone === "white" ? "#FFFFFF" : "currentColor";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="The Umalas Signature"
      className={cn("block shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9C5454" />
          <stop offset="50%" stopColor="#C9A88F" />
          <stop offset="100%" stopColor="#6C5490" />
        </linearGradient>
      </defs>
      {/* 300° arc: full circle stroke with 5/6 of the circumference drawn */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        transform="rotate(120 50 50)"
        strokeDasharray={animate ? undefined : `${CIRC * (300 / 360)} ${CIRC}`}
        className={animate ? "anim-arc-draw" : undefined}
        style={
          animate
            ? ({
                "--dash-length": CIRC,
                strokeDasharray: `${CIRC * (300 / 360)} ${CIRC}`,
              } as React.CSSProperties)
            : undefined
        }
      />
      <text
        x="50"
        y="64"
        textAnchor="middle"
        fill={stroke}
        style={{ font: '400 42px var(--font-display, Georgia), serif' }}
      >
        U
      </text>
    </svg>
  );
}
