/**
 * The promo golfer for landing-page and store screenshots (`pnpm seed:promo`,
 * SEED_PROFILE=promo in seed-demo.ts). One ~12-handicap whose every screen
 * tells the same story: approach is the clear leak, off the tee the strength,
 * the 7-iron finishes a little short and right, and the week's plan works on
 * approach.
 *
 * Unlike the e2e seed, nothing here is stamped from a story: every hole is
 * played shot by shot on a real course, and the round's SG, scorecard, fairways,
 * GIR and handicap differential are what the app's own engine computes from
 * those shots (computeRoundSG at the profile's handicap, the WHS differential
 * and index), so a round completed in the app would store the same numbers.
 * The story comes from the player (seed-promo-player.ts) and from picking which seeded
 * candidate rounds to keep (pickRounds), so Last 5, 10 and 15 agree, every
 * club's median sits on its rung and the 7-iron reads short and right.
 * Same SEED, same screens.
 *
 * Against the 15-bracket baseline (a 12.4) a clean ~235-yd drive gains about
 * 0.25, so the driver carries real trouble (topped drives, about a penalty a
 * round) to keep off the tee near +1.5 a round, with a sharp short game and
 * putting making up the rest of a 12.4's ~+2.6.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@oga/supabase'
import {
  DEFAULT_BAG,
  adjustedScore,
  aimAdvice,
  calculateDifferential,
  calculateHandicapIndex,
  combinedPuttResult,
  computeDispersion,
  computeDispersionStats,
  computeRoundSG,
  getHandicapBracket,
  haversineYards,
  legacyShotResult,
  median,
  sgFinding,
  shotRowToShot,
  type DispersionPoint,
  type SGBreakdown,
  type Shot,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import {
  PLAY,
  dice,
  dist,
  playHole,
  type PromoHole,
  type Pt,
  type SimShot,
} from './seed-promo-player'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type ShotFields = Omit<Database['public']['Tables']['shots']['Insert'], 'hole_score_id' | 'user_id'>

// --- Courses and calendar -------------------------------------------------

// Real DEV courses whose hole geometry matches a rated tee's length, and where
// the SG baseline's expected score sits near what that tee's rating predicts
// for a 12-handicap — so a 12.4 gains about what a 12.4 should against the
// 15-bracket baseline. Sam is a Hilton Head local with a Bandon trip.
const BEAR_CREEK = '7a0c534d-b292-4de4-84bd-a6e34660b62d' // white 6162, 71.5/132
const HARBOUR_TOWN = '4f5efecb-6117-439f-a8ee-5949622d4732' // blue 6670, 73.4/144
const BANDON_TRAILS = '51808b4b-9dcc-4027-b31d-ac54b6512aa2' // black 6765, 73.6/130
const COURSE_TEE: Record<string, string> = {
  [BEAR_CREEK]: 'white',
  [HARBOUR_TOWN]: 'blue',
  [BANDON_TRAILS]: 'black',
}

// Most recent first: about two rounds a week, the Bandon pair on back-to-back days.
const ROUNDS: { daysAgo: number; course: string; approach: number }[] = [
  { daysAgo: 3, course: BEAR_CREEK, approach: -0.6 },
  { daysAgo: 7, course: HARBOUR_TOWN, approach: -1.1 },
  { daysAgo: 10, course: BEAR_CREEK, approach: -0.5 },
  { daysAgo: 14, course: BEAR_CREEK, approach: -0.9 },
  { daysAgo: 17, course: HARBOUR_TOWN, approach: -0.9 },
  { daysAgo: 22, course: BANDON_TRAILS, approach: -1.2 },
  { daysAgo: 23, course: BANDON_TRAILS, approach: -0.4 },
  { daysAgo: 28, course: BEAR_CREEK, approach: -0.8 },
  { daysAgo: 31, course: HARBOUR_TOWN, approach: -1.0 },
  { daysAgo: 35, course: BEAR_CREEK, approach: -0.6 },
  { daysAgo: 38, course: HARBOUR_TOWN, approach: -0.7 },
  { daysAgo: 42, course: BEAR_CREEK, approach: -1.1 },
  { daysAgo: 45, course: BEAR_CREEK, approach: -0.5 },
  { daysAgo: 49, course: HARBOUR_TOWN, approach: -0.9 },
  { daysAgo: 52, course: BEAR_CREEK, approach: -0.8 },
]
// Every five rounds average −0.8 on approach, so Last 5, Last 10 and Last 15/20
// read the same leak.

// Per-round targets for the other categories, near where this player lands
// unpicked, and the differential each round aims at (its score on that tee).
const TARGET = { offTee: 1.45, aroundGreen: 0.75, putting: 0.95 }
const DIFFERENTIALS = [
  13.6, 16.4, 12.2, 15.3, 17.0, 11.9, 12.9, 17.8, 14.8, 12.4, 15.7, 14.3, 12.6, 16.6, 14.6,
]
const START_INDEX = 12.4
const CANDIDATES = 1200
const SHORTLIST = 150
const ANNEAL_STEPS = 150_000
const LEAK = -0.8
// The 7-iron's average finish from the aim, yards: a little short and right.
const SEVEN_IRON = { short: 6, right: 6 }
const SEED = 20261021

// --- Rows, SG and the round -------------------------------------------------

interface PlayedHole {
  hole: PromoHole
  score: number
  putts: number
  penalties: number
  fairwayHit: boolean | null
  gir: boolean
  shots: ShotFields[]
}

function holeRows(hole: PromoHole, sim: SimShot[]): PlayedHole {
  const kx = 121_000 * Math.cos((hole.tee.lat * Math.PI) / 180)
  const ll = (p: Pt) => ({ lat: hole.tee.lat + p.y / 121_000, lng: hole.tee.lng + p.x / kx })
  const pin: Pt = {
    x: (hole.pin.lng - hole.tee.lng) * kx,
    y: (hole.pin.lat - hole.tee.lat) * 121_000,
  }
  const shots: ShotFields[] = sim.map((s, i) => {
    const start = ll(s.start)
    const aim = ll(s.aim)
    const end = dist(s.end, pin) < 0.01 ? hole.pin : ll(s.end)
    const toPin = haversineYards(start.lat, start.lng, hole.pin.lat, hole.pin.lng)
    const onGreen = s.lie === 'green'
    return {
      shot_number: i + 1,
      start_lat: start.lat,
      start_lng: start.lng,
      aim_lat: onGreen ? hole.pin.lat : aim.lat,
      aim_lng: onGreen ? hole.pin.lng : aim.lng,
      end_lat: end.lat,
      end_lng: end.lng,
      distance_to_target: onGreen ? null : Math.round(toPin),
      club: s.club,
      lie_type: s.lie,
      shot_result: onGreen
        ? null
        : legacyShotResult({
            contact: s.contact,
            startLine: s.startLine,
            penalty: s.penalty,
            ob: s.ob,
          }),
      contact: s.contact,
      start_line: s.startLine,
      shape: s.shape,
      penalty: s.penalty,
      ob: s.ob,
      putt_distance_ft: onGreen ? Math.round(toPin * 30) / 10 : null,
      putt_distance_result: s.putt?.distance ?? null,
      putt_direction_result: s.putt?.direction ?? null,
      putt_result: s.putt
        ? combinedPuttResult({
            made: s.putt.made,
            distance: s.putt.distance,
            direction: s.putt.direction,
          })
        : null,
    }
  })
  const penalties = sim.filter((s) => s.penalty || s.ob).length
  const putts = sim.filter((s) => s.lie === 'green').length
  const firstPutt = sim.findIndex((s) => s.lie === 'green')
  const strokesToGreen =
    firstPutt < 0
      ? Infinity
      : firstPutt + sim.slice(0, firstPutt).filter((s) => s.penalty || s.ob).length
  return {
    hole,
    score: sim.length + penalties,
    putts,
    penalties,
    fairwayHit: hole.par >= 4 ? !sim[0]!.ob && !sim[0]!.penalty && sim[1]?.lie === 'fairway' : null,
    gir: strokesToGreen <= hole.par - 2,
    shots,
  }
}

function roundSG(holes: PlayedHole[], handicap: number) {
  const fakeHoles = holes.map((h) => ({ id: h.hole.id, par: h.hole.par }) as HoleRow)
  const fakeScores = holes.map(
    (h) => ({ id: h.hole.id, hole_id: h.hole.id, score: h.score, putts: h.putts }) as HoleScoreRow,
  )
  const fakeShots = holes.flatMap((h) =>
    h.shots.map((s) => ({ ...s, hole_score_id: h.hole.id }) as unknown as ShotRow),
  )
  return computeRoundSG({ holes: fakeHoles, holeScores: fakeScores, shots: fakeShots, handicap })
}

interface PromoTee {
  id: string
  color: string
  rating: number
  slope: number
}

interface PromoCourse {
  id: string
  name: string
  holes: PromoHole[]
  tee: PromoTee
}

function differential(holes: PlayedHole[], index: number, tee: PromoTee): number {
  const adjusted = adjustedScore(
    holes.map((h) => ({ score: h.score, par: h.hole.par, strokeIndex: null })),
    index,
    { courseRating: tee.rating, slopeRating: tee.slope },
  )
  return calculateDifferential(adjusted, tee.rating, tee.slope)
}

interface Candidate {
  holes: PlayedHole[]
  sg: SGBreakdown
  score: number
  /** At START_INDEX; the index is settled after the pick. */
  diff: number
  /** Start→finish yards per club: what My Bag's typical distance is the median of. */
  yards: Map<string, number[]>
  /** The 7-iron's shots in the aim frame, as Patterns plots them. */
  seven: DispersionPoint[]
  /** Distance from this round's own targets. */
  cost: number
}

