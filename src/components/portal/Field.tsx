import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  error?: string | undefined;
  className?: string | undefined;
  tone?: "light" | "onImage";
} & InputHTMLAttributes<HTMLInputElement>;

/**
 * Text field with a two-layer rule: a static hairline plus a brand-gradient
 * line that scales from the centre on focus. Errors tint the rule rose and the
 * message fades in beneath, so the layout never jumps.
 */
export function Field({ label, error, className, tone = "light", ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [filled, setFilled] = useState(Boolean(input.defaultValue ?? input.value));
  const [revealed, setRevealed] = useState(false);
  const lifted = focused || filled || Boolean(input.value);
  const isPassword = input.type === "password";

  return (
    <label className={cn("block", className)}>
      <span
        className={cn(
          "block uppercase transition-all duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          lifted ? "text-[11px] tracking-[0.16em]" : "text-[12px] tracking-[0.12em]",
          error
            ? "text-rose"
            : tone === "onImage"
              ? "text-foreground/70"
              : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="relative mt-2 flex items-center">
        <input
          {...input}
          type={isPassword && revealed ? "text" : input.type}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setFilled(Boolean(e.currentTarget.value));
            input.onBlur?.(e);
          }}
          onChange={(e) => {
            setFilled(Boolean(e.currentTarget.value));
            input.onChange?.(e);
          }}
          className={cn(
            "w-full bg-transparent pb-2 text-[15px] leading-6 text-foreground outline-none",
            isPassword && "pr-9",
          )}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            onClick={(e) => {
              e.preventDefault();
              setRevealed((v) => !v);
            }}
            className="absolute right-0 bottom-2 text-muted-foreground transition-colors duration-200 hover:text-violet"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </span>

      <span className="field-rule block" style={error ? { backgroundColor: "#9C5454" } : undefined}>
        <span
          style={{
            transform: focused ? "scaleX(1)" : "scaleX(0)",
            ...(error ? { background: "#9C5454" } : null),
          }}
        />
      </span>
      <span
        className="mt-2 block text-xs text-rose transition-opacity duration-[320ms]"
        style={{ opacity: error ? 1 : 0 }}
        aria-live="polite"
      >
        {error ?? "\u00A0"}
      </span>
    </label>
  );
}
