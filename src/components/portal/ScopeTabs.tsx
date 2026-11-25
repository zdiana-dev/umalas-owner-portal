import { useI18n } from "@/lib/i18n";
import type { Unit } from "@/lib/portal-queries";
import { FilterTabs } from "@/components/portal/FilterTabs";

/**
 * «Все объекты» / one unit. Only rendered for owners holding several units;
 * four adjacent codes read faster as tabs than as a dropdown.
 */
export function ScopeTabs({
  units,
  scope,
  onChange,
  countFor,
}: {
  units: Unit[];
  scope: string;
  onChange: (value: string) => void;
  countFor: (unitId: string) => number;
}) {
  const { t } = useI18n();
  const sorted = [...units].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-8 gap-y-4">
      <span className="eyebrow">{t("scope.label")}</span>
      <div className="min-w-0 flex-1">
      <FilterTabs
        tabs={[
          { value: "all", label: t("scope.all"), count: units.length, alwaysEnabled: true },
          ...sorted.map((unit) => ({
            value: unit.id,
            label: unit.code,
            count: countFor(unit.id),
            alwaysEnabled: true,
          })),
        ]}
        value={scope}
        onChange={onChange}
      />
      </div>
    </div>
  );
}