function playRound(
  course: PromoCourse,
  seed: number,
  target: { approach: number; score: number },
): Candidate {
  const d = dice(seed)
  const holes = course.holes.map((h) => holeRows(h, playHole(h, d)))
  const sg = roundSG(holes, START_INDEX).round
  const score = holes.reduce((s, h) => s + h.score, 0)
  const yards = new Map<string, number[]>()
  const sevens: Shot[] = []
  for (const h of holes) {
    for (const s of h.shots) {
      if (!s.club || s.club === 'putter') continue
      const list = yards.get(s.club) ?? []
      list.push(haversineYards(s.start_lat!, s.start_lng!, s.end_lat!, s.end_lng!))
      yards.set(s.club, list)
      if (s.club === '7i') {
        const shot = shotRowToShot({
          ...s,
          id: `${h.hole.id}-${s.shot_number}`,
        } as unknown as ShotRow)
        sevens.push({
          ...shot,
          shape: s.shape as ShotShape | null,
          startLine: s.start_line as ShotStartLine | null,
        })
      }
    }
  }
  const cost =
    ((sg.approach - target.approach) / 0.4) ** 2 +
    ((sg.offTee - TARGET.offTee) / 1.2) ** 2 +
    ((sg.aroundGreen - TARGET.aroundGreen) / 0.8) ** 2 +
    ((sg.putting - TARGET.putting) / 0.8) ** 2 +
    ((score - target.score) / 2.5) ** 2
  return {
    holes,
    sg,
    score,
    diff: differential(holes, START_INDEX, course.tee),
    yards,
    seven: computeDispersion(sevens),
    cost,
  }
}

