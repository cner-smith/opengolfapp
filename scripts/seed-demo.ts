/**
 * Seed a demo user with realistic round / shot / practice-plan data.
 *
 * Idempotent: re-running wipes the demo user's prior rounds + plans
 * before re-inserting, so it's safe to run after migrations or schema
 * changes.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (admin) — auth.admin.createUser
 * and bypassing RLS for the inserts both need it. Reads from .env at
 * the repo root.
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

// Course base coords (no real geometry on the seeded courses, so we
// synthesize plausible lat/lng for shot dispersion).
const COURSE_BASE: [number, number] = [40.05, -75.4]
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
  // hole_scores + shots cascade off rounds
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

interface CourseRow {
  id: string
  name: string
}
interface HoleRow {
  id: string
  number: number
  par: number
  yards: number | null
}

async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase.from('courses').select('id, name').limit(3)
  if (error) throw error
  return data ?? []
}

async function fetchHolesByCourse(): Promise<Map<string, HoleRow[]>> {
  const { data, error } = await supabase.from('holes').select('id, number, par, yards, course_id')
  if (error) throw error
  const map = new Map<string, HoleRow[]>()
  for (const row of data ?? []) {
    const list = map.get(row.course_id) ?? []
    list.push({ id: row.id, number: row.number, par: row.par, yards: row.yards })
    map.set(row.course_id, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.number - b.number)
  return map
}

interface RoundProfile {
  sgOffTee: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
}

function pickRoundProfile(): RoundProfile {
  return {
    sgOffTee: rand(-0.4, 0.4),
    sgApproach: rand(-1.6, -0.8),
    sgAroundGreen: rand(-0.3, 0.3),
    sgPutting: rand(0.8, 1.4),
  }
}

async function insertRound(
  userId: string,
  course: CourseRow,
  holes: HoleRow[],
  daysAgo: number,
  withShots: boolean,
): Promise<void> {
  const profile = pickRoundProfile()
  const sgTotal = profile.sgOffTee + profile.sgApproach + profile.sgAroundGreen + profile.sgPutting
  const par = holes.reduce((s, h) => s + h.par, 0)
  // Score correlates roughly with sgTotal: better SG → fewer strokes.
  const score = Math.round(par - sgTotal + rand(-1, 1))

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      user_id: userId,
      course_id: course.id,
      played_at: dateNDaysAgo(daysAgo),
      tee_color: 'white',
      total_score: score,
      total_putts: 30 + Math.round(rand(-3, 5)),
      fairways_hit: 7 + Math.round(rand(-2, 3)),
      fairways_total: 14,
      gir: 8 + Math.round(rand(-3, 4)),
      sg_off_tee: round2(profile.sgOffTee),
      sg_approach: round2(profile.sgApproach),
      sg_around_green: round2(profile.sgAroundGreen),
      sg_putting: round2(profile.sgPutting),
      sg_total: round2(sgTotal),
    })
    .select('id')
    .single()
  if (roundError || !round) throw roundError ?? new Error('round insert failed')

  if (!withShots) return

  // Insert hole_scores + shots for the first round of each demo course.
  for (const hole of holes) {
    const holeScore = Math.max(2, hole.par + Math.round(rand(-1, 2)))
    const { data: hs, error: hsError } = await supabase
      .from('hole_scores')
      .insert({
        round_id: round.id,
        hole_id: hole.id,
        score: holeScore,
        putts: Math.min(holeScore - 1, 1 + Math.round(rand(0, 2))),
        fairway_hit: hole.par > 3 ? Math.random() > 0.45 : null,
        gir: Math.random() > 0.5,
      })
      .select('id')
      .single()
    if (hsError || !hs) throw hsError ?? new Error('hole_score insert failed')

    await insertHoleShots(userId, hs.id, hole, holeScore)
  }
}

async function insertHoleShots(
  userId: string,
  holeScoreId: string,
  hole: HoleRow,
  totalShots: number,
): Promise<void> {
  const teeBase = offsetCoord(COURSE_BASE, hole.number * 250, 0)
  const pinBase = offsetCoord(
    [teeBase.lat, teeBase.lng],
    hole.yards ?? hole.par * 100,
    rand(-15, 15),
  )

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

  await supabase.from('practice_plans').insert({
    user_id: userId,
    based_on_rounds: 10,
    valid_until: dateNDaysAgo(-7),
    focus_areas: [
      {
        category: 'approach',
        priority: 1,
        sgValue: -1.2,
        insight: 'Approach is your biggest opportunity — average 1.2 strokes lost per round.',
      },
      {
        category: 'around_green',
        priority: 2,
        sgValue: -0.1,
        insight: 'Around-green play is roughly neutral; maintain with one drill.',
      },
    ],
    drills: drills.map((d) => ({
      drillId: d.id,
      name: d.name,
      durationMin: d.duration_min,
      facility: Array.isArray(d.facility) ? d.facility.join(', ') : '',
      category: d.category,
      description: d.description,
      reason: 'Targets the lowest SG category.',
    })),
    ai_insight:
      "Demo plan: putting is a real strength (+1.2 SG) so we're protecting it with one drill while loading up on approach work to chip away at the -1.2 SG gap.",
    completed_drill_ids: [],
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function main() {
  console.log(`Seeding demo data into ${URL}`)

  const userId = await ensureDemoUser()
  await ensureProfile(userId)
  await wipeDemoData(userId)
  await seedBag(userId)

  const courses = await fetchCourses()
  if (courses.length < 3) {
    throw new Error('Demo seed needs 3 courses in the database — run `npx supabase db reset` first')
  }
  const holesByCourse = await fetchHolesByCourse()

  const TOTAL_ROUNDS = 15
  // More shot-rounds → each club clears the 5-shot floor the dispersion fit
  // needs, so /patterns shows a real cone for the common clubs.
  const ROUNDS_WITH_SHOTS = 8

  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const course = courses[i % courses.length]!
    const holes = holesByCourse.get(course.id) ?? []
    if (holes.length === 0) continue
    await insertRound(userId, course, holes, i * 6 + 2, i < ROUNDS_WITH_SHOTS)
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
