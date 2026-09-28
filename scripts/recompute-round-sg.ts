// Recompute the strokes gained stamped on completed rounds (rounds.sg_* and
// hole_scores.sg_*) with the current engine — after a baseline change such as
// #632 (around-green seam) or #998 (tee lines + approach table to 600 yd).
// Mirrors the SG step of the finish flow (apps/mobile/lib/completeRound.ts):
// per-round par overrides, the player's handicap (DEFAULT_HANDICAP when unset).
// Rounds don't record the handicap SG was first computed with, so the current
// profile value is used.
//
// A round is rewritten only when one of the PREVIOUS engines (loaded from git
// history, see PREVIOUS) reproduces its stored SG to the cent — proof the stored
// numbers came from this engine with this handicap, so the baseline change is
// the only difference. Prod never got the #632 recompute, so its rounds match
// the pre-#632 engine; dev's #632-recomputed rounds match pre-#998. Rounds
// without shots (scorecard-only, imported, seeded) and any other mismatch are
// reported and left alone.
//
// Dry run by default: prints each round whose SG would change and logs old +
// new values to docs/internal/data-repair/ (the rollback).
//
//   DOTENV_CONFIG_PATH=apps/web/.env.test.local tsx scripts/recompute-round-sg.ts [--apply]
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_HANDICAP, computeRoundSG } from '@oga/core'
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

// Engines stored SG may have been computed with, newest first: the commit
// before each baseline change. Each is @oga/core's src extracted from git.
const PREVIOUS = [
  { label: 'pre-#998', rev: 'a19a508^' },
  { label: 'pre-#632', rev: 'abb25c3^' },
]
type Engine = { label: string; computeRoundSG: typeof computeRoundSG }
async function loadEngines(): Promise<Engine[]> {
  return Promise.all(
    PREVIOUS.map(async ({ label, rev }) => {
      const dir = mkdtempSync(join(tmpdir(), 'oga-sg-'))
      execSync(`git archive ${rev} packages/core/src | tar -x -C ${dir}`)
      const mod = await import(pathToFileURL(join(dir, 'packages/core/src/sg.ts')).href)
      return { label, computeRoundSG: mod.computeRoundSG as typeof computeRoundSG }
    }),
  )
}

async function main() {
  console.log(`target ${host} · ${apply ? 'APPLY' : 'dry run'}`)
  const engines = await loadEngines()
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
    const matches = (b: ReturnType<typeof computeRoundSG>) => {
      const was = stamp(b.round)
      return (Object.keys(was) as (keyof typeof was)[]).every((k) => was[k] === r[k])
    }
    const found = engines.map((e) => ({ e, out: e.computeRoundSG(input) })).find(({ out }) => matches(out))
    if (!found) {
      skipped.notReproduced.push({ round: r.id, stored: r })
      continue
    }
    const before = found.out
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
    console.log(`${r.id}  [${found.e.label}]  sg_total ${r.sg_total} → ${next.sg_total}  (${holesChanged.length} holes)`)
    changes.push({ round: r.id, engine: found.e.label, old: r, next, holes: holesChanged })

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