// Where each club's median should land: its full swing (stock + long), a
// couple of yards under for the mishits; the lob wedge also plays 60–90 yd.
const typicalTarget = (club: string) =>
  club === 'lw' ? 79 : PLAY[club]!.stock + PLAY[club]!.long - 2

// The whole set's fit: each round's own cost, every club's median on its
// rung, Last 5 / 10 / 15 approach at −0.8, the index at START_INDEX and a
// 7-iron pattern Patterns calls short and right with room to spare.
function setCost(picked: Candidate[]): number {
  let cost = picked.reduce((s, c) => s + c.cost, 0)
  for (const club of Object.keys(PLAY)) {
    const m = median(picked.flatMap((c) => c.yards.get(club) ?? []))
    cost += m == null ? 1e6 : ((m - typicalTarget(club)) / 0.5) ** 2
  }
  for (const n of [5, 10, 15]) {
    const mean = picked.slice(0, n).reduce((s, c) => s + c.sg.approach, 0) / n
    cost += ((mean - LEAK) / 0.008) ** 2
  }
  // The rest of the spread holds over Last 10 and Last 15 too.
  for (const n of [10, 15]) {
    for (const k of ['offTee', 'aroundGreen', 'putting'] as const) {
      const mean = picked.slice(0, n).reduce((s, c) => s + c.sg[k], 0) / n
      cost += ((mean - TARGET[k]) / 0.05) ** 2
    }
  }
  const index = calculateHandicapIndex(picked.map((c) => c.diff))
  cost += index == null ? 1e6 : ((index - START_INDEX) / 0.02) ** 2
  const stats = computeDispersionStats(picked.flatMap((c) => c.seven))
  if (!stats) return cost + 1e6
  const noise = (sd: number) => Math.max(2, (2 * sd) / Math.sqrt(stats.sampleSize - 1)) + 1.5
  cost += (Math.max(0, noise(stats.stdLateral) - stats.avgLateralOffset) / 0.5) ** 2
  cost += (Math.max(0, noise(stats.stdDistance) + stats.avgDistanceOffset) / 0.5) ** 2
  cost +=
    ((stats.avgDistanceOffset + SEVEN_IRON.short) / 0.5) ** 2 +
    ((stats.avgLateralOffset - SEVEN_IRON.right) / 0.5) ** 2
  if (stats.shape !== 'fade') cost += 1000
  return cost
}

