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
  type CourseFull,
} from './db-writer'
import type { OgaHoleGeo, OverpassGeomElement, OverpassGeomResponse } from './types'

const USER_AGENT = 'oga-course-crawler/0.1 (https://github.com/cner-smith/opengolfapp)'

interface CoursePolygon {
  osmType: 'way' | 'relation'
  osmId: number
  name?: string
  city?: string
  rings: Pt[][] // a way = one ring; a relation multipolygon = its outer ring(s)
  centroid: Pt
}

function polyCentroid(rings: Pt[][]): Pt {
  let lat = 0
  let lng = 0
  let n = 0
  for (const ring of rings)
    for (const p of ring) {
      lat += p.lat
      lng += p.lng
      n++
    }
  return { lat: lat / n, lng: lng / n }
}

function inAnyRing(pt: Pt, rings: Pt[][]): boolean {
  return rings.some((r) => pointInPolygon(pt, r))
}

// A real golf course spans hundreds of metres end to end; a single tee/green
// (sometimes mis-tagged leisure=golf_course in OSM, e.g. "#8 White Tee") is
// ~20-60m. Polygons whose bbox diagonal is below this are dropped as mistags.
const MIN_COURSE_DIAGONAL_M = 150
function bboxDiagonalM(rings: Pt[][]): number {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const r of rings)
    for (const p of r) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    }
  return haversineMeters(minLat, minLng, maxLat, maxLng)
}

function ptsClose(a: Pt, b: Pt): boolean {
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7
}

// Stitch relation outer member ways (often split into segments) into closed
// rings, greedily matching endpoints. Good enough for OSM golf-course
// multipolygons; unclosable/degenerate segments are dropped.
function assembleRings(segments: Pt[][]): Pt[][] {
  const segs = segments.filter((s) => s.length >= 2).map((s) => [...s])
  const used = new Array(segs.length).fill(false)
  const rings: Pt[][] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = true
    const ring = [...segs[i]]
    let extended = true
    while (extended && !ptsClose(ring[0], ring[ring.length - 1])) {
      extended = false
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue
        const s = segs[j]
        const last = ring[ring.length - 1]
        if (ptsClose(s[0], last)) {
          ring.push(...s.slice(1))
          used[j] = true
          extended = true
          break
        }
        if (ptsClose(s[s.length - 1], last)) {
          ring.push(...s.slice(0, -1).reverse())
          used[j] = true
          extended = true
          break
        }
      }
    }
    if (ring.length >= 3) rings.push(ring)
  }
  return rings
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

// Jaccard overlap of two token sets ≥ 0.5. Empty sets never match. Used for
// DEDUP (fuzzy: "Tulsa CC" ≈ "Tulsa Country Club").
function jaccard(ta: Set<string>, tb: Set<string>): boolean {
  if (ta.size === 0 || tb.size === 0) return false
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter) >= 0.5
}

// Exact token-set equality. Used for GROUPING fragments of one course, which
// share an identical name (Centennial Valley ×7). Fuzzy match would wrongly
// cluster different courses at a resort ("Desert Mountain Outlaw" vs "Cochise").
function sameTokenSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false
  for (const t of a) if (!b.has(t)) return false
  return true
}

// Only a confident name match auto-merges a duplicate; anything else is flagged
// for human review. A bare "Golf Course" fallback tokenizes to empty → never
// matches → always flagged.
function namesMatch(a: string, b: string): boolean {
  return jaccard(nameTokens(a), nameTokens(b))
}

// A hole belongs to a polygon if its centroid OR either endpoint (tee/green) is
// inside. Testing the centroid alone drops dogleg holes whose average point
// falls off the corridor of a concave boundary (e.g. Ken McDonald #16) — the
// endpoints sit on the course, so this recovers them.
function holeInPolygon(hw: HoleWay, rings: Pt[][]): boolean {
  return inAnyRing(hw.centroid, rings) || inAnyRing(hw.first, rings) || inAnyRing(hw.last, rings)
}

