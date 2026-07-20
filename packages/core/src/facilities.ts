// Shared facility-first search merge logic. Both web (useCourses.ts) and
// mobile (round/new.tsx) run the same local-course search and need to:
// split local rows into standalone courses (no facility_id) vs. facility
// units, then re-anchor those units to their facility so a search hit on
// a unit's own name (e.g. "Lake Hefner South") still surfaces the parent
// facility card ("Lake Hefner Golf Club") even when the name-search
// against `facilities` didn't match it directly. Kept generic + pure so
// it doesn't depend on either platform's Supabase client wiring — callers
// inject their own facility-by-ids fetcher.

/**
 * Splits local course rows into standalone courses (no facility) and the
 * deduped set of facilities their units belong to, re-anchored via the
 * provided fetcher so a unit that matched by its own name still surfaces
 * its facility card.
 */
export async function resolveFacilityResults<
  C extends { facility_id?: string | null },
  F extends { id: string },
>(
  localRows: C[],
  facilitiesByName: F[],
  fetchFacilitiesByIds: (ids: string[]) => Promise<F[]>,
): Promise<{ standalone: C[]; facilities: F[] }> {
  const standalone = localRows.filter((c) => !c.facility_id)
  const unitFacilityIds = [
    ...new Set(
      localRows.filter((c) => c.facility_id).map((c) => c.facility_id as string),
    ),
  ]
  const byUnit = unitFacilityIds.length
    ? await fetchFacilitiesByIds(unitFacilityIds)
    : []
  const seen = new Set<string>()
  const facilities = [...facilitiesByName, ...byUnit].filter((f) =>
    seen.has(f.id) ? false : (seen.add(f.id), true),
  )
  return { standalone, facilities }
}
