// OSM Overpass — state-level course discovery (centroid only).
import {
  OSM_DELAY_MS,
  OVERPASS_ENDPOINTS,
  STATE_BBOX,
  sleep,
} from './util'
import type { OsmCourseLite, OverpassResponse } from './types'
import {
  getCrawlState,
  setCrawlState,
  upsertCourse,
} from './db-writer'

export async function fetchOsmCoursesInState(state: string): Promise<OsmCourseLite[]> {
  const bbox = STATE_BBOX[state]
  if (!bbox) {
    throw new Error(
      `OSM bbox not configured for state "${state}". Add an entry to STATE_BBOX in scripts/crawl/util.ts.`,
    )
  }
  const [s, w, n, e] = bbox
  const q = `
[out:json][timeout:90];
(
  way["leisure"="golf_course"](${s},${w},${n},${e});
  relation["leisure"="golf_course"](${s},${w},${n},${e});
);
out center tags;
`.trim()

  let lastErr: Error | null = null
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
      const data = (await res.json()) as OverpassResponse
      const out: OsmCourseLite[] = []
      for (const el of data.elements) {
        const tags = el.tags ?? {}
        const name = tags['name']
        if (!name) continue
        let lat: number | undefined
        let lng: number | undefined
        if (el.type === 'node') {
          lat = el.lat
          lng = el.lon
        } else if (el.center) {
          // ways and relations both come back with a `center` when the
          // query asks for `out center tags`.
          lat = el.center.lat
          lng = el.center.lon
        }
        if (lat == null || lng == null) continue
        const city = (tags['addr:city'] ?? '').trim() || undefined
        out.push({
          osmType: el.type,
          osmId: el.id,
          name,
          lat,
          lng,
          state,
          city,
        })
      }
      return out
    } catch (err) {
      lastErr = err as Error
    }
    await sleep(500)
  }
  throw lastErr ?? new Error('Overpass request failed')
}

export async function crawlOsm(
  states: string[],
  force: boolean,
  limit: number | null,
): Promise<void> {
  let totalImported = 0
  const totalSkipped = 0
  let totalErrors = 0
  for (const state of states) {
    const crawlId = `osm:state:${state}`
    const prev = await getCrawlState(crawlId)
    if (prev?.status === 'done' && !force) {
      console.log(
        `[osm:${state}] skip — already done (${prev.items_processed} courses)`,
      )
      continue
    }
    await setCrawlState(crawlId, { status: 'in_progress', errorMessage: null })

    let stateCount = 0
    let stateErrors = 0
    try {
      console.log(`[osm:${state}] querying Overpass…`)
      const courses = await fetchOsmCoursesInState(state)
      const targets = limit != null ? courses.slice(0, limit) : courses
      console.log(`[osm:${state}] ${targets.length} courses found`)

      for (let i = 0; i < targets.length; i++) {
        const c = targets[i]
        if (!c) continue
        const externalId = `osm_${c.osmType}_${c.osmId}`
        try {
          await upsertCourse({
            externalId,
            name: c.name,
            city: c.city ?? null,
            state: c.state,
            lat: c.lat,
            lng: c.lng,
          })
          totalImported++
          stateCount++
          if ((i + 1) % 100 === 0 || i === targets.length - 1) {
            console.log(`[osm:${state}] ${i + 1}/${targets.length} — last: ${c.name}`)
            await setCrawlState(crawlId, { itemsProcessed: stateCount })
          }
        } catch (err) {
          stateErrors++
          totalErrors++
          console.warn(
            `[osm:${state}] ${c.osmType}/${c.osmId} (${c.name}): ${(err as Error).message}`,
          )
        }
      }

      await setCrawlState(crawlId, {
        status: 'done',
        itemsProcessed: stateCount,
        errorMessage: null,
      })
      console.log(
        `[osm:${state}] done — ${stateCount} processed, ${stateErrors} errors`,
      )
    } catch (err) {
      console.error(`[osm:${state}] fatal: ${(err as Error).message}`)
      await setCrawlState(crawlId, {
        status: 'error',
        itemsProcessed: stateCount,
        errorMessage: (err as Error).message,
      })
    }
    // Always wait between states regardless of success — Overpass is shared
    // infrastructure and rate-limit-sensitive.
    await sleep(OSM_DELAY_MS)
  }
  console.log(
    `\nOSM crawl complete: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`,
  )
}
