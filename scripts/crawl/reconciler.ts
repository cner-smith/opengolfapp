// Reconciliation pass — resolve the duplicates the completion pass leaves behind.
//
// Job 1 (exact-name dedup): the same course crawled twice — once as an OSM
// polygon (carries hole geometry), once as a non-OSM listing (OpenGolfAPI
// ghost, no geometry). They share an exact name + city but the ghost sits far
// enough from the polygon that geometric containment missed it. We fold the
// ghost into the OSM row, moving its rounds/tees across, exactly like the
// completion pass's own dedup — only matched by name instead of containment.
//
// Fallback-named rows ("Golf Course (City)") are NEVER grouped: several distinct
// unnamed courses can share a city, so name+city is not identity for them.
//
// Ambiguous groups (no single OSM survivor, or two real OSM courses same name)
// are flagged, never auto-merged. Dry by default; --apply performs the merge.
import {
  courseHasUserData,
  fetchCoursesForState,
  mergeAndDeletePhantom,
  type CourseFull,
} from './db-writer'
import { haversineMeters } from './util'

const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
const isOsm = (c: CourseFull) => (c.externalId ?? '').startsWith('osm_')
const isFallback = (name: string) => name.startsWith('Golf Course')

// A matched-name ghost this far from its OSM twin isn't the same course — it's a
// name+city collision (two "Springfield" cities) or a bad OpenGolfAPI coordinate.
// 96% of real pairs sit <1km apart; there's a clean gap at 5km. Beyond it we
// flag, never merge — an unmergeable dup is cheap, a wrongly-deleted course isn't.
const MAX_MERGE_METERS = 5000

export async function crawlReconcile(states: string[], apply: boolean): Promise<void> {
  let candidates = 0
  let merged = 0
  let skippedUser = 0
  let flaggedGroups = 0

  for (const state of states) {
    const courses = await fetchCoursesForState(state)
    const groups = new Map<string, CourseFull[]>()
    for (const c of courses) {
      if (isFallback(c.name)) continue
      const key = `${norm(c.name)}|${norm(c.city)}`
      const g = groups.get(key)
      if (g) g.push(c)
      else groups.set(key, [c])
    }

    for (const grp of groups.values()) {
      if (grp.length < 2) continue
      const osm = grp.filter(isOsm)
      const nonOsm = grp.filter((c) => !isOsm(c))
      // Need exactly one geometried survivor to fold the rest into.
      if (osm.length !== 1 || nonOsm.length === 0) {
        flaggedGroups++
        console.log(
          `[reconcile:${state}] FLAG ambiguous "${grp[0].name}" — ${osm.length} osm / ${nonOsm.length} non-osm (manual)`,
        )
        continue
      }
      const survivor = osm[0]
      for (const phantom of nonOsm) {
        // Distance guard: same name+city but far away = collision or bad coord.
        const dist = haversineMeters(phantom.lat, phantom.lng, survivor.lat, survivor.lng)
        if (dist >= MAX_MERGE_METERS) {
          flaggedGroups++
          console.log(
            `[reconcile:${state}] FLAG far "${phantom.name}" (${phantom.id}) — ${(dist / 1000).toFixed(0)}km from twin (manual)`,
          )
          continue
        }
        // Never fold a course a user has played — deleting its holes would
        // orphan scorecards and FK-abort the run (the WI/Deertrak crash).
        if (await courseHasUserData(phantom.id)) {
          skippedUser++
          console.log(`[reconcile:${state}] SKIP "${phantom.name}" (${phantom.id}) — has user data`)
          continue
        }
        candidates++
        console.log(
          `[reconcile:${state}] ${apply ? 'MERGE' : '[dry] would merge'} "${phantom.name}" (${phantom.id}) → osm ${survivor.externalId} (${survivor.id})`,
        )
        if (apply) {
          await mergeAndDeletePhantom(phantom.id, survivor.id)
          merged++
        }
      }
    }
  }

  console.log(
    `\nreconcile exact-dup${apply ? '' : ' (DRY-RUN)'}: ` +
      `${apply ? `${merged} merged` : `${candidates} merge candidates`}, ` +
      `${skippedUser} skipped (user data), ${flaggedGroups} ambiguous groups flagged`,
  )
}
