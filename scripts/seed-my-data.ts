/**
 * Seed realistic 6-month round history onto an existing user account.
 *
 * Idempotent: if the target user already has ≥15 rounds, the script
 * exits without touching anything. Otherwise it tops up to 15.
 *
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   SEED_USER_EMAIL=cner.smith@gmail.com pnpm seed:my-data
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env at the repo
 * root via `dotenv/config`.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.SEED_USER_EMAIL

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}
if (!EMAIL) {
  console.error('SEED_USER_EMAIL is required, e.g. SEED_USER_EMAIL=you@example.com pnpm seed:my-data')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TARGET_ROUNDS = 15
const ROUNDS_WITH_SHOTS = 5

// OKC area (Lake Hefner-ish). Each course gets a small offset so they
// don't all sit on the same point.
const OKC_BASE: [number, number] = [35.46, -97.51]
const COURSE_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.04, -0.05],
  [-0.05, 0.06],
]
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

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]!
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function dateNDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// User + course lookup
// ---------------------------------------------------------------------------

async function findUserId(email: string): Promise<string> {
  // listUsers paginates; loop until we find or exhaust.
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit.id
    if (data.users.length < 200) break
    page += 1
  }
  throw new Error(`No auth.users row for ${email}`)
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

async function fetchSeedCourses(): Promise<CourseRow[]> {
  const wanted = ['Lakeside National', 'Old Mill Links', 'Pine Ridge Golf Club']
  const { data, error } = await supabase
    .from('courses')
    .select('id, name')
    .in('name', wanted)
  if (error) throw error
  if (!data || data.length < 3) {
    throw new Error(
      `Expected 3 seeded courses (${wanted.join(', ')}); found ${data?.length ?? 0}.`,
    )
  }
  // Stable order so a given run picks the same course rotation.
  return wanted
    .map((n) => data.find((d) => d.name === n))
    .filter((c): c is CourseRow => !!c)
}

async function fetchHolesByCourse(courseIds: string[]): Promise<Map<string, HoleRow[]>> {
  const { data, error } = await supabase
    .from('holes')
    .select('id, number, par, yards, course_id')
    .in('course_id', courseIds)
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

async function existingRoundCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Round / hole_score / shot generators
// ---------------------------------------------------------------------------

interface RoundProfile {
  totalScore: number
  totalPutts: number
  fairwaysHit: number
  gir: number
  sgOffTee: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
}

function pickRoundProfile(): RoundProfile {
  // 8-12 handicap profile per spec.
  return {
    totalScore: Math.round(rand(71, 82)),
    totalPutts: Math.round(rand(28, 34)),
    fairwaysHit: Math.round(rand(7, 11)),
    gir: Math.round(rand(8, 13)),
    sgOffTee: rand(-0.2, 0.8),
    sgApproach: rand(-1.6, -0.8),
    sgAroundGreen: rand(-0.4, 0.2),
    sgPutting: rand(0.8, 1.4),
  }
}

interface HoleScoreInsert {
  round_id: string
  hole_id: string
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
}

// Walks a target round score across 18 holes, biased toward par with a
// realistic mix of pars/bogeys + occasional birdie or double.
function buildHoleScores(
  roundId: string,
  holes: HoleRow[],
  targetScore: number,
  girCount: number,
  fairwaysHit: number,
): HoleScoreInsert[] {
  const par = holes.reduce((s, h) => s + h.par, 0)
  let toAllocate = targetScore - par // strokes over par to spend
  const par4or5Holes = holes.filter((h) => h.par >= 4)
  // Choose which non-par-3 holes hit the fairway.
  const fairwayHitIds = new Set<string>()
  const par4or5Ids = par4or5Holes.map((h) => h.id)
  while (fairwayHitIds.size < Math.min(fairwaysHit, par4or5Ids.length)) {
    fairwayHitIds.add(par4or5Ids[Math.floor(Math.random() * par4or5Ids.length)]!)
  }

  // Allocate GIR holes evenly across all 18.
  const girIds = new Set<string>()
  while (girIds.size < Math.min(girCount, holes.length)) {
    girIds.add(holes[Math.floor(Math.random() * holes.length)]!.id)
  }

  const rows: HoleScoreInsert[] = []
  for (const hole of holes) {
    let delta: number
    // Bias the over/under-par distribution by remaining strokes.
    const r = Math.random()
    if (toAllocate >= 4) {
      // Plenty over par: weight toward bogey/double.
      delta = r < 0.55 ? 1 : r < 0.85 ? 2 : 0
    } else if (toAllocate <= -1) {
      // Already at/under par: stick to par or birdie.
      delta = r < 0.7 ? 0 : -1
    } else {
      // In the zone: par-ish.
      delta = r < 0.55 ? 0 : r < 0.85 ? 1 : r < 0.93 ? -1 : 2
    }
    delta = Math.max(delta, -1) // no eagles in this profile
    const score = Math.max(2, hole.par + delta)
    toAllocate -= delta

    // Putts: 1 if chip-in territory, 2 most often, 3 occasionally.
    const puttRoll = Math.random()
    const putts = puttRoll < 0.1 ? 1 : puttRoll < 0.85 ? 2 : 3
    rows.push({
      round_id: roundId,
      hole_id: hole.id,
      score,
      putts: Math.min(putts, score - 1),
      fairway_hit: hole.par > 3 ? fairwayHitIds.has(hole.id) : null,
      gir: girIds.has(hole.id),
    })
  }
  // Final adjust: if our running tally drifted from target, nudge the last
  // par-4/5 hole's score by the diff (capped) so the totals still match.
  const computed = rows.reduce((s, r) => s + r.score, 0)
  let drift = targetScore - computed
  for (let i = rows.length - 1; i >= 0 && drift !== 0; i--) {
    const row = rows[i]!
    const hole = holes[i]!
    if (hole.par <= 3) continue
    const adj = Math.max(-2, Math.min(2, drift))
    const newScore = Math.max(2, row.score + adj)
    drift -= newScore - row.score
    row.score = newScore
    row.putts = Math.min(row.putts, row.score - 1)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Shot generation with deliberate miss patterns.
// ---------------------------------------------------------------------------

const FORWARD_SLOPES = ['uphill', 'level', 'level', 'level', 'downhill'] as const
const SIDE_SLOPES = [null, null, null, 'ball_above', 'ball_below'] as const

interface PinForHole {
  pinLat: number
  pinLng: number
  teeLat: number
  teeLng: number
}

function holeGeometry(courseBase: [number, number], hole: HoleRow): PinForHole {
  const tee = offsetCoord(courseBase, hole.number * 280, 0)
  const yardsToPin = hole.yards ?? hole.par * 100
  const pin = offsetCoord(
    [tee.lat, tee.lng],
    yardsToPin,
    rand(-15, 15),
  )
  return { teeLat: tee.lat, teeLng: tee.lng, pinLat: pin.lat, pinLng: pin.lng }
}

function pickClubForApproach(yards: number): string {
  if (yards >= 200) return '4i'
  if (yards >= 175) return '5i'
  if (yards >= 155) return '7i'
  if (yards >= 135) return '8i'
  if (yards >= 115) return '9i'
  if (yards >= 90) return 'pw'
  if (yards >= 60) return 'gw'
  return 'sw'
}

interface ShotInsert {
  hole_score_id: string
  user_id: string
  shot_number: number
  start_lat: number | null
  start_lng: number | null
  aim_lat: number | null
  aim_lng: number | null
  end_lat: number | null
  end_lng: number | null
  distance_to_target: number | null
  club: string | null
  lie_type: string | null
  lie_slope: null
  lie_slope_forward: string | null
  lie_slope_side: string | null
  shot_result: string | null
  penalty: boolean
  ob: boolean
  putt_distance_ft: number | null
  putt_result: string | null
}

function buildShotsForHole(
  userId: string,
  holeScoreId: string,
  hole: HoleRow,
  totalShots: number,
  geom: PinForHole,
): ShotInsert[] {
  const shots: ShotInsert[] = []
  let lastEnd = { lat: geom.teeLat, lng: geom.teeLng }
  const isPar3 = hole.par === 3
  const shotsBeforeGreen = Math.max(1, totalShots - Math.min(2, Math.max(1, totalShots - 1)))
  const remainingPerShot = (hole.yards ?? 200) / Math.max(1, shotsBeforeGreen)

  for (let n = 1; n <= totalShots; n++) {
    const isLast = n === totalShots
    // First shot off the tee on par 4/5; on par 3 the tee shot is the approach.
    const isTeeShot = n === 1
    const isDriveOnPar4or5 = isTeeShot && !isPar3 && hole.par >= 4

    // Decide lie before approach based on previous shot result.
    const lieType: 'tee' | 'fairway' | 'rough' | 'sand' | 'green' = isTeeShot
      ? 'tee'
      : isLast
        ? 'green'
        : Math.random() < 0.7
          ? 'fairway'
          : 'rough'

    const remainingYards = isLast
      ? 0
      : Math.max(20, (hole.yards ?? 200) - remainingPerShot * (n - 1))

    // Pick club + intended pattern.
    let club: string
    let lateralBiasYards = 0 // signed; +right
    let distanceBiasYards = 0
    let resultPool: readonly string[] = ['solid', 'solid', 'push_right', 'pull_left']
    if (isDriveOnPar4or5) {
      club = 'driver'
      lateralBiasYards = 6 // slight fade — average end ~6 yd right of aim
      distanceBiasYards = -3
      resultPool = ['solid', 'solid', 'solid', 'push_right', 'fat']
    } else if (isLast) {
      club = 'putter'
    } else {
      club = pickClubForApproach(remainingYards)
      if (club === '7i') {
        // Push-right tendency for the marquee club.
        lateralBiasYards = 8
        resultPool = ['solid', 'push_right', 'push_right', 'thin', 'fat']
      } else if (club.endsWith('i')) {
        lateralBiasYards = 4
        resultPool = ['solid', 'push_right', 'pull_left', 'thin']
      } else {
        lateralBiasYards = 1
        resultPool = ['solid', 'solid', 'fat', 'pull_left']
      }
    }

    // Aim: pin for last shot, otherwise ~80% of remaining toward the pin.
    const aim = isLast
      ? { lat: geom.pinLat, lng: geom.pinLng }
      : offsetCoord([lastEnd.lat, lastEnd.lng], remainingYards * 0.8, rand(-8, 8))

    // End: aim + bias + dispersion.
    const lateralDispersion = club === 'driver' ? rand(-12, 12) : rand(-7, 7)
    const distanceDispersion = club === 'driver' ? rand(-10, 10) : rand(-6, 6)
    const end = isLast
      ? { lat: geom.pinLat, lng: geom.pinLng }
      : offsetCoord(
          [aim.lat, aim.lng],
          distanceBiasYards + distanceDispersion,
          lateralBiasYards + lateralDispersion,
        )

    // Putting: distances inside 8 ft are mostly made.
    let puttDistanceFt: number | null = null
    let puttResult: string | null = null
    if (lieType === 'green' || club === 'putter') {
      puttDistanceFt = round2(rand(2, 22))
      if (puttDistanceFt < 8) {
        puttResult = Math.random() < 0.85 ? 'made' : 'short'
      } else if (puttDistanceFt < 18) {
        puttResult = pick(['made', 'short', 'long', 'missed_left', 'missed_right'])
      } else {
        puttResult = pick(['short', 'short', 'long', 'missed_left', 'missed_right'])
      }
    }

    const shotResult = lieType === 'green' ? null : pick(resultPool)
    const slopeForward = pick(FORWARD_SLOPES)
    const slopeSide = pick(SIDE_SLOPES)

    shots.push({
      hole_score_id: holeScoreId,
      user_id: userId,
      shot_number: n,
      start_lat: lastEnd.lat,
      start_lng: lastEnd.lng,
      aim_lat: aim.lat,
      aim_lng: aim.lng,
      end_lat: end.lat,
      end_lng: end.lng,
      distance_to_target: lieType === 'green' ? null : Math.round(remainingYards),
      club,
      lie_type: lieType,
      lie_slope: null,
      lie_slope_forward: slopeForward,
      lie_slope_side: slopeSide,
      shot_result: shotResult,
      penalty: false,
      ob: false,
      putt_distance_ft: puttDistanceFt,
      putt_result: puttResult,
    })
    lastEnd = end
  }
  return shots
}

// ---------------------------------------------------------------------------
// Insert one round (and optionally shots) end-to-end.
// ---------------------------------------------------------------------------

async function insertRound(
  userId: string,
  course: CourseRow,
  courseBase: [number, number],
  holes: HoleRow[],
  daysAgo: number,
  withShots: boolean,
): Promise<void> {
  const profile = pickRoundProfile()
  const sgTotal =
    profile.sgOffTee + profile.sgApproach + profile.sgAroundGreen + profile.sgPutting

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      user_id: userId,
      course_id: course.id,
      played_at: dateNDaysAgo(daysAgo),
      tee_color: 'white',
      total_score: profile.totalScore,
      total_putts: profile.totalPutts,
      fairways_hit: profile.fairwaysHit,
      fairways_total: 14,
      gir: profile.gir,
      sg_off_tee: round2(profile.sgOffTee),
      sg_approach: round2(profile.sgApproach),
      sg_around_green: round2(profile.sgAroundGreen),
      sg_putting: round2(profile.sgPutting),
      sg_total: round2(sgTotal),
    })
    .select('id')
    .single()
  if (roundError || !round) throw roundError ?? new Error('round insert failed')

  // Hole scores for every round so the scoring distribution chart has data.
  const holeScoreRows = buildHoleScores(
    round.id,
    holes,
    profile.totalScore,
    profile.gir,
    profile.fairwaysHit,
  )
  const { data: insertedHoleScores, error: hsError } = await supabase
    .from('hole_scores')
    .insert(holeScoreRows)
    .select('id, hole_id, score')
  if (hsError || !insertedHoleScores) {
    throw hsError ?? new Error('hole_score insert failed')
  }

  if (!withShots) return

  // Shot data for the rounds we want plottable on the patterns page.
  const holesById = new Map(holes.map((h) => [h.id, h]))
  for (const hs of insertedHoleScores) {
    const hole = holesById.get(hs.hole_id)
    if (!hole) continue
    const geom = holeGeometry(courseBase, hole)
    const shots = buildShotsForHole(userId, hs.id, hole, hs.score, geom)
    const { error: shotErr } = await supabase.from('shots').insert(shots)
    if (shotErr) throw shotErr
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding rounds for ${EMAIL} into ${URL}`)

  const userId = await findUserId(EMAIL!)
  const existing = await existingRoundCount(userId)
  if (existing >= TARGET_ROUNDS) {
    console.log(`Data already seeded for this user. (${existing} rounds present)`)
    return
  }

  const courses = await fetchSeedCourses()
  const holesByCourse = await fetchHolesByCourse(courses.map((c) => c.id))

  const toInsert = TARGET_ROUNDS - existing
  console.log(
    `User has ${existing} rounds. Inserting ${toInsert} more (${ROUNDS_WITH_SHOTS} with shot detail).`,
  )

  // Spread N rounds across roughly 6 months (180 days).
  for (let i = 0; i < toInsert; i++) {
    const course = courses[i % courses.length]!
    const courseBase = (() => {
      const idx = courses.indexOf(course)
      const off = COURSE_OFFSETS[idx] ?? [0, 0]
      return [OKC_BASE[0] + off[0], OKC_BASE[1] + off[1]] as [number, number]
    })()
    const holes = holesByCourse.get(course.id) ?? []
    if (holes.length === 0) continue
    const daysAgo = Math.round((i / Math.max(1, toInsert - 1)) * 175 + 3)
    await insertRound(userId, course, courseBase, holes, daysAgo, i < ROUNDS_WITH_SHOTS)
    process.stdout.write('.')
  }
  process.stdout.write('\n')
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
