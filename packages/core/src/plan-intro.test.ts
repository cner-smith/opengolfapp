import { describe, expect, it } from 'vitest'
import { groupPlayedCourses, planIntroHole, planIntroLine, shortPlayedDate, type IntroPart, type PlayedRound } from './plan-intro'

const course = (name: string, city = 'Wentzville', state = 'MO') => ({ name, city, state })
// 18 scored holes = a whole 18-hole round.
const whole18 = Array.from({ length: 18 }, (_, i) => ({ score: 4, holes: { number: i + 1 } }))

describe('groupPlayedCourses', () => {
  it('one row per course, newest first, with a round count', () => {
    const rounds: PlayedRound[] = [
      { course_id: 'w', played_at: '2026-10-12', total_score: 91, hole_count: 18, hole_scores: whole18, courses: course('Whitmoor Country Club', 'Weldon Spring') },
      { course_id: 'b', played_at: '2026-10-26', total_score: 86, hole_count: 18, hole_scores: whole18, courses: course('Bear Creek Golf Club') },
      { course_id: 'b', played_at: '2026-09-01', total_score: 90, hole_count: 18, hole_scores: whole18, courses: course('Bear Creek Golf Club') },
    ]
    const out = groupPlayedCourses(rounds)
    expect(out.map((c) => [c.courseId, c.rounds, c.lastPlayedAt])).toEqual([
      ['b', 2, '2026-10-26'],
      ['w', 1, '2026-10-12'],
    ])
    expect(out[0]).toMatchObject({ name: 'Bear Creek Golf Club', city: 'Wentzville', state: 'MO', lastScore: { score: 86, playedAt: '2026-10-26', nineHoles: false } })
  })

  it('takes the newest date whatever the input order', () => {
    const rounds: PlayedRound[] = [
      { course_id: 'b', played_at: '2026-09-01', total_score: 90, hole_count: 18, hole_scores: whole18, courses: course('Bear Creek Golf Club') },
      { course_id: 'b', played_at: '2026-10-26', total_score: 86, hole_count: 18, hole_scores: whole18, courses: course('Bear Creek Golf Club') },
    ]
    expect(groupPlayedCourses(rounds)[0]).toMatchObject({ lastPlayedAt: '2026-10-26', lastScore: { score: 86 } })
  })

  it('leaves open rounds (total 0) and rounds ended early out of the score, but counts them', () => {
    const six = whole18.slice(0, 6)
    const rounds: PlayedRound[] = [
      { course_id: 'b', played_at: '2026-11-02', total_score: 0, hole_count: 18, hole_scores: [], courses: course('Bear Creek Golf Club') },
      { course_id: 'b', played_at: '2026-10-30', total_score: 26, hole_count: 18, hole_scores: six, courses: course('Bear Creek Golf Club') },
      { course_id: 'b', played_at: '2026-10-26', total_score: 86, hole_count: 18, hole_scores: whole18, courses: course('Bear Creek Golf Club') },
    ]
    const c = groupPlayedCourses(rounds)[0]!
    expect(c.rounds).toBe(3)
    expect(c.lastPlayedAt).toBe('2026-11-02')
    expect(c.lastScore).toEqual({ score: 86, playedAt: '2026-10-26', nineHoles: false })
  })

  it('marks a 9-hole round from hole_count, and no score when none is whole', () => {
    const nine = whole18.slice(0, 9)
    expect(
      groupPlayedCourses([
        { course_id: 'p', played_at: '2026-09-07', total_score: 44, hole_count: 9, hole_scores: nine, courses: course('Pheasant Run Golf Club') },
      ])[0]!.lastScore,
    ).toEqual({ score: 44, playedAt: '2026-09-07', nineHoles: true })
    expect(
      groupPlayedCourses([
        { course_id: 'p', played_at: '2026-09-07', total_score: 0, hole_count: 18, hole_scores: [], courses: course('Pheasant Run Golf Club') },
      ])[0]!.lastScore,
    ).toBeNull()
  })
})

describe('shortPlayedDate', () => {
  it('drops the year for this year and keeps it for another', () => {
    const today = new Date(2026, 10, 3)
    expect(shortPlayedDate('2026-10-26', today)).toBe('Oct 26')
    expect(shortPlayedDate('2024-10-26', today)).toBe('Oct 26, 2024')
  })
})

describe('planIntroHole', () => {
  it('picks the longest par 4 with yards, ignoring longer par 5s and par 4s without yards', () => {
    const holes = [
      { number: 1, par: 4, yards: 342 },
      { number: 2, par: 5, yards: 520 },
      { number: 9, par: 4, yards: 362 },
      { number: 12, par: 4, yards: null },
      { number: 14, par: 3, yards: 190 },
    ]
    expect(planIntroHole(holes)?.number).toBe(9)
  })
  it('breaks a tie on the lower hole number', () => {
    expect(planIntroHole([{ number: 15, par: 4, yards: 400 }, { number: 6, par: 4, yards: 400 }])?.number).toBe(6)
  })
  it('is null with no par 4 that has yards', () => {
    expect(planIntroHole([{ number: 1, par: 4, yards: null }, { number: 2, par: 3, yards: 150 }])).toBeNull()
  })
})

