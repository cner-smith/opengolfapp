import { clubNoun } from './constants'
import { isPartialRound } from './round'
import { parseLocalDate } from './units'

// The Plan page before the player types (#1337): the courses they have played,
// and an intro line written from their own rounds and club distances.

type HoleScoreForCount = { score: number | null; holes?: { number: number } | null }

export interface PlayedRound {
  course_id: string
  played_at: string
  total_score: number | null
  hole_count?: number | null
  hole_scores?: readonly HoleScoreForCount[] | null
  courses: { name: string; city: string | null; state: string | null } | null
}

export interface PlayedCourse {
  courseId: string
  name: string
  city: string | null
  state: string | null
  rounds: number
  lastPlayedAt: string
  /** The newest whole, scored round here; null when every round is open or ended early. */
  lastScore: { score: number; playedAt: string; nineHoles: boolean } | null
}

/**
 * One row per course, newest first by the last time it was played. The score
 * leaves out open rounds (a past round stores total_score 0 until it's done)
 * and rounds ended early, whose totals don't compare.
 */
export function groupPlayedCourses(rounds: readonly PlayedRound[]): PlayedCourse[] {
  const byCourse = new Map<string, PlayedCourse>()
  for (const r of rounds) {
    if (!r.courses) continue
    let c = byCourse.get(r.course_id)
    if (!c) {
      c = {
        courseId: r.course_id,
        name: r.courses.name,
        city: r.courses.city,
        state: r.courses.state,
        rounds: 0,
        lastPlayedAt: r.played_at,
        lastScore: null,
      }
      byCourse.set(r.course_id, c)
    }
    c.rounds += 1
    if (r.played_at > c.lastPlayedAt) c.lastPlayedAt = r.played_at
    const whole = (r.total_score ?? 0) > 0 && !isPartialRound(r.hole_scores, r.hole_count)
    if (whole && (!c.lastScore || r.played_at > c.lastScore.playedAt)) {
      c.lastScore = { score: r.total_score!, playedAt: r.played_at, nineHoles: r.hole_count === 9 }
    }
  }
  // Stable sort: a same-day tie keeps the input's order.
  return [...byCourse.values()].sort((a, b) => (a.lastPlayedAt < b.lastPlayedAt ? 1 : a.lastPlayedAt > b.lastPlayedAt ? -1 : 0))
}

/** "Oct 26"; a date from another year adds it: "Oct 26, 2024". */
export function shortPlayedDate(date: string, today: Date = new Date()): string {
  const d = parseLocalDate(date)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('en-US', opts)
}

export interface PlanHole {
  number: number
  par: number
  yards: number | null
}

/** The hole the intro names: the longest par 4 with yards; a tie goes to the lower number. */
export function planIntroHole<H extends PlanHole>(holes: readonly H[]): H | null {
  let best: H | null = null
  for (const h of holes) {
    if (h.par !== 4 || h.yards == null || h.yards <= 0) continue
    if (!best || h.yards > best.yards! || (h.yards === best.yards && h.number < best.number)) best = h
  }
  return best
}

const COURSE_SUFFIX = /\s+(golf (and|&) country club|country club|golf club|golf course|golf links|golf resort)$/i

// "Bear Creek Golf Club" → "Bear Creek". A name that is only the suffix stays whole.
function shortCourseName(name: string): string {
  const short = name.trim().replace(COURSE_SUFFIX, '')
  return short.length > 0 ? short : name.trim()
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

// "an 8-iron", "an 11-wood", "a 9-iron", "a sand wedge", "an approach wedge".
function article(noun: string): string {
  return /^(8|11|18|[aeiou])/i.test(noun) ? 'an' : 'a'
}

/** One run of the intro; `strong` runs are set in the ink colour. */
export type IntroPart = { text: string; strong?: boolean }

export interface PlanIntroInput {
  /** The newest round's course and date; null with no rounds. */
  last: { courseName: string; playedAt: string } | null
  /** That course's holes. */
  holes: readonly PlanHole[]
  /** Median finish distance (yards) per club_type, from the player's own shots. */
  clubYards: ReadonlyMap<string, number>
  /** The club for a distance (the planner's club pick); null with no shot data. */
  clubFor: (yards: number) => string | null
  today?: Date
}

const TODAY_LINE = 'Pick a course, then walk it hole by hole with the distances your clubs really go.'
const MID_IRONS = ['8i', '7i', '9i', '6i']

/**
 * The line under "Plan a round". In order: the last course, its longest par 4
 * and the club the second shot needs after the player's driver; else two of
 * their club distances; else the fixed line.
 */
export function planIntroLine(input: PlanIntroInput): IntroPart[] {
  const { last, holes, clubYards, clubFor } = input
  const driver = clubYards.get('driver')
  const hole = planIntroHole(holes)
  if (last && hole && driver != null) {
    const drive = Math.round(driver)
    const second = clubFor(hole.yards! - drive)
    if (hole.yards! > drive && second && second !== 'putter') {
      const noun = clubNoun(second)
      return [
        { text: 'You last played ' },
        { text: shortCourseName(last.courseName), strong: true },
        { text: ` on ${shortPlayedDate(last.playedAt, input.today)}. Its ${ordinal(hole.number)} plays ${hole.yards}; your driver finishes about ${drive}, so the second is ${article(noun)} ` },
        { text: noun, strong: true },
        { text: '.' },
      ]
    }
  }

  let long: [string, number] | null = driver != null ? ['driver', driver] : null
  if (!long) {
    for (const [club, yards] of clubYards) {
      if (club !== 'putter' && (!long || yards > long[1])) long = [club, yards]
    }
  }
  const mid = MID_IRONS.find((c) => clubYards.has(c) && c !== long?.[0])
  if (long && mid) {
    return [
      { text: `Your ${clubNoun(long[0])} finishes about ` },
      { text: String(Math.round(long[1])), strong: true },
      { text: ` and your ${clubNoun(mid)} ` },
      { text: String(Math.round(clubYards.get(mid)!)), strong: true },
      { text: '. Pick a course and walk it with those numbers.' },
    ]
  }
  return [{ text: TODAY_LINE }]
}
