// One-off repair for #905: holes the osm-holes crawler stored backwards (tee
// on the green, pin at the tee). Re-fetches each region's OSM hole ways, builds
// them with the fixed orientation, and swaps a stored hole's tee/pin only when
// they are the rebuilt hole's ends in REVERSE (both ends within MATCH_M).
// Anything else (OSM edited since, a different way assigned, hand-curated
// data) is left alone and counted.
//
// Dry run by default. Every change is written to a JSON log first — the old
// tee/pin per hole id — which is the rollback.
//
//   DOTENV_CONFIG_PATH=apps/web/.env.test.local tsx scripts/repair-hole-orientation.ts [--states PA,ME] [--apply]
//   … --apply-log <dry-run log>   apply a reviewed dry run without re-fetching OSM
//
// Root .env points at PROD. The target host is printed before anything runs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { supabase } from './crawl/client'
import { buildHolesForCourses, fetchHoleFeaturesInState } from './crawl/holes-fetcher'
import { fetchCourseGeoForState } from './crawl/db-writer'
import { OSM_DELAY_MS, STATE_BBOX, haversineMeters, sleep } from './crawl/util'

// The old code snapped each end to a different feature than the new one does
// (a flipped hole's stored tee is the raw way end, the rebuilt pin a green
// centroid up to SNAP_M away). Tee→pin is 100+ yd, so 50 m can't confuse ends.
const MATCH_M = 50

interface StoredHole {
  id: string
  course_id: string
  number: number
  tee_lat: number
  tee_lng: number
  pin_lat: number
  pin_lng: number
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const statesArg = args[args.indexOf('--states') + 1]
const states = args.includes('--states') ? statesArg.split(',') : Object.keys(STATE_BBOX)
const host = new URL(process.env.SUPABASE_URL ?? '').host
console.log(`target ${host} · ${states.length} region(s) · ${apply ? 'APPLY' : 'dry run'}`)

async function storedHoles(courseIds: string[]): Promise<StoredHole[]> {
  const out: StoredHole[] = []
  // 50 courses ≤ 900 rows, under PostgREST's silent 1000-row cap.
  for (let i = 0; i < courseIds.length; i += 50) {
    const { data, error } = await supabase
      .from('holes')
      .select('id, course_id, number, tee_lat, tee_lng, pin_lat, pin_lng')
      .in('course_id', courseIds.slice(i, i + 50))
      .not('tee_lat', 'is', null)
      .not('pin_lat', 'is', null)
      .range(0, 999)
    if (error) throw new Error(`holes fetch failed: ${error.message}`)
    out.push(...((data ?? []) as StoredHole[]))
  }
  return out
}

const near = (aLat: number, aLng: number, bLat: number, bLng: number) =>
  haversineMeters(aLat, aLng, bLat, bLng) <= MATCH_M

async function swap(flips: StoredHole[]) {
  let done = 0
  for (const h of flips) {
    const { data, error } = await supabase
      .from('holes')
      .update({ tee_lat: h.pin_lat, tee_lng: h.pin_lng, pin_lat: h.tee_lat, pin_lng: h.tee_lng })
      .eq('id', h.id)
      // Only if still exactly as logged — never swap a hole twice.
      .eq('tee_lat', h.tee_lat)
      .eq('pin_lat', h.pin_lat)
      .select('id')
    if (error) console.error(`hole ${h.id}: ${error.message}`)
    else if (data?.length === 1) done++
    else console.error(`hole ${h.id}: changed since the dry run — skipped`)
  }
  console.log(`swapped ${done}/${flips.length}`)
}

// --apply-log <file>: apply a reviewed dry run's flips without re-fetching OSM.
async function applyLog(file: string) {
  const logged = JSON.parse(readFileSync(file, 'utf8')) as { host: string; flips: StoredHole[] }
  if (logged.host !== host) throw new Error(`log is for ${logged.host}, target is ${host}`)
  console.log(`applying ${logged.flips.length} flips from ${file}`)
  await swap(logged.flips)
}

async function main() {
  if (args.includes('--apply-log')) return applyLog(args[args.indexOf('--apply-log') + 1])
  const flips: (StoredHole & { region: string })[] = []
  const tally = {
    checked: 0,
    match: 0,
    reversed: 0,
    other: 0,
    noOsm: 0,
    failedRegions: [] as string[],
  }

  for (const region of states) {
    try {
      const courses = await fetchCourseGeoForState(region)
      if (courses.length === 0) continue
      const built = buildHolesForCourses(courses, await fetchHoleFeaturesInState(region))
      const stored = await storedHoles(courses.map((c) => c.id))
      let regionFlips = 0
      for (const h of stored) {
        tally.checked++
        const osm = built.get(h.course_id)?.find((b) => b.number === h.number)
        if (!osm || osm.teeLat == null || osm.pinLat == null) {
          tally.noOsm++
          continue
        }
        if (
          near(h.tee_lat, h.tee_lng, osm.teeLat, osm.teeLng!) &&
          near(h.pin_lat, h.pin_lng, osm.pinLat, osm.pinLng!)
        ) {
          tally.match++
        } else if (
          near(h.tee_lat, h.tee_lng, osm.pinLat, osm.pinLng!) &&
          near(h.pin_lat, h.pin_lng, osm.teeLat, osm.teeLng!)
        ) {
          tally.reversed++
          regionFlips++
          flips.push({ ...h, region })
        } else {
          tally.other++
        }
      }
      console.log(`[${region}] ${stored.length} holes checked, ${regionFlips} reversed`)
    } catch (err) {
      console.error(`[${region}] failed: ${(err as Error).message}`)
      tally.failedRegions.push(region)
    }
    await sleep(OSM_DELAY_MS)
  }

  mkdirSync('docs/internal/data-repair', { recursive: true })
  const log = `docs/internal/data-repair/hole-orientation-${host.split('.')[0]}-${Date.now()}.json`
  writeFileSync(log, JSON.stringify({ host, apply, tally, flips }, null, 1))
  console.log(`\n${JSON.stringify(tally)}\nlog: ${log}`)

  if (apply) await swap(flips)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