// Each round's best few candidates (all seeded), then a seeded annealing over
// the set: swap one round's pick at a time, keep what lowers setCost (and,
// early on, some of what doesn't, to get out of local minima). Same SEED,
// same rounds.
function pickRounds(courses: Map<string, PromoCourse>): Candidate[] {
  const pools = ROUNDS.map((r, i) => {
    const course = courses.get(r.course)!
    const target = {
      approach: r.approach,
      score: course.tee.rating + (DIFFERENTIALS[i]! * course.tee.slope) / 113,
    }
    const all: Candidate[] = []
    for (let k = 0; k < CANDIDATES; k++)
      all.push(playRound(course, SEED + i * 7919 + k * 104_729, target))
    return all.sort((a, b) => a.cost - b.cost).slice(0, SHORTLIST)
  })
  const d = dice(SEED)
  const picked = pools.map((p) => p[0]!)
  let current = setCost(picked)
  let best = { cost: current, picked: [...picked] }
  for (let step = 0; step < ANNEAL_STEPS; step++) {
    const temperature = 50 * (1 - step / ANNEAL_STEPS) ** 3
    const i = Math.floor(d.between(0, picked.length))
    const was = picked[i]!
    picked[i] = pools[i]![Math.floor(d.between(0, SHORTLIST))]!
    const cost = setCost(picked)
    if (cost < current || d.chance(Math.exp((current - cost) / Math.max(temperature, 1e-9)))) {
      current = cost
      if (cost < best.cost) best = { cost, picked: [...picked] }
    } else picked[i] = was
  }
  // Then polish: any single swap that still helps.
  const out = best.picked
  for (let pass = 0, improved = true; improved && pass < 30; pass++) {
    improved = false
    for (let i = 0; i < out.length; i++) {
      for (const alt of pools[i]!) {
        const was = out[i]!
        out[i] = alt
        const cost = setCost(out)
        if (cost < best.cost - 1e-9) {
          best.cost = cost
          improved = true
        } else out[i] = was
      }
    }
  }
  return out
}

