// Recompute the strokes gained stamped on completed rounds (rounds.sg_* and
// hole_scores.sg_*) with the current engine — after a baseline change such as
// #632 (around-green seam) or #998 (tee lines + approach table to 600 yd), or an
// engine fix such as #1094 (OB re-tee / drop).
//
// Also repairs putt lengths the end-of-hole review saved as how far the putt
// rolled (#1092): a putt's putt_distance_ft is rewritten to start → pin only
// when it carries that bug's signature — it equals the rolled distance (start →
// next shot's start, with the review's rounding, ±1 ft) and differs from start →
// pin. Typed or imported lengths don't match and are left alone. The stored SG
// is checked against the ORIGINAL rows; the new SG is computed from the repaired
// ones.
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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_HANDICAP, computeRoundSG, haversineYards } from '@oga/core'
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
  { label: 'pre-#1094', rev: '484cb9b5' },
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
      rmSync(dir, { recursive: true })
      return { label, computeRoundSG: mod.computeRoundSG as typeof computeRoundSG }
    }),
  )
}

type PuttFix = { id: string; old: number; next: number | null }

// The review rounded twice: round1 yards (inferShot), then whole feet.
const reviewFeet = (yards: number) => Math.round((Math.round(yards * 10) / 10) * 3)

function repairPutts(shots: ShotRow[], holeScores: HoleScoreRow[], holes: HoleRow[]) {
  const fixes: PuttFix[] = []
  const byId = new Map(shots.map((s) => [s.id, s]))
  for (const hs of holeScores) {
    const hole = holes.find((h) => h.id === hs.hole_id)
    const pinLat = hs.pin_lat ?? hole?.pin_lat
    const pinLng = hs.pin_lng ?? hole?.pin_lng
    if (pinLat == null || pinLng == null) continue
    const own = shots.filter((s) => s.hole_score_id === hs.id).sort((a, b) => a.shot_number - b.shot_number)
    own.forEach((s, i) => {
      const next = own[i + 1]
      if (!next || s.lie_type !== 'green' || s.club !== 'putter' || s.putt_distance_ft == null) return
      if (s.start_lat == null || s.start_lng == null || next.start_lat == null || next.start_lng == null) return
      const stored = Number(s.putt_distance_ft)
      const rolled = reviewFeet(haversineYards(s.start_lat, s.start_lng, next.start_lat, next.start_lng))
      const fromHole = reviewFeet(haversineYards(s.start_lat, s.start_lng, pinLat, pinLng))
      const nextFt = fromHole <= 999 ? fromHole : null
      if (Math.abs(stored - rolled) > 1 || nextFt === stored) return
      fixes.push({ id: s.id, old: stored, next: nextFt })
      byId.set(s.id, { ...s, putt_distance_ft: nextFt })
    })
  }
  return { fixes, shots: shots.map((s) => byId.get(s.id)!) }
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
  let puttFixCount = 0
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
    // Putt repairs are written only for rounds whose SG we restamp, so the two
    // never disagree; rounds left alone are reported above and keep both.
    const repaired = repairPutts(shots, holeScores, holes)
    const result = computeRoundSG({ ...input, shots: repaired.shots })
    const next = stamp(result.round)
    const roundChanged = (Object.keys(next) as (keyof typeof next)[]).some((k) => r[k] !== next[k])
    // A hole is rewritten only when the same previous engine reproduces its stored values too.
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
    if (!roundChanged && holesChanged.length === 0 && repaired.fixes.length === 0) continue
    puttFixCount += repaired.fixes.length
    console.log(
      `${r.id}  [${found.e.label}]  sg_total ${r.sg_total} → ${next.sg_total}` +
        `  (${holesChanged.length} holes, ${repaired.fixes.length} putt lengths)`,
    )
    changes.push({ round: r.id, engine: found.e.label, old: r, next, holes: holesChanged, putts: repaired.fixes })

    if (apply) {
      const u = await supabase.from('rounds').update(next).eq('id', r.id)
      if (u.error) throw u.error
      for (const h of holesChanged) {
        const hu = await supabase.from('hole_scores').update(h.next).eq('id', h.id)
        if (hu.error) throw hu.error
      }
      for (const f of repaired.fixes) {
        const su = await supabase.from('shots').update({ putt_distance_ft: f.next }).eq('id', f.id)
        if (su.error) throw su.error
      }
    }
  }

  mkdirSync('docs/internal/data-repair', { recursive: true })
  const log = `docs/internal/data-repair/round-sg-${host.split('.')[0]}-${Date.now()}.json`
  writeFileSync(log, JSON.stringify({ host, apply, changes, skipped }, null, 1))
  console.log(
    `\n${changes.length}/${rounds?.length ?? 0} completed rounds ${apply ? 'updated' : 'would change'}` +
      ` · ${puttFixCount} putt lengths` +
      ` · skipped: ${skipped.noShots} without shots, ${skipped.notReproduced.length} not reproduced` +
      ` (+${skipped.holesNotReproduced} holes) · log: ${log}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
