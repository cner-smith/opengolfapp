// Course completion pass — a per-polygon "derive what's missing" checklist.
//
// For each OSM golf_course polygon in a state: ensure a course row exists,
// derive its name/city when absent, assign the holes that fall INSIDE the
// polygon (exact containment, not nearest-centroid — which bleeds holes between
// adjacent courses), and fold any phantom course whose centroid sits inside the
// same polygon (e.g. an OpenGolfAPI ghost) into the real one.
//
// --dry-run reports every change without writing. Idempotent: hole geometry is
// (re)written only when a course lacks it or --force is set.
import {
  OSM_DELAY_MS,
  OVERPASS_ENDPOINTS,
  STATE_BBOX,
  haversineMeters,
  pointInPolygon,
  sleep,
} from './util'
import { buildOrientedHole, parseHoleFeatures, type HoleWay, type Pt } from './holes-fetcher'
import {
  fetchCoursesForState,
  fetchCoursesWithHoleGeometry,
  mergeAndDeletePhantom,
  upsertCourse,
  upsertHoleGeometry,
} from './db-writer'
import type { OgaHoleGeo, OverpassGeomElement, OverpassGeomResponse } from './types'

const USER_AGENT = 'oga-course-crawler/0.1 (https://github.com/cner-smith/opengolfapp)'

interface CoursePolygon {
  osmId: number
  name?: string
  city?: string
  ring: Pt[]
  centroid: Pt
}

function ringCentroid(ring: Pt[]): Pt {
  let lat = 0
  let lng = 0
  for (const p of ring) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

// Reduce a course name to its distinguishing tokens (drop generic golf words +
// punctuation) so "Tulsa C.C." and "Tulsa Country Club" compare equal.
const NAME_STOPWORDS = new Set([
  'golf',
  'course',
  'club',
  'country',
  'the',
  'at',
  'and',
  'of',
  'cc',
])
function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t && !NAME_STOPWORDS.has(t)),
  )
}

// Jaccard overlap of distinguishing tokens ≥ 0.5. Only a confident match
// auto-merges a duplicate; anything else is flagged for human review. Empty
// token sets (e.g. a bare "Golf Course" fallback) never match → always flagged.
function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  if (ta.size === 0 || tb.size === 0) return false
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter) >= 0.5
}

// Way polygons only. Relation (multipolygon) golf courses carry member
// geometry, not a single ring — v1 counts + skips them (they still get holes
// via the nearest-centroid osm-holes pass); handle if they prove common.
function parsePolygons(elements: OverpassGeomElement[]): {
  polygons: CoursePolygon[]
  relationsSkipped: number
} {
  const polygons: CoursePolygon[] = []
  let relationsSkipped = 0
  for (const el of elements) {
    const tags = el.tags ?? {}
    if (tags['leisure'] !== 'golf_course') continue
    if (el.type === 'relation') {
      relationsSkipped++
      continue
    }
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue
    const ring = el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))
    polygons.push({
      osmId: el.id,
      name: tags['name'],
      city: (tags['addr:city'] ?? '').trim() || undefined,
      ring,
      centroid: ringCentroid(ring),
    })
  }
  return { polygons, relationsSkipped }
}

// One Overpass query per state for course polygons + hole/green/tee geometry,
// with the same endpoint-cycle + backoff sweep the other OSM passes use.
// ponytail: 3rd copy of this endpoint loop (osm-fetcher, holes-fetcher, here) —
// extract a shared overpassPost(query) into util if a 4th caller appears.
async function fetchStateGeom(state: string): Promise<OverpassGeomElement[]> {
  const bbox = STATE_BBOX[state]
  if (!bbox) throw new Error(`OSM bbox not configured for state "${state}".`)
  const [s, w, n, e] = bbox
  const q = `
[out:json][timeout:180];
(
  way["leisure"="golf_course"](${s},${w},${n},${e});
  relation["leisure"="golf_course"](${s},${w},${n},${e});
  way["golf"="hole"](${s},${w},${n},${e});
  way["golf"="green"](${s},${w},${n},${e});
  node["golf"="tee"](${s},${w},${n},${e});
  way["golf"="tee"](${s},${w},${n},${e});
);
out geom tags;`.trim()

  const BACKOFFS_MS = [5_000, 15_000, 45_000]
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: 'data=' + encodeURIComponent(q),
        })
        if (!res.ok) {
          lastErr = new Error(`${endpoint} ${res.status}`)
          continue
        }
        const data = (await res.json()) as OverpassGeomResponse
        return data.elements
      } catch (err) {
        lastErr = err as Error
      }
      await sleep(500)
    }
    const backoff = BACKOFFS_MS[attempt]
    if (backoff == null) break
    console.warn(
      `[complete:${state}] Overpass failed (last: ${lastErr?.message ?? 'unknown'}) — retry in ${backoff / 1000}s`,
    )
    await sleep(backoff)
  }
  throw lastErr ?? new Error('Overpass query failed')
}

