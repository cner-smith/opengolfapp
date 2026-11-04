// Find courses that are the same course stored twice (#1369): two rows whose
// holes carry the identical pin sequence (9+ holes, pins to 5 decimals, about a
// metre). Example: Westwood, Norman OK, once as an OSM way and once as an
// OpenGolfAPI listing, with different external_ids, so neither the upsert nor
// the name-based reconcile pass caught it.
//
// Keeper = the group's single OSM row. The other rows are folded into it with
// the crawler's mergeAndDeletePhantom (moves rounds + tees, deletes the copy).
// Only non-OSM rows are ever deleted: the OSM crawl upserts on external_id, so
// a deleted OSM row would come back on the next crawl. Everything else is
// reported for manual handling:
//   - FLAG  no OSM row, or 2+ OSM rows (the crawler mapped the same holes onto
//           two OSM ways; needs the importer guard, not a delete)
//   - SKIP  the copy has rounds or hole scores (its hole_scores point at its own
//           holes; repoint them by hole number first)
//
// Dry run by default. --apply writes the copies' rows to
// docs/internal/data-repair/<date>-1369-same-pin-courses.json first (rollback),
// then merges.
//
//   DOTENV_CONFIG_PATH=apps/web/.env.adminprod.local tsx scripts/dedupe-same-pins.ts [--apply]
import { mkdirSync, writeFileSync } from 'node:fs'
import { supabase } from './crawl/client'
import { courseHasUserData, mergeAndDeletePhantom } from './crawl/db-writer'

const apply = process.argv.includes('--apply')
if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set (DOTENV_CONFIG_PATH?)')
const host = new URL(process.env.SUPABASE_URL).host
const PAGE = 1000

type Course = {
  id: string
  external_id: string | null
  name: string
  city: string | null
  state: string | null
}
const isOsm = (c: Course) => (c.external_id ?? '').startsWith('osm_')

async function pagedSelect<T>(table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  // `any`:  the PostgREST builder's generic type isn't worth spelling out for a one-off
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from(table)
      .select(cols)
      .order('id')
      .range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table} fetch failed at ${from}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if ((data ?? []).length < PAGE) return out
  }
}

async function main() {
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} against ${host}\n`)
  const holes = await pagedSelect<{
    course_id: string
    number: number
    pin_lat: number
    pin_lng: number
  }>('holes', 'id, course_id, number, pin_lat, pin_lng', (q) =>
    q.not('pin_lat', 'is', null).not('pin_lng', 'is', null),
  )
  const byCourse = new Map<string, string[]>()
  for (const h of holes) {
    const pins = byCourse.get(h.course_id) ?? []
    pins[h.number] = `${h.number}:${Number(h.pin_lat).toFixed(5)},${Number(h.pin_lng).toFixed(5)}`
    byCourse.set(h.course_id, pins)
  }
  const bySig = new Map<string, string[]>()
  for (const [courseId, pins] of byCourse) {
    const sig = pins.filter(Boolean)
    if (sig.length < 9) continue
    const key = sig.join('|')
    bySig.set(key, [...(bySig.get(key) ?? []), courseId])
  }
  const groups = [...bySig.values()].filter((g) => g.length > 1)

  const ids = groups.flat()
  const courses = new Map<string, Course>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, external_id, name, city, state')
      .in('id', ids.slice(i, i + 200))
    if (error) throw new Error(`courses fetch failed: ${error.message}`)
    for (const c of data ?? []) courses.set(c.id, c as Course)
  }

  const plan: { keeper: Course; copy: Course }[] = []
  let flagged = 0
  let skipped = 0
  const label = (c: Course) =>
    `"${c.name}" ${c.city ?? '?'}, ${c.state ?? '?'} [${c.external_id ?? 'manual'}] ${c.id}`
  for (const g of groups) {
    const rows = g.map((id) => courses.get(id)!).filter(Boolean)
    const osm = rows.filter(isOsm)
    if (osm.length !== 1) {
      flagged++
      console.log(
        `FLAG  ${osm.length} OSM rows:\n${rows.map((c) => `        ${label(c)}`).join('\n')}`,
      )
      continue
    }
    const keeper = osm[0]
    for (const copy of rows.filter((c) => c !== keeper)) {
      // Same pins in two states = the importer gave one course's holes to another.
      if (copy.state && keeper.state && copy.state !== keeper.state) {
        skipped++
        console.log(`SKIP  ${label(copy)}\n        state differs from keeper ${label(keeper)}`)
        continue
      }
      if (await courseHasUserData(copy.id)) {
        skipped++
        console.log(`SKIP  ${label(copy)}\n        has rounds/hole scores; keeper ${label(keeper)}`)
        continue
      }
      plan.push({ keeper, copy })
      console.log(`MERGE ${label(copy)}\n     → ${label(keeper)}`)
    }
  }

  console.log(
    `\n${groups.length} groups, ${ids.length} courses: ${plan.length} to merge, ` +
      `${skipped} skipped (user data or state), ${flagged} groups flagged`,
  )
  if (!apply || plan.length === 0) return

  // Rollback: the copies' course rows, holes and tees as they are before the merge.
  const copyIds = plan.map((p) => p.copy.id)
  const backup = {
    courses: await pagedSelect('courses', '*', (q) => q.in('id', copyIds)),
    holes: await pagedSelect('holes', '*', (q) => q.in('course_id', copyIds)),
    course_tees: await pagedSelect('course_tees', '*', (q) => q.in('course_id', copyIds)),
    plan: plan.map((p) => ({ keeper: p.keeper.id, copy: p.copy.id })),
  }
  mkdirSync('docs/internal/data-repair', { recursive: true })
  const file = `docs/internal/data-repair/${new Date().toISOString().slice(0, 10)}-1369-same-pin-courses.json`
  writeFileSync(file, JSON.stringify(backup, null, 1))
  console.log(`backup → ${file}`)
  let merged = 0
  for (const { keeper, copy } of plan) {
    try {
      await mergeAndDeletePhantom(copy.id, keeper.id)
      merged++
    } catch (e) {
      console.error(`FAILED ${copy.id} → ${keeper.id}: ${(e as Error).message}`)
    }
  }
  console.log(`merged ${merged} of ${plan.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
