/**
 * Course database crawler. Populates courses + holes + course_tees from
 * OpenGolfAPI (community-maintained golf course DB) and from OSM Overpass
 * (golf course centroids).
 *
 * Resumable, idempotent. Tracks per-state progress in the crawl_state
 * table. Default behavior skips courses whose external_id already exists;
 * --force re-imports and updates them.
 *
 * Env (read from .env at repo root):
 *   SUPABASE_URL                  local or production Supabase
 *   SUPABASE_SERVICE_ROLE_KEY     admin key (bypasses RLS)
 *
 * CLI:
 *   tsx scripts/crawl-courses.ts --source osm-first              # OSM + enrich
 *   tsx scripts/crawl-courses.ts --source osm-first --states OK
 *   tsx scripts/crawl-courses.ts --source osm                    # OSM only
 *   tsx scripts/crawl-courses.ts --source enrich --states OK     # enrich only
 *   tsx scripts/crawl-courses.ts --source opengolfapi            # legacy
 *   tsx scripts/crawl-courses.ts --status
 *
 * OSM-first is the recommended mode: Overpass returns every named
 * leisure=golf_course in a bbox (no 100-result cap), and the enrich
 * pass fills in tee ratings/slopes by fuzzy-matching each OSM course
 * against OpenGolfAPI's 100-per-state subset.
 *
 * OpenGolfAPI: ~1 req/sec (900/day soft cap). Hard 100-result cap on
 *   /courses/state/:state — used for enrichment only.
 * OSM Overpass: ~1 req per 2 sec, single state-bbox query per state.
 *
 * Implementation lives in `scripts/crawl/`:
 *   - types.ts      — shared types
 *   - util.ts       — constants + small helpers (sleep / asInt / asNumber)
 *   - client.ts     — env-validated Supabase service-role client
 *   - db-writer.ts  — every Supabase write + crawl_state R/W
 *   - osm-fetcher.ts — Overpass query + crawlOsm driver
 *   - enricher.ts   — OpenGolfAPI fetch/normalize + crawlEnrich + crawlOpenGolfApi
 */
import { ALL_STATES, STATE_BBOX } from './crawl/util'
import {
  countCourses,
  fetchAllCrawlState,
} from './crawl/db-writer'
import { crawlOsm } from './crawl/osm-fetcher'
import { crawlOsmHoles } from './crawl/holes-fetcher'
import {
  crawlEnrich,
  crawlOpenGolfApi,
} from './crawl/enricher'
import type { Args, Source } from './crawl/types'

function parseArgs(argv: string[]): Args {
  let source: Args['source'] = null
  let states: string[] | null = null
  let force = false
  let status = false
  let limit: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--source' && next) {
      const allowed = ['opengolfapi', 'osm', 'osm-first', 'enrich', 'osm-holes'] as const
      if (!allowed.includes(next as Source)) {
        throw new Error(
          `--source must be one of ${allowed.join(', ')} (got: ${next})`,
        )
      }
      source = next as Source
      i++
    } else if (a === '--states' && next) {
      states = next
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 2)
      i++
    } else if (a === '--force') {
      force = true
    } else if (a === '--status') {
      status = true
    } else if (a === '--limit' && next) {
      const n = parseInt(next, 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error('--limit must be > 0')
      limit = n
      i++
    }
  }
  return { source, states, force, status, limit }
}

async function showStatus(): Promise<void> {
  const rows = await fetchAllCrawlState()
  if (rows.length === 0) {
    console.log('No crawl state recorded yet.')
    return
  }
  let totalProcessed = 0
  for (const r of rows) {
    const last = r.last_crawled_at
      ? new Date(r.last_crawled_at).toISOString().slice(0, 19).replace('T', ' ')
      : '—'
    const err = r.error_message ? ` ! ${r.error_message}` : ''
    console.log(
      `${r.id.padEnd(28)}  ${r.status.padEnd(12)}  ${String(r.items_processed).padStart(6)}  ${last}${err}`,
    )
    totalProcessed += r.items_processed
  }
  const courseCount = await countCourses()
  console.log(
    `\nTotal recorded items processed: ${totalProcessed}. Courses table: ${courseCount} rows.`,
  )
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.status) {
    await showStatus()
    return
  }
  if (!args.source) {
    console.error(
      'Missing --source. Usage:\n' +
        '  tsx scripts/crawl-courses.ts --source osm-first [--states TX,OK] [--force] [--limit N]\n' +
        '  tsx scripts/crawl-courses.ts --source osm [--states TX,OK] [--force]\n' +
        '  tsx scripts/crawl-courses.ts --source osm-holes [--states TX,OK] [--force] [--limit N]\n' +
        '  tsx scripts/crawl-courses.ts --source enrich [--states TX,OK] [--force]\n' +
        '  tsx scripts/crawl-courses.ts --source opengolfapi [--states TX,OK] [--force]\n' +
        '  tsx scripts/crawl-courses.ts --status',
    )
    process.exit(1)
  }

  if (args.source === 'opengolfapi') {
    const states = args.states ?? [...ALL_STATES]
    console.log(
      `OpenGolfAPI crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`,
    )
    await crawlOpenGolfApi(states, args.force, args.limit)
    return
  }

  // The remaining sources all rely on the OSM bbox table.
  const configured = Object.keys(STATE_BBOX)
  const states = args.states ?? configured
  const unsupported = states.filter((s) => !STATE_BBOX[s])
  if (unsupported.length) {
    throw new Error(
      `OSM bbox not configured for: ${unsupported.join(', ')}. Add to STATE_BBOX.`,
    )
  }

  if (args.source === 'osm') {
    console.log(`OSM crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`)
    await crawlOsm(states, args.force, args.limit)
  } else if (args.source === 'osm-holes') {
    console.log(
      `OSM hole-geometry crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`,
    )
    await crawlOsmHoles(states, args.force, args.limit)
  } else if (args.source === 'enrich') {
    console.log(
      `Enrich crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`,
    )
    await crawlEnrich(states, args.force, args.limit)
  } else {
    // osm-first: phase 1 = OSM coverage, phase 2 = OpenGolfAPI enrichment.
    console.log(
      `OSM-first crawl: ${states.length} state(s)${args.force ? ' (force)' : ''}`,
    )
    await crawlOsm(states, args.force, args.limit)
    await crawlEnrich(states, args.force, args.limit)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