// --- Writing it ---------------------------------------------------------------

function dateNDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const round2 = (n: number) => Math.round(n * 100) / 100

async function loadCourses(supabase: SupabaseClient): Promise<Map<string, PromoCourse>> {
  const out = new Map<string, PromoCourse>()
  for (const [id, color] of Object.entries(COURSE_TEE)) {
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    const { data: holes, error: holesErr } = await supabase
      .from('holes')
      .select('id, number, par, tee_lat, tee_lng, pin_lat, pin_lng')
      .eq('course_id', id)
      .order('number')
    if (holesErr) throw holesErr
    const { data: tee, error: teeErr } = await supabase
      .from('course_tees')
      .select('id, tee_color, course_rating, slope_rating')
      .eq('course_id', id)
      .eq('tee_color', color)
      .maybeSingle()
    if (teeErr) throw teeErr
    const played = (holes ?? []).filter(
      (h) => h.number >= 1 && h.number <= 18 && h.tee_lat != null && h.pin_lat != null,
    )
    if (!course || played.length !== 18 || !tee?.course_rating || !tee.slope_rating) {
      throw new Error(
        `Promo course ${id} (${course?.name ?? 'missing'}) needs 18 holes with tee+pin and a rated ${color} tee in this database.`,
      )
    }
    out.set(id, {
      id,
      name: course.name,
      holes: played.map((h) => ({
        id: h.id,
        number: h.number,
        par: h.par,
        tee: { lat: h.tee_lat!, lng: h.tee_lng! },
        pin: { lat: h.pin_lat!, lng: h.pin_lng! },
      })),
      tee: { id: tee.id, color: tee.tee_color, rating: tee.course_rating, slope: tee.slope_rating },
    })
  }
  return out
}

/** Seeds the promo golfer's bag, rounds and plan, and sets the profile's
 *  handicap to the WHS index of those rounds. The caller has wiped the user. */
export async function seedPromo(supabase: SupabaseClient, userId: string): Promise<void> {
  const courses = await loadCourses(supabase)
  const rounds = pickRounds(courses)

  // The index the differentials make (net double bogey depends on it, so
  // settle it), then SG at that index. Both stay in the 15 bracket.
  let index = START_INDEX
  for (let i = 0; i < 5; i++) {
    const diffs = rounds.map((r, j) =>
      differential(r.holes, index, courses.get(ROUNDS[j]!.course)!.tee),
    )
    index = calculateHandicapIndex(diffs)!
  }
  if (getHandicapBracket(index) !== getHandicapBracket(START_INDEX)) {
    throw new Error(`Promo rounds make a ${index} index, outside the bracket they were tuned for.`)
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ handicap_index: index })
    .eq('id', userId)
  if (profileErr) throw profileErr

  const { error: bagErr } = await supabase.from('user_clubs').insert(
    DEFAULT_BAG.map((c) => ({
      user_id: userId,
      club_type: c.club_type,
      name: c.name,
      sort_order: c.sort_order,
      in_bag: true,
      typical_distance_yards: PLAY[c.club_type]?.stock ?? null,
    })),
  )
  if (bagErr) throw bagErr

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i]!
    const course = courses.get(ROUNDS[i]!.course)!
    const playedAt = dateNDaysAgo(ROUNDS[i]!.daysAgo)
    const finished = new Date(`${playedAt}T18:00:00Z`).toISOString()
    const sg = roundSG(r.holes, index)
    const { data: round, error } = await supabase
      .from('rounds')
      .insert({
        user_id: userId,
        course_id: course.id,
        course_tee_id: course.tee.id,
        tee_color: course.tee.color,
        played_at: playedAt,
        completed_at: finished,
        capture_mode: 'track_patterns',
        total_score: r.score,
        total_putts: r.holes.reduce((s, h) => s + h.putts, 0),
        fairways_hit: r.holes.filter((h) => h.fairwayHit === true).length,
        fairways_total: r.holes.filter((h) => h.hole.par >= 4).length,
        gir: r.holes.filter((h) => h.gir).length,
        sg_off_tee: round2(sg.round.offTee),
        sg_approach: round2(sg.round.approach),
        sg_around_green: round2(sg.round.aroundGreen),
        sg_putting: round2(sg.round.putting),
        sg_total: round2(sg.round.total),
        score_differential: round2(differential(r.holes, index, course.tee)),
      })
      .select('id')
      .single()
    if (error || !round) throw error ?? new Error('round insert failed')

    const { data: scores, error: hsErr } = await supabase
      .from('hole_scores')
      .insert(
        r.holes.map((h) => {
          const hs = sg.perHoleScore[h.hole.id]!
          return {
            round_id: round.id,
            hole_id: h.hole.id,
            score: h.score,
            putts: h.putts,
            penalties: h.penalties,
            fairway_hit: h.fairwayHit,
            gir: h.gir,
            finished_at: finished,
            sg_off_tee: round2(hs.offTee),
            sg_approach: round2(hs.approach),
            sg_around_green: round2(hs.aroundGreen),
            sg_putting: round2(hs.putting),
          }
        }),
      )
      .select('id, hole_id')
    if (hsErr || !scores) throw hsErr ?? new Error('hole_scores insert failed')
    const scoreId = new Map(scores.map((s) => [s.hole_id, s.id]))
    const { error: shotsErr } = await supabase
      .from('shots')
      .insert(
        r.holes.flatMap((h) =>
          h.shots.map((s) => ({ ...s, hole_score_id: scoreId.get(h.hole.id)!, user_id: userId })),
        ),
      )
    if (shotsErr) throw shotsErr
    process.stdout.write('.')
  }
  process.stdout.write('\n')

  await insertPlan(supabase, userId, rounds, index)
}

