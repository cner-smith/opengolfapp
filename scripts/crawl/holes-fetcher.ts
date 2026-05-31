// OSM Overpass — per-state HOLE GEOMETRY.
//
// The course-discovery crawl (osm-fetcher.ts) is centroid-only and the
// OpenGolfAPI enrich pass gives par/handicap but no coordinates — so courses
// land with at most flat par rows and no hole shapes. OSM actually carries
// golf=hole / golf=tee / golf=green features for mapped courses; this pass
// fetches them, assigns each hole to its nearest course, and writes real
// per-hole tee/green coordinates (+ par) into the holes table.
//
// Assignment is nearest-course-centroid within a radius — robust for isolated
// courses, imperfect for adjacent multi-course facilities (see #267). Runs are
// idempotent: courses that already have hole geometry are skipped, so it never
// clobbers hand-curated data and is safe to re-run / resume.
import { OSM_DELAY_MS, OVERPASS_ENDPOINTS, STATE_BBOX, asInt, haversineMeters, sleep } from './util'
import {
  fetchCoursesWithHoleGeometry,
  fetchOsmCoursesGeoForState,
  getCrawlState,
  setCrawlState,
  upsertHoleGeometry,
} from './db-writer'
import type { CourseGeo, OgaHoleGeo, OverpassGeomElement, OverpassGeomResponse } from './types'

interface Pt {
  lat: number
  lng: number
}
interface HoleWay {
  ref: number
  par: number | null
  first: Pt
  last: Pt
  centroid: Pt
}
interface HoleFeatures {
  holeWays: HoleWay[]
  greens: Pt[]
  tees: Pt[]
}

const HOLE_TO_COURSE_MAX_M = 1500 // a hole must be within this of a course centroid to attach
const SNAP_M = 45 // snap a hole endpoint to an explicit golf=tee/green feature within this

function geomCentroid(geom: { lat: number; lon: number }[]): Pt {
  let lat = 0
  let lng = 0
  for (const n of geom) {
    lat += n.lat
    lng += n.lon
  }
  return { lat: lat / geom.length, lng: lng / geom.length }
}

function nearest(pt: Pt, arr: Pt[]): { d: number; pt: Pt | null } {
  let best = Infinity
  let bestPt: Pt | null = null
  for (const c of arr) {
    const d = haversineMeters(pt.lat, pt.lng, c.lat, c.lng)
    if (d < best) {
      best = d
      bestPt = c
    }
  }
  return { d: best, pt: bestPt }
}

function parseHoleFeatures(elements: OverpassGeomElement[]): HoleFeatures {
  const holeWays: HoleWay[] = []
  const greens: Pt[] = []
  const tees: Pt[] = []
  for (const el of elements) {
    const tags = el.tags ?? {}
    const golf = tags['golf']
    if (golf === 'hole' && el.geometry && el.geometry.length >= 2) {
      const ref = asInt(tags['ref'])
      // holes.number CHECK is 1..18; skip unnumbered holes and the 19-27 refs
      // some 27-hole facilities use (we can't map those to a single 18 here).
      if (ref == null || ref < 1 || ref > 18) continue
      const g = el.geometry
      holeWays.push({
        ref,
        par: asInt(tags['par']) ?? null,
        first: { lat: g[0].lat, lng: g[0].lon },
        last: { lat: g[g.length - 1].lat, lng: g[g.length - 1].lon },
        centroid: geomCentroid(g),
      })
    } else if (golf === 'green' && el.geometry && el.geometry.length > 0) {
      greens.push(geomCentroid(el.geometry))
    } else if (golf === 'tee') {
      if (el.geometry && el.geometry.length > 0) tees.push(geomCentroid(el.geometry))
      else if (el.lat != null && el.lon != null) tees.push({ lat: el.lat, lng: el.lon })
    }
  }
  return { holeWays, greens, tees }
}

// One Overpass query per state for all golf hole/green/tee geometry, with the
// same endpoint-cycle + backoff sweep the course crawl uses.
async function fetchHoleFeaturesInState(state: string): Promise<HoleFeatures> {
  const bbox = STATE_BBOX[state]
  if (!bbox) throw new Error(`OSM bbox not configured for state "${state}".`)
  const [s, w, n, e] = bbox
  const q = `
[out:json][timeout:180];
(
  way["golf"="hole"](${s},${w},${n},${e});
  way["golf"="green"](${s},${w},${n},${e});
  node["golf"="tee"](${s},${w},${n},${e});
  way["golf"="tee"](${s},${w},${n},${e});
);
out geom tags;
`.trim()

  const BACKOFFS_MS = [5_000, 15_000, 45_000]
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'oga-course-crawler/0.1 (https://github.com/cner-smith/opengolfapp)',
          },
          body: 'data=' + encodeURIComponent(q),
        })
        if (!res.ok) {
          lastErr = new Error(`${endpoint} ${res.status}`)
          continue
        }
        const data = (await res.json()) as OverpassGeomResponse
        return parseHoleFeatures(data.elements)
      } catch (err) {
        lastErr = err as Error
      }
      await sleep(500)
    }
    const backoff = BACKOFFS_MS[attempt]
    if (backoff == null) break
    console.warn(
      `[osm-holes:${state}] all Overpass endpoints failed (last: ${lastErr?.message ?? 'unknown'}) — retry in ${backoff / 1000}s`,
    )
    await sleep(backoff)
  }
  throw lastErr ?? new Error('Overpass hole query failed')
}