// OSM sometimes maps one course as several adjacent same-named golf_course ways
// (e.g. Centennial Valley = 7 consecutive ways, 18 holes scattered across them).
// Union-find groups such polygons by close name match + proximity so they become
// ONE course. Nameless polygons tokenize to empty → never cluster, so distinct
// courses are never wrongly folded. Returns the group root index per polygon.
const GROUP_RADIUS_M = 3000
function groupPolygons(polygons: CoursePolygon[]): number[] {
  const tokens = polygons.map((p) => (p.name ? nameTokens(p.name) : new Set<string>()))
  const parent = polygons.map((_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  // ponytail: O(n²) over a state's polygons (~1.5k worst case = a few seconds in
  // a multi-hour run). Bucket by first token if it ever matters.
  for (let i = 0; i < polygons.length; i++) {
    if (tokens[i].size === 0) continue
    for (let j = i + 1; j < polygons.length; j++) {
      if (!sameTokenSet(tokens[i], tokens[j])) continue
      const d = haversineMeters(
        polygons[i].centroid.lat,
        polygons[i].centroid.lng,
        polygons[j].centroid.lat,
        polygons[j].centroid.lng,
      )
      if (d <= GROUP_RADIUS_M) parent[find(i)] = find(j)
    }
  }
  return polygons.map((_, i) => find(i))
}

// Parse golf_course polygons: a way = one ring; a relation multipolygon =
// its outer ring(s), stitched from member ways. Mis-tagged single features
// (tiny bbox) and relations with no usable outer geometry are counted + dropped.
function parsePolygons(elements: OverpassGeomElement[]): {
  polygons: CoursePolygon[]
  relationsSkipped: number
  junkSkipped: number
} {
  const polygons: CoursePolygon[] = []
  let relationsSkipped = 0
  let junkSkipped = 0
  for (const el of elements) {
    const tags = el.tags ?? {}
    if (tags['leisure'] !== 'golf_course') continue
    let rings: Pt[][] = []
    if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
      rings = [el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))]
    } else if (el.type === 'relation') {
      // Multipolygon: stitch the outer member ways into the boundary ring(s).
      const outers = (el.members ?? [])
        .filter(
          (m) => m.type === 'way' && m.role === 'outer' && m.geometry && m.geometry.length >= 2,
        )
        .map((m) => m.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })))
      rings = assembleRings(outers)
    }
    if (rings.length === 0) {
      if (el.type === 'relation') relationsSkipped++
      continue
    }
    // Drop mis-tagged single features (a tee/green tagged golf_course).
    if (bboxDiagonalM(rings) < MIN_COURSE_DIAGONAL_M) {
      junkSkipped++
      continue
    }
    polygons.push({
      osmType: el.type === 'relation' ? 'relation' : 'way',
      osmId: el.id,
      name: tags['name'],
      city: (tags['addr:city'] ?? '').trim() || undefined,
      rings,
      centroid: polyCentroid(rings),
    })
  }
  return { polygons, relationsSkipped, junkSkipped }
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
out geom;`.trim()

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
  const oddCount: string[] = []
  for (const state of states) {
    console.log(`[complete:${state}] querying Overpass (polygons + holes)…`)
    const elements = await fetchStateGeom(state)
    const { polygons, relationsSkipped, junkSkipped } = parsePolygons(elements)
    const features = parseHoleFeatures(elements)
    const existing = await fetchCoursesForState(state)
    const byExt = new Map(
      existing.filter((c) => c.externalId).map((c) => [c.externalId as string, c]),
    )
    const withGeom = await fetchCoursesWithHoleGeometry(
      existing.map((c) => c.id),
      `complete:${state}`,
    )
    const skips: string[] = []
    if (relationsSkipped) skips.push(`${relationsSkipped} relations unparseable`)
    if (junkSkipped) skips.push(`${junkSkipped} mistags dropped`)
    console.log(
      `[complete:${state}] ${polygons.length} polygons, ${features.holeWays.length} holes, ` +
        `${existing.length} existing courses${skips.length ? ` (${skips.join(', ')})` : ''}`,
    )

    // Assign each hole to the polygon that contains it (centroid or endpoint,
    // via holeInPolygon), nearest-centroid tiebreak when it sits inside more than
    // one. Holes with ref outside 1..18 were already dropped by parseHoleFeatures.
    const holesByPoly = new Map<number, HoleWay[]>()
    for (const hw of features.holeWays) {
      let bestIdx = -1
      let bestD = Infinity
      for (let i = 0; i < polygons.length; i++) {
        if (!holeInPolygon(hw, polygons[i].rings)) continue
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

    // Group polygons that are one course mapped as several same-named ways, so
    // each group becomes a single course row with all its holes.
    const groupRoot = groupPolygons(polygons)
    const groups = new Map<number, number[]>()
    for (let i = 0; i < polygons.length; i++) {
      const arr = groups.get(groupRoot[i]) ?? []
      arr.push(i)
      groups.set(groupRoot[i], arr)
    }

    // Split a same-name group apart if its polygons have OVERLAPPING hole refs —
    // that's a multi-loop facility (e.g. three nines all numbered 1-9), not one
    // fragmented course. True fragments have disjoint refs (Centennial Valley =
    // 1-18 spread across ways) and stay consolidated so no holes are lost.
    // Split only on SUBSTANTIAL ref overlap: a real second loop duplicates a
    // whole nine (~9 refs), whereas a fragmented course with a stray OSM
    // duplicate ref overlaps by 1-2 and should stay consolidated (dedup drops
    // the stray). overlap = holes that would be lost to dedup if we merged.
    const MULTILOOP_OVERLAP = 4
    const units: number[][] = []
    for (const idxs of groups.values()) {
      if (idxs.length > 1) {
        const refs = new Set<number>()
        let total = 0
        for (const i of idxs)
          for (const hw of holesByPoly.get(i) ?? []) {
            total++
            refs.add(hw.ref)
          }
        if (total - refs.size >= MULTILOOP_OVERLAP) {
          for (const i of idxs) units.push([i])
          flagged.push(
            `${state}: multi-loop "${polygons[idxs[0]].name ?? '?'}" kept as ${idxs.length} separate courses`,
          )
          continue
        }
      }
      units.push(idxs)
    }
    const unitList = limit != null ? units.slice(0, limit) : units
    for (const idxs of unitList) {
      // Canonical polygon = the one with the most holes (tiebreak: lowest osmId),
      // so identity is stable across runs.
      let canon = idxs[0]
      for (const i of idxs) {
        const ni = holesByPoly.get(i)?.length ?? 0
        const nc = holesByPoly.get(canon)?.length ?? 0
        if (ni > nc || (ni === nc && polygons[i].osmId < polygons[canon].osmId)) canon = i
      }
      const poly = polygons[canon]
      const extId = `osm_${poly.osmType}_${poly.osmId}`
      const existingCourse = byExt.get(extId)

      // Union holes from every polygon in the group (dedup by ref).
      const seen = new Set<number>()
      const holes: OgaHoleGeo[] = []
      for (const i of idxs) {
        for (const hw of holesByPoly.get(i) ?? []) {
          if (seen.has(hw.ref)) continue
          seen.add(hw.ref)
          holes.push(buildOrientedHole(hw, features))
        }
      }
      holes.sort((a, b) => a.number - b.number)

      // City: OSM addr tag or an existing value only — no reverse-geocoding here.
      // Nominatim's 1-req/sec limit makes inline geocoding a bottleneck at scale;
      // the dedicated `--source geocode` pass fills any remaining cities (and
      // rewrites bare "Golf Course" fallbacks to "Golf Course (City)") afterward.
      const city = poly.city ?? existingCourse?.city ?? undefined

      // Sibling OSM rows (the group's other polygons) fold into the canonical.
      const siblings = idxs
        .filter((i) => i !== canon)
        .map((i) => byExt.get(`osm_${polygons[i].osmType}_${polygons[i].osmId}`))
        .filter((c): c is CourseFull => !!c)

      // Non-OSM courses whose centroid sits inside any polygon of the group.
      const inside = existing.filter(
        (c) =>
          !(c.externalId ?? '').startsWith('osm_') &&
          idxs.some((i) => inAnyRing({ lat: c.lat, lng: c.lng }, polygons[i].rings)),
      )

      // Name: OSM name → an existing real (non-fallback) name → adopt the name
      // of a single named course sitting inside a NAMELESS polygon (usually the
      // real course; flagged so a wrong adoption can be caught) → fallback.
      const existingReal =
        existingCourse && !existingCourse.name.startsWith('Golf Course')
          ? existingCourse.name
          : undefined
      let derived = poly.name ?? existingReal
      let adopted: string | undefined
      if (!derived) {
        const named = inside.filter((c) => !c.name.startsWith('Golf Course'))
        if (named.length === 1) {
          derived = named[0].name
          adopted = named[0].name
        }
      }
      const name = derived ?? `Golf Course${city ? ` (${city})` : ''}`

      // Auto-merge a duplicate on a confident name match; flag the rest (never
      // auto-delete a mismatch — a coord-error course can land inside an
      // unrelated polygon).
      const toMerge = inside.filter((c) => namesMatch(c.name, name))
      const toFlag = inside.filter((c) => !namesMatch(c.name, name))
      for (const c of toFlag) flagged.push(`${state}: "${name}" (${extId}) ⊃ "${c.name}"`)
      if (adopted)
        flagged.push(`${state}: adopted name "${adopted}" for nameless ${extId} — verify`)

      // Real courses are 9 / 18 (/27/36, but we cap at 18). Anything 1-17 except
      // 9 means dropped or still-fragmented holes — surface it loudly.
      const suspicious = holes.length > 0 && holes.length !== 9 && holes.length < 18
      if (suspicious) oddCount.push(`${state}: "${name}" — ${holes.length} holes (${extId})`)
      const foldCount = siblings.length + toMerge.length

      const hasGeom = existingCourse ? withGeom.has(existingCourse.id) : false
      const willWriteHoles = holes.length > 0 && (force || !hasGeom)

      const changes: string[] = []
      if (willWriteHoles || (dryRun && holes.length > 0)) {
        changes.push(
          `${holes.length} holes${!willWriteHoles && !dryRun ? ' (skip: has geom)' : ''}`,
        )
      }
      if (idxs.length > 1) changes.push(`consolidated ${idxs.length} polygons`)
      if (toMerge.length) changes.push(`merged ${toMerge.map((p) => p.name).join(' + ')}`)
      if (toFlag.length) changes.push(`FLAG ${toFlag.length}`)
      if (suspicious) changes.push('⚠ odd hole count')

      if (dryRun) {
        console.log(`[dry] ${extId} "${name}"${city ? ` — ${city}` : ''}: ${changes.join('; ')}`)
        totalCourses++
        if (willWriteHoles) totalHoles += holes.length
        totalMerged += foldCount
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
      for (const c of [...siblings, ...toMerge]) {
        await mergeAndDeletePhantom(c.id, courseId)
        totalMerged++
      }
      // Live progress: one line per course that actually changed.
      if (changes.length) console.log(`[complete:${state}] ✓ ${name} — ${changes.join('; ')}`)
    }
    await sleep(OSM_DELAY_MS)
  }
  console.log(
    `\ncomplete${dryRun ? ' (DRY-RUN)' : ''}: ${totalCourses} courses, ${totalHoles} holes, ${totalMerged} folded, ${flagged.length} flagged, ${oddCount.length} odd hole counts`,
  )
  if (oddCount.length) {
    console.log('\n⚠ ODD HOLE COUNTS (not 9 or 18 — dropped holes or OSM gaps, review):')
    for (const o of oddCount) console.log('  - ' + o)
  }
  if (flagged.length) {
    console.log('\nFLAGGED duplicates (name mismatch — NOT auto-merged, review):')
    for (const f of flagged) console.log('  - ' + f)
  }
}