export async function crawlComplete(
  states: string[],
  force: boolean,
  limit: number | null,
  dryRun: boolean,
): Promise<void> {
  let totalCourses = 0
  let totalHoles = 0
  let totalMerged = 0
  const flagged: string[] = []
  for (const state of states) {
    console.log(`[complete:${state}] querying Overpass (polygons + holes)…`)
    const elements = await fetchStateGeom(state)
    const { polygons, relationsSkipped } = parsePolygons(elements)
    const features = parseHoleFeatures(elements)
    const existing = await fetchCoursesForState(state)
    const byExt = new Map(
      existing.filter((c) => c.externalId).map((c) => [c.externalId as string, c]),
    )
    const withGeom = await fetchCoursesWithHoleGeometry(
      existing.map((c) => c.id),
      `complete:${state}`,
    )
    console.log(
      `[complete:${state}] ${polygons.length} way polygons, ${features.holeWays.length} holes, ${existing.length} existing courses` +
        (relationsSkipped ? ` (${relationsSkipped} relation courses skipped)` : ''),
    )

    // Assign each hole to EXACTLY ONE polygon — the containing polygon whose
    // centroid is nearest — so a multi-course club (each course its own polygon)
    // splits cleanly and overlapping rings never double-count a hole. Holes with
    // ref outside 1..18 were already dropped by parseHoleFeatures (a 27-hole
    // course mapped as one polygon keeps 1..18; our model is one 18-hole course
    // per row).
    const holesByPoly = new Map<number, HoleWay[]>()
    for (const hw of features.holeWays) {
      let bestIdx = -1
      let bestD = Infinity
      for (let i = 0; i < polygons.length; i++) {
        if (!pointInPolygon(hw.centroid, polygons[i].ring)) continue
        const d = haversineMeters(
          hw.centroid.lat,
          hw.centroid.lng,
          polygons[i].centroid.lat,
          polygons[i].centroid.lng,
        )
        if (d < bestD) {
          bestD = d
          bestIdx = i
        }
      }
      if (bestIdx < 0) continue
      const arr = holesByPoly.get(bestIdx) ?? []
      arr.push(hw)
      holesByPoly.set(bestIdx, arr)
    }

    const targets = limit != null ? polygons.slice(0, limit) : polygons
    for (let pi = 0; pi < targets.length; pi++) {
      const poly = targets[pi]
      const extId = `osm_way_${poly.osmId}`
      const existingCourse = byExt.get(extId)

      // This polygon's holes (deduped by ref, keeping the first).
      const seen = new Set<number>()
      const holes: OgaHoleGeo[] = []
      for (const hw of holesByPoly.get(pi) ?? []) {
        if (seen.has(hw.ref)) continue
        seen.add(hw.ref)
        holes.push(buildOrientedHole(hw, features))
      }
      holes.sort((a, b) => a.number - b.number)

      // City: OSM addr tag or an existing value only — no reverse-geocoding here.
      // Nominatim's 1-req/sec limit makes inline geocoding a bottleneck at scale;
      // the dedicated `--source geocode` pass fills any remaining cities (and
      // rewrites bare "Golf Course" fallbacks to "Golf Course (City)") afterward.
      const city = poly.city ?? existingCourse?.city ?? undefined
      // Name: OSM name wins; else keep an existing real (non-fallback) name; else fallback.
      const existingReal =
        existingCourse && !existingCourse.name.startsWith('Golf Course')
          ? existingCourse.name
          : undefined
      const name = poly.name ?? existingReal ?? `Golf Course${city ? ` (${city})` : ''}`

      // Duplicates: non-OSM course centroids inside this polygon. Auto-merge ONLY
      // a confident name match; flag the rest for review (a coord-error course
      // from elsewhere can land inside an unrelated polygon — never auto-delete it).
      const inside = existing.filter(
        (c) =>
          c.externalId !== extId &&
          !(c.externalId ?? '').startsWith('osm_') &&
          pointInPolygon({ lat: c.lat, lng: c.lng }, poly.ring),
      )
      const toMerge = inside.filter((c) => namesMatch(c.name, name))
      const toFlag = inside.filter((c) => !namesMatch(c.name, name))
      for (const c of toFlag) flagged.push(`${state}: "${name}" (${extId}) ⊃ "${c.name}"`)

      const hasGeom = existingCourse ? withGeom.has(existingCourse.id) : false
      const willWriteHoles = holes.length > 0 && (force || !hasGeom)

      if (dryRun) {
        const bits = [`${holes.length} holes${willWriteHoles ? '' : ' (skip: has geom)'}`]
        if (toMerge.length) bits.push(`auto-merge: ${toMerge.map((p) => p.name).join(', ')}`)
        if (toFlag.length) bits.push(`FLAG: ${toFlag.map((p) => p.name).join(', ')}`)
        console.log(`[dry] ${extId} "${name}"${city ? ` — ${city}` : ''}: ${bits.join('; ')}`)
        totalCourses++
        if (willWriteHoles) totalHoles += holes.length
        totalMerged += toMerge.length
        continue
      }

      const { id: courseId } = await upsertCourse({
        externalId: extId,
        name,
        city: city ?? null,
        state,
        lat: poly.centroid.lat,
        lng: poly.centroid.lng,
      })
      totalCourses++
      if (willWriteHoles) {
        await upsertHoleGeometry(courseId, holes)
        totalHoles += holes.length
      }
      for (const p of toMerge) {
        await mergeAndDeletePhantom(p.id, courseId)
        totalMerged++
      }
    }
    await sleep(OSM_DELAY_MS)
  }
  console.log(
    `\ncomplete${dryRun ? ' (DRY-RUN)' : ''}: ${totalCourses} courses, ${totalHoles} holes, ${totalMerged} auto-merged, ${flagged.length} flagged for review`,
  )
  if (flagged.length) {
    console.log('\nFLAGGED duplicates (name mismatch — reviewed, NOT auto-merged):')
    for (const f of flagged) console.log('  - ' + f)
  }
}