// Assign each hole way to its nearest course centroid (within radius), keeping
// the nearest hole per ref, then build numbered holes with oriented geometry.
function buildHolesForCourses(courses: CourseGeo[], f: HoleFeatures): Map<string, OgaHoleGeo[]> {
  // course id -> ref -> { hole way, distance to that course }
  const byCourse = new Map<string, Map<number, { hw: HoleWay; d: number }>>()
  for (const hw of f.holeWays) {
    let bestI = -1
    let bestD = Infinity
    for (let i = 0; i < courses.length; i++) {
      const d = haversineMeters(hw.centroid.lat, hw.centroid.lng, courses[i].lat, courses[i].lng)
      if (d < bestD) {
        bestD = d
        bestI = i
      }
    }
    if (bestI < 0 || bestD > HOLE_TO_COURSE_MAX_M) continue
    const courseId = courses[bestI].id
    let refs = byCourse.get(courseId)
    if (!refs) {
      refs = new Map()
      byCourse.set(courseId, refs)
    }
    const existing = refs.get(hw.ref)
    if (!existing || bestD < existing.d) refs.set(hw.ref, { hw, d: bestD })
  }

  const out = new Map<string, OgaHoleGeo[]>()
  for (const [courseId, refs] of byCourse) {
    const holes: OgaHoleGeo[] = []
    for (const { hw } of refs.values()) {
      // Orient: whichever endpoint is nearer a green is the green/pin end.
      const gFirst = nearest(hw.first, f.greens).d
      const gLast = nearest(hw.last, f.greens).d
      const greenEnd = gLast <= gFirst ? hw.last : hw.first
      const teeEnd = gLast <= gFirst ? hw.first : hw.last
      // Snap to an explicit tee/green feature when one sits right on the end.
      const ng = nearest(greenEnd, f.greens)
      const nt = nearest(teeEnd, f.tees)
      const pin = ng.pt && ng.d < SNAP_M ? ng.pt : greenEnd
      const tee = nt.pt && nt.d < SNAP_M ? nt.pt : teeEnd
      const yards = Math.round(haversineMeters(tee.lat, tee.lng, pin.lat, pin.lng) * 1.09361)
      // holes.par CHECK is 3..6 — clamp the occasional out-of-range OSM par
      // (pitch-and-putt 2s, mistagged 7s) rather than failing the whole batch.
      const par = Math.min(6, Math.max(3, hw.par ?? 4))
      holes.push({
        number: hw.ref,
        par,
        yards: yards > 0 ? yards : undefined,
        teeLat: +tee.lat.toFixed(6),
        teeLng: +tee.lng.toFixed(6),
        pinLat: +pin.lat.toFixed(6),
        pinLng: +pin.lng.toFixed(6),
      })
    }
    holes.sort((a, b) => a.number - b.number)
    if (holes.length > 0) out.set(courseId, holes)
  }
  return out
}

export async function crawlOsmHoles(
  states: string[],
  force: boolean,
  limit: number | null,
): Promise<void> {
  let totalCourses = 0
  let totalHoles = 0
  for (const state of states) {
    const crawlId = `osm-holes:state:${state}`
    const prev = await getCrawlState(crawlId)
    if (prev?.status === 'done' && !force) {
      console.log(`[osm-holes:${state}] skip — already done (${prev.items_processed} courses)`)
      continue
    }
    await setCrawlState(crawlId, { status: 'in_progress', errorMessage: null })
    try {
      const courses = await fetchOsmCoursesGeoForState(state)
      if (courses.length === 0) {
        console.log(`[osm-holes:${state}] no courses with coords — skip`)
        await setCrawlState(crawlId, { status: 'done', itemsProcessed: 0, errorMessage: null })
        await sleep(OSM_DELAY_MS)
        continue
      }
      console.log(
        `[osm-holes:${state}] ${courses.length} courses; querying Overpass for hole geometry…`,
      )
      const features = await fetchHoleFeaturesInState(state)
      console.log(
        `[osm-holes:${state}] OSM features: ${features.holeWays.length} holes, ${features.greens.length} greens, ${features.tees.length} tees`,
      )
      const map = buildHolesForCourses(courses, features)
      // Never clobber courses that already carry hole geometry.
      const skip = await fetchCoursesWithHoleGeometry([...map.keys()], `osm-holes:${state}`)
      let entries = [...map.entries()].filter(([id]) => !skip.has(id))
      if (limit != null) entries = entries.slice(0, limit)
      let stateCourses = 0
      let stateHoles = 0
      for (const [courseId, holes] of entries) {
        await upsertHoleGeometry(courseId, holes)
        stateCourses++
        stateHoles += holes.length
        if (stateCourses % 50 === 0) {
          console.log(`[osm-holes:${state}] ${stateCourses}/${entries.length} courses written`)
          await setCrawlState(crawlId, { itemsProcessed: stateCourses })
        }
      }
      await setCrawlState(crawlId, {
        status: 'done',
        itemsProcessed: stateCourses,
        errorMessage: null,
      })
      console.log(
        `[osm-holes:${state}] done — ${stateCourses} courses, ${stateHoles} holes written (${skip.size} skipped: already had geometry)`,
      )
      totalCourses += stateCourses
      totalHoles += stateHoles
    } catch (err) {
      console.error(`[osm-holes:${state}] fatal: ${(err as Error).message}`)
      await setCrawlState(crawlId, { status: 'error', errorMessage: (err as Error).message })
    }
    // Always pause between states — Overpass is shared, rate-limit-sensitive.
    await sleep(OSM_DELAY_MS)
  }
  console.log(`\nosm-holes complete: ${totalCourses} courses, ${totalHoles} holes written`)
}