const text = (parts: IntroPart[]) => parts.map((p) => p.text).join('')
const strong = (parts: IntroPart[]) => parts.filter((p) => p.strong).map((p) => p.text)
const today = new Date(2026, 10, 3)
const bearCreek = [
  { number: 1, par: 4, yards: 342 },
  { number: 9, par: 4, yards: 362 },
  { number: 10, par: 5, yards: 505 },
]
// Sam's medians: driver 220.4, 8-iron 141, 7-iron 152.
const sam = new Map([['driver', 220.4], ['7i', 152], ['8i', 141]])
// Nearest median wins, as the planner's club pick does.
const nearest = (clubs: Map<string, number>) => (yards: number) =>
  [...clubs].reduce<[string, number] | null>((b, c) => (!b || Math.abs(c[1] - yards) < Math.abs(b[1] - yards) ? c : b), null)?.[0] ?? null

describe('planIntroLine', () => {
  it('names the last course, its longest par 4 and the second club after the driver', () => {
    // 362 - 220 = 142: 8-iron (141) is nearer than 7-iron (152).
    const line = planIntroLine({ last: { courseName: 'Bear Creek Golf Club', playedAt: '2026-10-26' }, holes: bearCreek, clubYards: sam, clubFor: nearest(sam), today })
    expect(text(line)).toBe('You last played Bear Creek on Oct 26. Its 9th plays 362; your driver finishes about 220, so the second is an 8-iron.')
    expect(strong(line)).toEqual(['Bear Creek', '8-iron'])
  })

  it('says "a" before a 9-iron and keeps a name that is only a suffix', () => {
    const clubs = new Map([['driver', 230], ['9i', 130]])
    const line = planIntroLine({ last: { courseName: 'Country Club', playedAt: '2026-10-26' }, holes: [{ number: 3, par: 4, yards: 360 }], clubYards: clubs, clubFor: nearest(clubs), today })
    expect(text(line)).toBe('You last played Country Club on Oct 26. Its 3rd plays 360; your driver finishes about 230, so the second is a 9-iron.')
  })

  it("falls back to two club distances when the course's holes have no yards", () => {
    const holes = bearCreek.map((h) => ({ ...h, yards: null }))
    const line = planIntroLine({ last: { courseName: 'Bear Creek Golf Club', playedAt: '2026-10-26' }, holes, clubYards: sam, clubFor: nearest(sam), today })
    expect(text(line)).toBe('Your driver finishes about 220 and your 8-iron 141. Pick a course and walk it with those numbers.')
    expect(strong(line)).toEqual(['220', '141'])
  })

  it('falls back when the par 4 is shorter than the drive', () => {
    const clubs = new Map([['driver', 300], ['8i', 150]])
    const line = planIntroLine({ last: { courseName: 'Bear Creek Golf Club', playedAt: '2026-10-26' }, holes: [{ number: 1, par: 4, yards: 290 }], clubYards: clubs, clubFor: nearest(clubs), today })
    expect(text(line)).toBe('Your driver finishes about 300 and your 8-iron 150. Pick a course and walk it with those numbers.')
  })

  it('with no driver data, the line uses the longest club', () => {
    const clubs = new Map([['3w', 205.6], ['7i', 152], ['putter', 3]])
    const line = planIntroLine({ last: { courseName: 'Bear Creek Golf Club', playedAt: '2026-10-26' }, holes: bearCreek, clubYards: clubs, clubFor: nearest(clubs), today })
    expect(text(line)).toBe('Your 3-wood finishes about 206 and your 7-iron 152. Pick a course and walk it with those numbers.')
  })

  it('never names the long club twice', () => {
    const clubs = new Map([['8i', 141], ['9i', 130]])
    const line = planIntroLine({ last: null, holes: [], clubYards: clubs, clubFor: nearest(clubs), today })
    expect(text(line)).toBe('Your 8-iron finishes about 141 and your 9-iron 130. Pick a course and walk it with those numbers.')
  })

  it("with no shot data, today's fixed line", () => {
    const none = new Map<string, number>()
    const line = planIntroLine({ last: { courseName: 'Bear Creek Golf Club', playedAt: '2026-10-26' }, holes: bearCreek, clubYards: none, clubFor: () => null, today })
    expect(text(line)).toBe('Pick a course, then walk it hole by hole with the distances your clubs really go.')
    expect(planIntroLine({ last: null, holes: [], clubYards: none, clubFor: () => null, today })).toEqual(line)
  })
})
