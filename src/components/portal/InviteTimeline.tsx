import { useI18n } from "@/lib/i18n";

export type OwnerAuthStatus = {
  last_sign_in_at?: string | null;
  account_created_at?: string | null;
  invited_at?: string | null;
  confirmed_at?: string | null;
  recovery_sent_at?: string | null;
  last_invite_at?: string | null;
};

function formatStamp(value: string | null | undefined, lang: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact invite lifecycle: account created -> invite sent -> first sign-in. */
export function InviteTimeline({
  status,
  variant = "steps",
}: {
  status: OwnerAuthStatus;
  variant?: "steps" | "line";
}) {
  const { t, lang } = useI18n();
  const sentAt = status.last_invite_at ?? status.invited_at ?? status.recovery_sent_at ?? null;
  const signedIn = Boolean(status.last_sign_in_at);

  if (variant === "line") {
    const parts = [
      `${t("admin.timelineCreated")} ${formatStamp(status.account_created_at, lang)}`,
      sentAt
        ? `${t("admin.timelineInviteSent")} ${formatStamp(sentAt, lang)}`
        : t("admin.timelineNotSent"),
      signedIn
        ? `${t("admin.timelineFirstSignIn")} ${formatStamp(status.last_sign_in_at, lang)}`
        : `${t("admin.timelineFirstSignIn")} — ${t("admin.timelinePending")}`,
    ];
    return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
  }



  const steps: Array<{ key: string; label: string; at: string | null; done: boolean }> = [
    {
      key: "created",
      label: t("admin.timelineCreated"),
      at: status.account_created_at ?? null,
      done: Boolean(status.account_created_at),
    },
    {
      key: "sent",
      label: t("admin.timelineInviteSent"),
      at: sentAt,
      done: Boolean(sentAt),
    },
    {
      key: "entered",
      label: t("admin.timelineFirstSignIn"),
      at: status.last_sign_in_at ?? null,
      done: signedIn,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`border px-2 py-1 text-[10px] tracking-[0.12em] uppercase ${
            signedIn
              ? "border-hairline bg-brand-cream/40 text-foreground"
              : "border-gold/30 bg-gold/10 text-gold"
          }`}
        >
          {signedIn ? t("admin.signedIn") : t("admin.neverSignedIn")}
        </span>
        {sentAt ? (
          <span className="text-[11px] text-muted-foreground">
            {t("admin.timelineLastSent")}: {formatStamp(sentAt, lang)}
          </span>
        ) : (
          <span className="text-[11px] text-gold">{t("admin.timelineNotSent")}</span>
        )}
      </div>

      <ol className="flex flex-wrap items-stretch gap-x-6 gap-y-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${
                step.done ? "bg-violet" : "bg-hairline"
              }`}
            />
            <span className="leading-tight">
              <span
                className={`block text-[10px] tracking-[0.12em] uppercase ${
                  step.done ? "text-muted-foreground" : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
              <span
                className={`figure block text-xs ${
                  step.done ? "text-foreground" : "text-muted-foreground/60"
                }`}
              >
                {step.done ? formatStamp(step.at, lang) : t("admin.timelinePending")}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