// --- The week's plan ----------------------------------------------------------

const SG_LABELS = {
  offTee: 'Off the tee',
  approach: 'Approach',
  aroundGreen: 'Around the green',
  putting: 'Putting',
} as const
const PLAN_CATEGORY = {
  offTee: 'off_tee',
  approach: 'approach',
  aroundGreen: 'around_green',
  putting: 'putting',
} as const

// Two sessions (Sam plays weekly), approach first. Block types are the drills' own.
const SESSIONS: { title: string; blocks: { drill: string; why: (p: SevenIron) => string }[] }[] = [
  {
    title: 'Iron contact and start line',
    blocks: [
      {
        drill: '7-Iron Calibration Warm-Up',
        why: (p) =>
          `Find where your 7-iron really finishes. On the course it averages ${p.short} yd short of where you aim.`,
      },
      {
        drill: 'Tee-Gate Center-Face',
        why: () =>
          'Strike from the middle of the face. Thin and heavy contact is most of the yardage you lose.',
      },
      {
        drill: 'Ball-First Contact (Towel & Tee)',
        why: () => 'Ball first, then turf, so the iron goes the number you play it for.',
      },
      {
        drill: 'Flagstick Challenge',
        why: (p) =>
          `Start the ball on line and hold it there. Your 7-iron finishes ${p.right} yd right of the aim on a fade.`,
      },
    ],
  },
  {
    title: 'Approach distance control',
    blocks: [
      {
        drill: 'Half-to-Full Iron Tempo Ramp',
        why: () => 'Build up to full speed with the same tempo through the bag.',
      },
      {
        drill: 'Random-Club, New-Target',
        why: () => 'A new club and target every ball, the way approaches come on the course.',
      },
      {
        drill: 'Pressure-Cooker (3-Target Sequence)',
        why: () => 'Three greens in a row before you move on: approach under a little pressure.',
      },
    ],
  },
]

interface SevenIron {
  short: number
  right: number
  shots: number
}

