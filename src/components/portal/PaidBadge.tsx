import { useI18n } from "@/lib/i18n";

/** Red / green payment status for a payout report. */
export function PaidBadge({ paid, paidAt, noRoiPayment = false }: { paid: boolean; paidAt?: string | null; noRoiPayment?: boolean | undefined }) {
  const { t, lang } = useI18n();
  if (noRoiPayment) return <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted px-2.5 py-1 text-[10px] uppercase whitespace-nowrap text-muted-foreground">{t("rep.noRoiPayment")}</span>;
  const when =
    paid && paidAt
      ? new Date(paidAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.12em] uppercase whitespace-nowrap",
        paid
          ? "border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
          : "border-rose-700/25 bg-rose-700/10 text-rose-700",
      ].join(" ")}
      title={when ?? undefined}
    >
      <span
        aria-hidden
        className={["size-1.5 rounded-full", paid ? "bg-emerald-600" : "bg-rose-700"].join(" ")}
      />
      {paid ? t("rep.paid") : t("rep.unpaid")}
    </span>
  );
}
