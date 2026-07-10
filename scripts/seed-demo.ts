/**
 * Seed a demo user with realistic round / shot / practice-plan data on
 * REAL courses.
 *
 * Idempotent: re-running wipes the demo user's prior rounds / plans / clubs
 * before re-inserting. It never creates or mutates courses or holes — it
 * attaches the demo rounds to real, fully-loaded courses already in the DB
 * (18 holes with tee/pin coordinates + rated tees), so every round renders a
 * scorecard AND a map, the Patterns tab shows real per-course dispersion, and
 * the handicap/tee features have genuine rating/slope to work with.
 *
 * Course selection (selectDemoCourses):
 *   1. Prefer the curated PREFERRED_COURSE_IDS when present (prod) — famous
 *      courses verified to have full hole geometry + rated tees.
 *   2. Otherwise fill dynamically from whatever fully-loaded courses the target
 *      DB has (so `pnpm seed:e2e` against dev still works). Degrades
 *      gracefully: rated+geom → geom-only → any course with enough holes.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (admin) — auth.admin.createUser and
 * bypassing RLS for the inserts both need it. Reads from .env at the repo root.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   pnpm seed:demo
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_BAG } from '@oga/core'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Defaults match the original demo user. Override via env (e.g. for
// the Playwright e2e account against the dev project) — see
// `pnpm seed:e2e` for the full invocation.
const SEED_EMAIL = process.env.SEED_EMAIL ?? 'demo@oga.app'
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ogademo123'
const SEED_USERNAME = process.env.SEED_USERNAME ?? 'demo'

const YARDS_PER_DEG_LAT = 121_000

function yardsPerDegLng(latDeg: number): number {
  return YARDS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180)
}

function offsetCoord(
  base: [number, number],
  yardsNorth: number,
  yardsEast: number,
): { lat: number; lng: number } {
  return {
    lat: base[0] + yardsNorth / YARDS_PER_DEG_LAT,
    lng: base[1] + yardsEast / yardsPerDegLng(base[0]),
  }
}

function dateNDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pickClubForDistance(yards: number): string {
  if (yards >= 230) return 'driver'
  if (yards >= 200) return '3w'
  if (yards >= 180) return '4i'
  if (yards >= 160) return '6i'
  if (yards >= 140) return '7i'
  if (yards >= 120) return '8i'
  if (yards >= 100) return '9i'
  if (yards >= 70) return 'pw'
  if (yards >= 40) return 'gw'
  if (yards >= 20) return 'sw'
  return 'putter'
}

// Typical carry per club (yards). Used to walk a hole realistically: hit the
// club for the distance-to-pin, advance by its carry, repeat — so approaches
// land in iron/wedge ranges instead of every shot picking the same club.
const TYPICAL_CARRY: Record<string, number> = {
  driver: 255,
  '3w': 225,
  '5w': 210,
  '4i': 190,
  '5i': 178,
  '6i': 165,
  '7i': 152,
  '8i': 140,
  '9i': 128,
  pw: 115,
  gw: 95,
  sw: 75,
}

// Per-club dispersion in yards, in the shot's own frame: biasLong (negative =
// tends short, the amateur norm), biasLat (positive = push right), and the
// 1σ spread on each axis. Short clubs are tight; driver is wide with a slice
// bias — so the fitted 68/95 cones look like a real player's, not a blob.
interface Disp {
  biasLong: number
  biasLat: number
  sdLong: number
  sdLat: number
}
const CLUB_DISPERSION: Record<string, Disp> = {
  driver: { biasLong: -3, biasLat: 6, sdLong: 17, sdLat: 19 },
  '3w': { biasLong: -3, biasLat: 4, sdLong: 14, sdLat: 15 },
  '5w': { biasLong: -3, biasLat: 3, sdLong: 13, sdLat: 13 },
  '4i': { biasLong: -4, biasLat: 3, sdLong: 12, sdLat: 12 },
  '5i': { biasLong: -3, biasLat: 2, sdLong: 11, sdLat: 10 },
  '6i': { biasLong: -3, biasLat: 1, sdLong: 9, sdLat: 8 },
  '7i': { biasLong: -3, biasLat: 1, sdLong: 8, sdLat: 7 },
  '8i': { biasLong: -2, biasLat: 0, sdLong: 7, sdLat: 6 },
  '9i': { biasLong: -2, biasLat: 0, sdLong: 6, sdLat: 5 },
  pw: { biasLong: -1, biasLat: 0, sdLong: 5, sdLat: 5 },
  gw: { biasLong: -1, biasLat: 0, sdLong: 5, sdLat: 4 },
  sw: { biasLong: -1, biasLat: 0, sdLong: 5, sdLat: 4 },
}
const DEFAULT_DISP: Disp = { biasLong: -2, biasLat: 0, sdLong: 9, sdLat: 8 }

// Box–Muller normal sample, scaled to sd. Sums of uniforms would peak too
// flat; a real Gaussian gives the dense centre + sparse tails a cone wants.
function gaussian(sd: number): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd
}

function distanceYards(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const north = (b.lat - a.lat) * YARDS_PER_DEG_LAT
  const east = (b.lng - a.lng) * yardsPerDegLng(a.lat)
  return Math.hypot(north, east)
}

// A point `dist` yards from `from` along the line toward `toward`.
function stepToward(
  from: { lat: number; lng: number },
  toward: { lat: number; lng: number },
  dist: number,
): { lat: number; lng: number } {
  const north = (toward.lat - from.lat) * YARDS_PER_DEG_LAT
  const east = (toward.lng - from.lng) * yardsPerDegLng(from.lat)
  const mag = Math.hypot(north, east) || 1
  return offsetCoord([from.lat, from.lng], (north / mag) * dist, (east / mag) * dist)
}

// Land the ball offLong yards along the start→aim line and offLat yards
// perpendicular (right = +), so the miss is oriented to the actual shot
// bearing — what computeDispersion rotates back out when fitting the cone.
function dispersedEnd(
  start: { lat: number; lng: number },
  aim: { lat: number; lng: number },
  offLong: number,
  offLat: number,
): { lat: number; lng: number } {
  const north = (aim.lat - start.lat) * YARDS_PER_DEG_LAT
  const east = (aim.lng - start.lng) * yardsPerDegLng(start.lat)
  const mag = Math.hypot(north, east) || 1
  const un = north / mag
  const ue = east / mag
  // perpendicular unit (90° clockwise = player's right)
  const pn = -ue
  const pe = un
  const dn = offLong * un + offLat * pn
  const de = offLong * ue + offLat * pe
  return offsetCoord([aim.lat, aim.lng], dn, de)
}

async function ensureDemoUser(): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find((u) => u.email === SEED_EMAIL)
  if (existing) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { username: SEED_USERNAME },
  })
  if (error || !data.user) throw error ?? new Error('createUser returned no user')
  return data.user.id
}

async function ensureProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username: SEED_USERNAME,
      handicap_index: 12.4,
      skill_level: 'developing',
      goal: 'break_80',
      play_frequency: 'weekly',
      facilities: ['range', 'short_game', 'putting'],
      play_style: 'mixed',
      // Added in migration 0023; the script pre-dates it. Without
      // this, ProfileGuard would bounce the seeded user to
      // /onboarding on next sign-in.
      onboarding_completed: true,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function wipeDemoData(userId: string): Promise<void> {
  // hole_scores + shots cascade off rounds. We only ever touch the demo
  // user's own rows — courses/holes are real, shared data and must never be
  // deleted here.
  const { error: roundsErr } = await supabase.from('rounds').delete().eq('user_id', userId)
  if (roundsErr) throw roundsErr
  const { error: planErr } = await supabase.from('practice_plans').delete().eq('user_id', userId)
  if (planErr) throw planErr
  const { error: clubsErr } = await supabase.from('user_clubs').delete().eq('user_id', userId)
  if (clubsErr) throw clubsErr
}

async function seedBag(userId: string): Promise<void> {
  const rows = DEFAULT_BAG.map((c) => ({
    user_id: userId,
    club_type: c.club_type,
    name: c.name,
    sort_order: c.sort_order,
    in_bag: true,
  }))
  const { error } = await supabase.from('user_clubs').insert(rows)
  if (error) throw error
}

// --- Real-course selection ----------------------------------------------

// Curated, verified-complete real courses (prod): 18 holes with tee+pin
// coordinates AND rated tees with rating/slope. Resolved by id; absent on dev,
// where selectDemoCourses falls back to a dynamic pick.
const PREFERRED_COURSE_IDS = [
  '0993ec94-50c9-4f30-8154-63382286a29e', // Whistling Straits — Sheboygan, WI
  '4f5efecb-6117-439f-a8ee-5949622d4732', // Harbour Town Golf Links — Hilton Head Island, SC
  '6cc6f3a5-c26f-4222-a375-8101e98f54f9', // Erin Hills — Erin, WI
]
const TARGET_COURSES = 3

interface HoleRow {
  id: string
  number: number
  par: number
  teeLat: number | null
  teeLng: number | null
  pinLat: number | null
  pinLng: number | null
}

interface DemoCourse {
  id: string
  name: string
  holes: HoleRow[]
  // Real rated tee colours (rounds pick from these so the tee/handicap
  // features show genuine data); empty when the course has no rated tees.
  teeColors: string[]
}

function hasGeom(h: HoleRow): boolean {
  return h.teeLat != null && h.teeLng != null && h.pinLat != null && h.pinLng != null
}

// Load a course and validate it for the demo. Returns null unless it has at
// least 18 distinct holes (1..18). With requireGeom, all 18 must carry tee+pin
// coordinates (needed for the map + shot dispersion).
async function loadCourse(id: string, requireGeom: boolean): Promise<DemoCourse | null> {
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (courseErr) throw courseErr
  if (!course) return null

  const { data: holeRows, error: holesErr } = await supabase
    .from('holes')
    .select('id, number, par, tee_lat, tee_lng, pin_lat, pin_lng')
    .eq('course_id', id)
    .order('number', { ascending: true })
  // Throw on a real error — silently treating a transient failure as
  // "no holes" would drop a curated course and mask the cause.
  if (holesErr) throw holesErr
  if (!holeRows || holeRows.length < 18) return null

  // Dedupe by hole number, keep 1..18 in order.
  const byNumber = new Map<number, HoleRow>()
  for (const h of holeRows) {
    if (h.number < 1 || h.number > 18 || byNumber.has(h.number)) continue
    byNumber.set(h.number, {
      id: h.id,
      number: h.number,
      par: h.par,
      teeLat: h.tee_lat,
      teeLng: h.tee_lng,
      pinLat: h.pin_lat,
      pinLng: h.pin_lng,
    })
  }
  const holes = [...byNumber.values()].sort((a, b) => a.number - b.number)
  if (holes.length < 18) return null
  if (requireGeom && holes.some((h) => !hasGeom(h))) return null

  const { data: tees, error: teesErr } = await supabase
    .from('course_tees')
    .select('tee_color')
    .eq('course_id', id)
    .not('course_rating', 'is', null)
    .not('slope_rating', 'is', null)
  if (teesErr) throw teesErr
  const teeColors = [...new Set((tees ?? []).map((t) => t.tee_color))]

  return { id: course.id, name: course.name, holes, teeColors }
}

// Page the holes table, grouping by course to find ids with >= `min` holes that
// (optionally) carry pin geometry. Bounded so it can't run away on prod.
async function courseIdsWithHoles(needGeom: boolean, min: number): Promise<string[]> {
  const counts = new Map<string, number>()
  const page = 1000
  const maxPages = 60
  for (let p = 0; p < maxPages; p++) {
    let q = supabase
      .from('holes')
      .select('course_id, pin_lat')
      .order('course_id', { ascending: true })
      .range(p * page, p * page + page - 1)
    if (needGeom) q = q.not('pin_lat', 'is', null)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    for (const h of data) counts.set(h.course_id, (counts.get(h.course_id) ?? 0) + 1)
    if (data.length < page) break
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= min)
    .map(([id]) => id)
    .sort()
}

// Resolve the demo courses for whichever DB we're pointed at.
async function selectDemoCourses(): Promise<DemoCourse[]> {
  const chosen: DemoCourse[] = []
  const taken = new Set<string>()

  // 1. Curated real courses (prod).
  for (const id of PREFERRED_COURSE_IDS) {
    if (chosen.length >= TARGET_COURSES) break
    const c = await loadCourse(id, true)
    if (c) {
      chosen.push(c)
      taken.add(c.id)
    }
  }
  if (chosen.length >= TARGET_COURSES) return chosen

  // 2. Dynamic fill: fully-loaded courses (18 holes WITH pin geometry).
  for (const id of await courseIdsWithHoles(true, 18)) {
    if (chosen.length >= TARGET_COURSES) break
    if (taken.has(id)) continue
    const c = await loadCourse(id, true)
    if (c) {
      chosen.push(c)
      taken.add(c.id)
    }
  }
  if (chosen.length >= TARGET_COURSES) return chosen

  // 3. Last resort (keeps e2e alive on sparse DBs): any course with 18 holes,
  //    geometry optional — those rounds render a scorecard but no map/shots.
  for (const id of await courseIdsWithHoles(false, 18)) {
    if (chosen.length >= TARGET_COURSES) break
    if (taken.has(id)) continue
    const c = await loadCourse(id, false)
    if (c) {
      chosen.push(c)
      taken.add(c.id)
    }
  }

  if (chosen.length === 0) {
    throw new Error('No course with 18 holes found in this database — cannot seed demo rounds.')
  }
  return chosen
}

// --- Round archetypes ----------------------------------------------------

interface Archetype {
  tee: [number, number]
  app: [number, number]
  arnd: [number, number]
  putt: [number, number]
  // Strokes over par for the round (drives the per-hole score generation).
  over: [number, number]
}

// Distinct SG stories so the Stats page varies round to round instead of
// telling the same weak-approach / strong-putting tale every time.
const ARCHETYPES: Record<string, Archetype> = {
  solid: { tee: [-0.2, 0.6], app: [0.2, 1.0], arnd: [0.0, 0.4], putt: [0.1, 0.7], over: [6, 10] },
  bomber: {
    tee: [0.7, 1.5],
    app: [-0.5, 0.2],
    arnd: [-0.3, 0.2],
    putt: [-0.4, 0.3],
    over: [10, 15],
  },
  putt_cost: {
    tee: [-0.2, 0.5],
    app: [-0.2, 0.5],
    arnd: [-0.2, 0.3],
    putt: [-1.9, -0.9],
    over: [13, 18],
  },
  offtee_cost: {
    tee: [-1.9, -0.9],
    app: [-0.2, 0.4],
    arnd: [-0.2, 0.3],
    putt: [0.0, 0.6],
    over: [14, 19],
  },
  approach_cost: {
    tee: [-0.2, 0.4],
    app: [-1.9, -0.9],
    arnd: [-0.3, 0.2],
    putt: [0.0, 0.6],
    over: [14, 19],
  },
  blowup: {
    tee: [-1.4, -0.5],
    app: [-2.0, -1.0],
    arnd: [-1.2, -0.4],
    putt: [-1.0, -0.3],
    over: [22, 30],
  },
  middling: {
    tee: [-0.5, 0.3],
    app: [-0.7, 0.2],
    arnd: [-0.4, 0.3],
    putt: [-0.4, 0.4],
    over: [11, 16],
  },
}

// 15-round mix: mostly middling with a couple of each story. The first 7 (the
// ones that get full shot data) cover the widest archetype spread so the
// Patterns tab sees varied clubs and misses.
const ROUND_PLAN = [
  'solid',
  'middling',
  'putt_cost',
  'approach_cost',
  'bomber',
  'middling',
  'blowup',
  'solid',
  'offtee_cost',
  'middling',
  'approach_cost',
  'putt_cost',
  'solid',
  'middling',
  'bomber',
]
const ROUNDS_WITH_SHOTS = 7
const FALLBACK_TEE_COLORS = ['white', 'blue', 'gold']

interface RoundProfile {
  sgOffTee: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
}

function sampleProfile(a: Archetype): RoundProfile {
  return {
    sgOffTee: rand(a.tee[0], a.tee[1]),
    sgApproach: rand(a.app[0], a.app[1]),
    sgAroundGreen: rand(a.arnd[0], a.arnd[1]),
    sgPutting: rand(a.putt[0], a.putt[1]),
  }
}

// Score on a hole: par + a Gaussian delta centred on the round's per-hole
// difficulty. Floor at one under par (so a par-3 can't go below 2), cap at
// quad. Sum of these IS the round total — scorecard Total stays correct.
function genHoleScore(par: number, meanDelta: number): number {
  let d = Math.round(meanDelta + gaussian(1.1))
  d = Math.max(-1, Math.min(4, d))
  return Math.max(1, par + d)
}

function samplePutts(score: number): number {
  let p = 2
  const r = Math.random()
  if (r < 0.22) p = 1
  else if (r > 0.82) p = 3
  return Math.min(p, Math.max(1, score - 1))
}

async function insertRound(
  userId: string,
  course: DemoCourse,
  daysAgo: number,
  withShots: boolean,
  archetype: Archetype,
  teeColor: string,
): Promise<void> {
  const profile = sampleProfile(archetype)
  const sgTotal = profile.sgOffTee + profile.sgApproach + profile.sgAroundGreen + profile.sgPutting
  const meanDelta = rand(archetype.over[0], archetype.over[1]) / course.holes.length

  // Generate every hole's score + putts up front so round totals are the
  // exact sum of the scorecard — no drift between rounds.total_score and the
  // hole_scores the scorecard renders.
  const perHole = course.holes.map((h) => {
    const score = genHoleScore(h.par, meanDelta)
    const putts = samplePutts(score)
    const fairwayHit = h.par > 3 ? Math.random() < 0.58 : null
    const gir = score - putts <= h.par - 2
    return { hole: h, score, putts, fairwayHit, gir }
  })

  const totalScore = perHole.reduce((s, p) => s + p.score, 0)
  const totalPutts = perHole.reduce((s, p) => s + p.putts, 0)
  const fairwaysTotal = course.holes.filter((h) => h.par > 3).length
  const fairwaysHit = perHole.filter((p) => p.fairwayHit === true).length
  const girTotal = perHole.filter((p) => p.gir).length

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      user_id: userId,
      course_id: course.id,
      played_at: dateNDaysAgo(daysAgo),
      tee_color: teeColor,
      total_score: totalScore,
      total_putts: totalPutts,
      fairways_hit: fairwaysHit,
      fairways_total: fairwaysTotal,
      gir: girTotal,
      sg_off_tee: round2(profile.sgOffTee),
      sg_approach: round2(profile.sgApproach),
      sg_around_green: round2(profile.sgAroundGreen),
      sg_putting: round2(profile.sgPutting),
      sg_total: round2(sgTotal),
    })
    .select('id')
    .single()
  if (roundError || !round) throw roundError ?? new Error('round insert failed')

  // Every round gets hole_scores for all 18 holes (even scorecard-only ones)
  // so the scorecard always renders against the real holes rows.
  for (const p of perHole) {
    const { data: hs, error: hsError } = await supabase
      .from('hole_scores')
      .insert({
        round_id: round.id,
        hole_id: p.hole.id,
        score: p.score,
        putts: p.putts,
        fairway_hit: p.fairwayHit,
        gir: p.gir,
      })
      .select('id')
      .single()
    if (hsError || !hs) throw hsError ?? new Error('hole_score insert failed')

    // Shots need real tee+pin coordinates to anchor dispersion to the hole.
    if (withShots && hasGeom(p.hole)) await insertHoleShots(userId, hs.id, p.hole, p.score)
  }
}

async function insertHoleShots(
  userId: string,
  holeScoreId: string,
  hole: HoleRow,
  totalShots: number,
): Promise<void> {
  const teeBase = { lat: hole.teeLat!, lng: hole.teeLng! }
  const pinBase = { lat: hole.pinLat!, lng: hole.pinLng! }

  let lastEnd = teeBase
  for (let n = 1; n <= totalShots; n++) {
    const isLast = n === totalShots
    const lieSlope = ['level', 'uphill', 'downhill', 'ball_above', 'ball_below'][
      Math.floor(rand(0, 5))
    ]

    if (isLast) {
      // Holed putt on the green.
      const { error } = await supabase.from('shots').insert({
        hole_score_id: holeScoreId,
        user_id: userId,
        shot_number: n,
        start_lat: lastEnd.lat,
        start_lng: lastEnd.lng,
        aim_lat: pinBase.lat,
        aim_lng: pinBase.lng,
        end_lat: pinBase.lat,
        end_lng: pinBase.lng,
        distance_to_target: null,
        club: 'putter',
        lie_type: 'green',
        lie_slope: lieSlope,
        shot_result: null,
        penalty: false,
        ob: false,
        putt_distance_ft: Math.round(rand(2, 22) * 10) / 10,
        putt_result: 'made',
      })
      if (error) throw error
      lastEnd = pinBase
      continue
    }

    const lieType = n === 1 ? 'tee' : Math.random() < 0.68 ? 'fairway' : 'rough'
    // Club is chosen for the distance still to the pin; the ball advances by
    // the club's typical carry (or reaches the pin, whichever is shorter).
    const distToPin = Math.max(8, Math.round(distanceYards(lastEnd, pinBase)))
    const club = pickClubForDistance(distToPin)
    const carry = TYPICAL_CARRY[club] ?? distToPin
    const aim = stepToward(lastEnd, pinBase, Math.min(carry, distToPin))
    const disp = CLUB_DISPERSION[club] ?? DEFAULT_DISP
    const offLong = disp.biasLong + gaussian(disp.sdLong)
    const offLat = disp.biasLat + gaussian(disp.sdLat)
    const end = dispersedEnd(lastEnd, aim, offLong, offLat)
    // Result follows the actual miss so result-based stats stay consistent.
    const result =
      offLat > 9
        ? 'push_right'
        : offLat < -9
          ? 'pull_left'
          : offLong < -11
            ? 'fat'
            : Math.random() < 0.18
              ? 'thin'
              : 'solid'

    const { error } = await supabase.from('shots').insert({
      hole_score_id: holeScoreId,
      user_id: userId,
      shot_number: n,
      start_lat: lastEnd.lat,
      start_lng: lastEnd.lng,
      aim_lat: aim.lat,
      aim_lng: aim.lng,
      end_lat: end.lat,
      end_lng: end.lng,
      distance_to_target: distToPin,
      club,
      lie_type: lieType,
      lie_slope: lieSlope,
      shot_result: result,
      penalty: false,
      ob: false,
      putt_distance_ft: null,
      putt_result: null,
    })
    if (error) throw error
    lastEnd = end
  }
}

async function insertPracticePlan(userId: string): Promise<void> {
  const { data: drills } = await supabase
    .from('drills')
    .select('id, name, description, duration_min, category, facility')
    .eq('category', 'approach')
    .limit(3)
  if (!drills || drills.length === 0) return

  // Match the live storage shape (@oga/core StoredFocusArea / StoredSession):
  // focus_areas use `reason` (not insight/sgValue) and `drills` is
  // `{ sessions: [{ blocks }] }`. The Practice UI reads exactly these fields,
  // so an out-of-date shape crashes the tab — keep this in lockstep.
  const blockTypes = ['warmup', 'blocked', 'skill_game'] as const
  await supabase.from('practice_plans').insert({
    user_id: userId,
    based_on_rounds: 10,
    valid_until: dateNDaysAgo(-7),
    focus_areas: [
      {
        category: 'approach',
        reason: 'Approach is your biggest opportunity — averaging 1.2 strokes lost per round.',
      },
      {
        category: 'around_green',
        reason: 'Around-green play is roughly neutral; one drill keeps it sharp.',
      },
    ],
    drills: {
      sessions: [
        {
          title: 'Approach accuracy block',
          total_minutes: drills.reduce((sum, d) => sum + (d.duration_min ?? 15), 0),
          blocks: drills.map((d, i) => ({
            id: `b-approach-${i}`,
            order: i,
            type: blockTypes[Math.min(i, blockTypes.length - 1)],
            minutes: d.duration_min ?? 15,
            // Real per-drill copy so a seeded plan reads like a generated
            // one — the flat placeholder here was #606's App Review risk.
            rationale: d.description ?? 'Targets the lowest SG category.',
            drill_id: d.id,
            target: null,
          })),
        },
      ],
    },
    ai_insight: 'Approach is the biggest drag on scoring — tighten iron dispersion this week.',
    coach_note:
      'Your approach game is the primary leak right now. Blocked reps to groove contact, then a skill game to transfer it under a little pressure.',
    completed_drill_ids: [],
  })
}

// Pick a tee colour for a round: cycle the course's real rated tees so the
// tee/handicap features show genuine data; fall back to plausible defaults
// when a course has no rated tees.
function pickTeeColor(course: DemoCourse, visit: number): string {
  const colors = course.teeColors.length > 0 ? course.teeColors : FALLBACK_TEE_COLORS
  return colors[visit % colors.length]!
}

async function main() {
  console.log(`Seeding demo data into ${URL}`)

  const userId = await ensureDemoUser()
  await ensureProfile(userId)
  await wipeDemoData(userId)
  await seedBag(userId)

  const courses = await selectDemoCourses()
  console.log(
    `Demo courses (${courses.length}): ${courses
      .map((c) => `${c.name} [${c.teeColors.length} tees]`)
      .join(', ')}`,
  )

  for (let i = 0; i < ROUND_PLAN.length; i++) {
    const archetype = ARCHETYPES[ROUND_PLAN[i]!]!
    const course = courses[i % courses.length]!
    // nth visit to THIS course (courses are assigned round-robin), so its
    // tees actually rotate instead of the global index landing on the same
    // one every time.
    const visit = Math.floor(i / courses.length)
    await insertRound(
      userId,
      course,
      i * 4 + 2,
      i < ROUNDS_WITH_SHOTS,
      archetype,
      pickTeeColor(course, visit),
    )
    process.stdout.write('.')
  }
  process.stdout.write('\n')

  await insertPracticePlan(userId)

  console.log(`Seed user ready — sign in as ${SEED_EMAIL} / ${SEED_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
