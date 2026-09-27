// Recompute the strokes gained stamped on completed rounds (rounds.sg_* and
// hole_scores.sg_*) with the current baselines — after a baseline change such
// as the #632 seam fix. Mirrors the SG step of the finish flow
// (apps/mobile/lib/completeRound.ts): per-round par overrides, the player's
// handicap (DEFAULT_HANDICAP when unset). Rounds don't record the handicap SG
// was first computed with, so the current profile value is used.
//
// Only rounds whose stored SG the PREVIOUS around-green rows reproduce (to the
// cent) are rewritten — that proves the stored numbers came from this engine
// with this handicap, so the seam fix is the only change. Rounds without
// shots (scorecard-only, imported, seeded) and any other mismatch are
// reported and left alone.
//
// Dry run by default: prints each round whose SG would change and logs old +
// new values to docs/internal/data-repair/ (the rollback).
//
//   DOTENV_CONFIG_PATH=apps/web/.env.test.local tsx scripts/recompute-round-sg.ts [--apply]
import { mkdirSync, writeFileSync } from 'node:fs'
import { AROUND_GREEN_BASELINES, DEFAULT_HANDICAP, computeRoundSG } from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from './crawl/client'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
const SG = ['sg_off_tee', 'sg_approach', 'sg_around_green', 'sg_putting'] as const

const apply = process.argv.includes('--apply')
const host = new URL(process.env.SUPABASE_URL ?? '').host
const round2 = (n: number) => Math.round(n * 100) / 100
const stamp = (b: { offTee: number; approach: number; aroundGreen: number; putting: number; total: number }) => ({
  sg_off_tee: round2(b.offTee),
  sg_approach: round2(b.approach),
  sg_around_green: round2(b.aroundGreen),
  sg_putting: round2(b.putting),
  sg_total: round2(b.total),
})

// The around-green rows before #632 (origin/dev sg-baselines.ts).
const PREVIOUS_AROUND_GREEN: typeof AROUND_GREEN_BASELINES = {
  0: { 5: 2.18, 10: 2.3, 15: 2.4, 20: 2.52, 30: 2.64 },
  5: { 5: 2.3, 10: 2.44, 15: 2.56, 20: 2.7, 30: 2.84 },
  10: { 5: 2.44, 10: 2.6, 15: 2.74, 20: 2.9, 30: 3.06 },
  15: { 5: 2.6, 10: 2.78, 15: 2.94, 20: 3.12, 30: 3.3 },
  20: { 5: 2.78, 10: 2.98, 15: 3.16, 20: 3.36, 30: 3.56 },
  25: { 5: 2.98, 10: 3.2, 15: 3.4, 20: 3.62, 30: 3.84 },
  30: { 5: 3.2, 10: 3.44, 15: 3.66, 20: 3.9, 30: 4.14 },
}
const CURRENT_AROUND_GREEN = structuredClone(AROUND_GREEN_BASELINES)
function withAroundGreen<T>(rows: typeof AROUND_GREEN_BASELINES, fn: () => T): T {
  Object.assign(AROUND_GREEN_BASELINES, structuredClone(rows))
  try {
    return fn()
  } finally {
    Object.assign(AROUND_GREEN_BASELINES, structuredClone(CURRENT_AROUND_GREEN))
  }
}

async function main() {
  console.log(`target ${host} · ${apply ? 'APPLY' : 'dry run'}`)
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('id, user_id, course_id, sg_off_tee, sg_approach, sg_around_green, sg_putting, sg_total')
    .not('completed_at', 'is', null)
    .range(0, 9999)
  if (error) throw error

  const changes: unknown[] = []
  const skipped = { noShots: 0, notReproduced: [] as unknown[], holesNotReproduced: 0 }
  for (const r of rounds ?? []) {
    const [holesRes, hsRes, profRes] = await Promise.all([
      supabase.from('holes').select('*').eq('course_id', r.course_id),
      supabase.from('hole_scores').select('*').eq('round_id', r.id),
      supabase.from('profiles').select('handicap_index').eq('id', r.user_id).maybeSingle(),
    ])
    if (holesRes.error || hsRes.error || profRes.error) throw holesRes.error ?? hsRes.error ?? profRes.error
    const holeScores = (hsRes.data ?? []) as HoleScoreRow[]
    const shotsRes = await supabase
      .from('shots')
      .select('*')
      .in('hole_score_id', holeScores.map((h) => h.id))
    if (shotsRes.error) throw shotsRes.error
    const parOverride = new Map(holeScores.filter((h) => h.par != null).map((h) => [h.hole_id, h.par!]))
    const holes = ((holesRes.data ?? []) as HoleRow[]).map((h) =>
      parOverride.has(h.id) ? { ...h, par: parOverride.get(h.id)! } : h,
    )
    const shots = (shotsRes.data ?? []) as ShotRow[]
    if (shots.length === 0) {
      skipped.noShots++
      continue
    }
    const input = { holes, holeScores, shots, handicap: profRes.data?.handicap_index ?? DEFAULT_HANDICAP }
    const before = withAroundGreen(PREVIOUS_AROUND_GREEN, () => computeRoundSG(input))
    const was = stamp(before.round)
    if ((Object.keys(was) as (keyof typeof was)[]).some((k) => was[k] !== r[k])) {
      skipped.notReproduced.push({ round: r.id, stored: r, reproduced: was })
      continue
    }
    const result = computeRoundSG(input)
    const next = stamp(result.round)
    const roundChanged = (Object.keys(next) as (keyof typeof next)[]).some((k) => r[k] !== next[k])
    // A hole is rewritten only when the old rows reproduce its stored values too.
    const holesChanged = Object.entries(result.perHoleScore).flatMap(([id, sg]) => {
      const stored = holeScores.find((h) => h.id === id)
      const prev = before.perHoleScore[id]
      if (!stored || !prev) return []
      const { sg_total: _p, ...old } = stamp(prev)
      const { sg_total: _n, ...nextHole } = stamp(sg)
      if (SG.some((k) => stored[k] !== old[k])) {
        skipped.holesNotReproduced++
        return []
      }
      return SG.some((k) => old[k] !== nextHole[k]) ? [{ id, old, next: nextHole }] : []
    })
    if (!roundChanged && holesChanged.length === 0) continue
    console.log(`${r.id}  sg_total ${r.sg_total} → ${next.sg_total}  (${holesChanged.length} holes)`)
    changes.push({ round: r.id, old: r, next, holes: holesChanged })

    if (apply) {
      const u = await supabase.from('rounds').update(next).eq('id', r.id)
      if (u.error) throw u.error
      for (const h of holesChanged) {
        const hu = await supabase.from('hole_scores').update(h.next).eq('id', h.id)
        if (hu.error) throw hu.error
      }
    }
  }

  mkdirSync('docs/internal/data-repair', { recursive: true })
  const log = `docs/internal/data-repair/round-sg-${host.split('.')[0]}-${Date.now()}.json`
  writeFileSync(log, JSON.stringify({ host, apply, changes, skipped }, null, 1))
  console.log(
    `\n${changes.length}/${rounds?.length ?? 0} completed rounds ${apply ? 'updated' : 'would change'}` +
      ` · skipped: ${skipped.noShots} without shots, ${skipped.notReproduced.length} not reproduced` +
      ` (+${skipped.holesNotReproduced} holes) · log: ${log}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
