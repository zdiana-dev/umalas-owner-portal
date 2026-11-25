import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/portal/EmptyState";

/** Calm empty state: the arc draws itself, then the message fades in below. */
export function NoUnits() {
  const { t } = useI18n();
  return <EmptyState size={64} title={t("unit.none")} hint={t("unit.noneHint")} className="py-16" />;
}
