import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ownershipsQuery, profileQuery, unitsQuery, type Unit } from "./portal-queries";

const STORAGE_KEY = "umalas.unit";
const SCOPE_KEY = "umalas.scope";

/**
 * Units the signed-in owner currently holds, plus a remembered selection so the
 * three owner screens stay on the same unit while navigating.
 *
 * `initialUnitId` is used once on mount so a deep link (e.g. from the admin
 * "Open owner cabinet" button) can focus a specific unit.
 */
export function useOwnerUnits(initialUnitId?: string | null) {
  const profile = useQuery(profileQuery());
  const units = useQuery(unitsQuery());
  const ownerships = useQuery(ownershipsQuery());
  const [selectedId, setSelectedId] = useState<string | null>(initialUnitId ?? null);

  useEffect(() => {
    if (initialUnitId) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedId(stored);
  }, [initialUnitId]);

  const isAdmin = profile.data?.role === "admin";

  const ownedUnits = useMemo<Unit[]>(() => {
    const all = units.data ?? [];
    if (isAdmin) return all;
    const today = new Date().toISOString().slice(0, 10);
    const ids = new Set(
      (ownerships.data ?? [])
        .filter(
          (o) =>
            o.owner_id === profile.data?.user_id &&
            o.start_date <= today &&
            (!o.end_date || o.end_date > today),
        )
        .map((o) => o.unit_id),
    );
    return all.filter((u) => ids.has(u.id));
  }, [units.data, ownerships.data, profile.data, isAdmin]);

  const selected = ownedUnits.find((u) => u.id === selectedId) ?? ownedUnits[0] ?? null;

  function select(id: string) {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return {
    isLoading: profile.isLoading || units.isLoading || ownerships.isLoading,
    units: ownedUnits,
    selected,
    select,
    /** Portfolio owners only: admins keep the single-unit, deep-linked flow. */
    isMulti: !isAdmin && ownedUnits.length > 1,
    isAdmin,
  };
}

/**
 * «Все объекты» / one unit scope for Documents and Reports, remembered across
 * tab switches. Single-unit owners never see it.
 */
export function useUnitScope(units: Unit[], isMulti: boolean) {
  const [scope, setScopeState] = useState<string>("all");

  useEffect(() => {
    const stored = window.localStorage.getItem(SCOPE_KEY);
    if (stored) setScopeState(stored);
  }, []);

  function setScope(value: string) {
    setScopeState(value);
    window.localStorage.setItem(SCOPE_KEY, value);
  }

  const valid = scope === "all" || units.some((u) => u.id === scope);
  const effective = isMulti ? (valid ? scope : "all") : "all";

  return { scope: effective, setScope, crossUnit: isMulti && effective === "all" };
}