function sevenIron(rounds: Candidate[]): SevenIron {
  const stats = computeDispersionStats(rounds.flatMap((c) => c.seven))
  const advice = stats && aimAdvice(stats)
  if (!stats || advice?.distance !== 'short' || advice.lateral !== 'right') {
    throw new Error('The promo 7-iron no longer reads short and right; retune PLAY or SEED.')
  }
  return {
    short: Math.round(-stats.avgDistanceOffset),
    right: Math.round(stats.avgLateralOffset),
    shots: stats.sampleSize,
  }
}

async function insertPlan(
  supabase: SupabaseClient,
  userId: string,
  rounds: Candidate[],
  index: number,
): Promise<void> {
  const sgs = rounds.map((r) => roundSG(r.holes, index).round)
  const avg = (k: keyof typeof SG_LABELS) => sgs.reduce((s, r) => s + r[k], 0) / sgs.length
  const ranked = (Object.keys(SG_LABELS) as (keyof typeof SG_LABELS)[])
    .map((k) => ({ k, v: avg(k) }))
    .sort((a, b) => a.v - b.v)
  const [worst, next] = [ranked[0]!, ranked[1]!]
  const best = ranked.at(-1)!
  if (worst.k !== 'approach') throw new Error(`Promo rounds lead with ${worst.k}, not approach.`)
  const seven = sevenIron(rounds)

  const names = SESSIONS.flatMap((s) => s.blocks.map((b) => b.drill))
  const { data: drills, error } = await supabase
    .from('drills')
    .select('id, name, drill_type, duration_min')
    .in('name', names)
  if (error) throw error
  const byName = new Map((drills ?? []).map((d) => [d.name, d]))
  const missing = names.filter((n) => !byName.has(n))
  if (missing.length)
    throw new Error(`Promo plan drills missing from this database: ${missing.join(', ')}`)

  const per = (v: number) =>
    `${Math.abs(v).toFixed(1)} strokes ${v < 0 ? 'lost' : 'gained'} a round`
  const { error: planErr } = await supabase.from('practice_plans').insert({
    user_id: userId,
    based_on_rounds: rounds.length,
    valid_until: dateNDaysAgo(-7),
    ai_insight: `${sgFinding({ label: SG_LABELS.approach, value: worst.v }, { label: SG_LABELS[best.k], value: best.v }, 'softest area')}`,
    coach_note: `${SG_LABELS[best.k]} is your strength, so the strokes are in the shot into the green. Your 7-iron finishes about ${seven.short} yd short and ${seven.right} yd right of where you aim over ${seven.shots} shots: contact and start line first, then distance control.`,
    focus_areas: [
      {
        category: PLAN_CATEGORY.approach,
        reason: `Approach is your biggest opportunity, ${per(worst.v)} over your last ${rounds.length} rounds.`,
      },
      {
        category: PLAN_CATEGORY[next.k],
        reason:
          next.v < 0
            ? `${SG_LABELS[next.k]} is next, ${per(next.v)}.`
            : `${SG_LABELS[next.k]} is holding up, ${per(next.v)}; keep it ticking over.`,
      },
    ],
    drills: {
      sessions: SESSIONS.map((s, si) => {
        const blocks = s.blocks.map((b, bi) => {
          const d = byName.get(b.drill)!
          return {
            id: `b-approach-${si}-${bi}`,
            order: bi,
            type: d.drill_type,
            minutes: d.duration_min ?? 15,
            rationale: b.why(seven),
            drill_id: d.id,
            target: null,
          }
        })
        return { title: s.title, total_minutes: blocks.reduce((t, b) => t + b.minutes, 0), blocks }
      }),
    },
    completed_drill_ids: [],
  })
  if (planErr) throw planErr

  console.log(
    `Promo: index ${index}; SG a round over ${rounds.length}: ${ranked.map((r) => `${r.k} ${r.v.toFixed(2)}`).join(', ')}; 7-iron ${seven.short} yd short, ${seven.right} yd right (${seven.shots} shots)`,
  )
}
