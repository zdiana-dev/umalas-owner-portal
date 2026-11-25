import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const options: Lang[] = ["ru", "en"];

export function LangToggle({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const { lang, setLang } = useI18n();
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.14em]",
        dark
          ? "border-cream/35 bg-white/10 backdrop-blur-sm"
          : "border-hairline bg-card/70",
        className,
      )}
    >
      {options.map((option, index) => (
        <span key={option} className="flex items-center gap-1">
          {index > 0 && (
            <span className={dark ? "text-cream/40" : "text-hairline"}>/</span>
          )}
          <button
            type="button"
            onClick={() => setLang(option)}
            aria-pressed={lang === option}
            className={cn(
              "uppercase transition-colors",
              lang === option
                ? dark
                  ? "text-gold"
                  : "text-violet"
                : dark
                  ? "text-cream/70 hover:text-cream"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        </span>
      ))}
    </div>
  );
}
