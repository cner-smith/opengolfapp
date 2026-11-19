/**
 * Import a golf course from OpenStreetMap into Supabase.
 *
 * Usage:
 *   tsx scripts/import-osm-course.ts --name "Lake Hefner North" \
 *     --lat 35.558 --lng -97.565 --radius 1500
 *
 * Queries Overpass for golf=hole|green|tee within a circle, parses
 * the way + node geometry, and upserts a course + 18 holes with
 * tee_lat/lng + pin_lat/lng. Re-running is safe: the course is
 * matched by name and holes are upserted on (course_id, number).
 *
 * Pass --update-existing to refuse creating a new course row, so a
 * name that misses the existing course fails instead of making a
 * duplicate. Holes are updated in place either way; a hole no longer
 * in OSM is kept (deleting it would drop its green map).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read from .env via
 * dotenv/config or the shell).
 *
 * The actual fetch/parse/match/upsert logic lives in
 * @oga/supabase's osm-import.ts (runOsmImport) — shared with the
 * dev-only Course Editor's "re-fetch from OSM" button. This file is
 * just CLI arg parsing + console output.
 */
import 'dotenv/config'
import { osmGreenMap } from '@oga/core'
import { createOgaServiceClient, runOsmImport, type OsmImportArgs } from '@oga/supabase'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createOgaServiceClient(URL, SERVICE_KEY)

function parseArgs(argv: string[]): OsmImportArgs {
  let name: string | undefined
  let lat: number | undefined
  let lng: number | undefined
  let radius: number | undefined
  let updateExisting = false
  let courseFilter: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--name' && next != null) {
      name = next
      i++
    } else if (a === '--lat' && next != null) {
      lat = Number(next)
      i++
    } else if (a === '--lng' && next != null) {
      lng = Number(next)
      i++
    } else if (a === '--radius' && next != null) {
      radius = Number(next)
      i++
    } else if (a === '--update-existing') {
      updateExisting = true
    } else if (a === '--course-filter' && next != null) {
      courseFilter = next
      i++
    }
  }
  if (!name || lat == null || lng == null || radius == null) {
    throw new Error(
      'Usage: tsx scripts/import-osm-course.ts --name "<Course Name>" --lat <lat> --lng <lng> --radius <meters> [--update-existing] [--course-filter <substring>]',
    )
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
    throw new Error('--lat, --lng, --radius must be numeric')
  }
  return { name, lat, lng, radius, updateExisting, courseFilter, greenMap: osmGreenMap }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(
    `Querying Overpass for "${args.name}" around ${args.lat},${args.lng} (r=${args.radius}m)…`,
  )
  if (args.courseFilter) {
    console.log(`  Course filter: hole ways whose name contains "${args.courseFilter}" (case-insensitive)`)
  }

  const summary = await runOsmImport(supabase, args)

  if (summary.dedupedRefs.length > 0) {
    console.log(
      `  Dedup: duplicate hole ways collapsed for refs ${summary.dedupedRefs.join(', ')}`,
    )
  }
  console.log(`${summary.created ? '✓ Created course' : '✓ Updated course'}: ${args.name}`)
  console.log(
    `✓ Imported ${summary.holesImported} holes (${summary.greenMatches} with green coords, ${summary.teeMatches} with tee coords)`,
  )
  console.log(`  Refs found: ${summary.refsFound.join(', ')}`)
  if (summary.missingRefs.length) {
    console.log(`  Refs missing from 1-18: ${summary.missingRefs.join(', ')}`)
  }
  if (summary.missingGreenRefs.length) {
    console.log(
      `  Holes falling back to hole-way endpoint for pin: ${summary.missingGreenRefs.join(', ')}`,
    )
  }
  console.log(`✓ Green outlines written: ${summary.greenOutlinesWritten}`)
  if (summary.greenOutlineFlaggedRefs.length) {
    console.log(
      `  Holes whose end is in no green (nearest within 30 m taken, flagged): ${summary.greenOutlineFlaggedRefs.join(', ')}`,
    )
  }
  if (summary.greenOutlineMissingRefs.length) {
    console.log(`  Holes with no OSM green outline: ${summary.greenOutlineMissingRefs.join(', ')}`)
  }
  if (summary.missingTeeRefs.length) {
    console.log(
      `  Holes falling back to hole-way endpoint for tee: ${summary.missingTeeRefs.join(', ')}`,
    )
  }
  if (summary.missingParRefs.length) {
    console.log(`  Holes with no/invalid par (defaulted to 4): ${summary.missingParRefs.join(', ')}`)
  }
  if (summary.missingYardsRefs.length) {
    console.log(`  Holes with no yardage (left null): ${summary.missingYardsRefs.join(', ')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
