import { describe, it, expect } from 'vitest'
import {
  normalizeCourseName,
  normalizeState,
  isProbableSameCourse,
  distinctiveToken,
  nameTokensContained,
  rankPlanCourses,
} from './course-match'

describe('normalizeCourseName', () => {
  it('strips golf noise words, punctuation, and case', () => {
    expect(normalizeCourseName('Lake Hefner Golf Club')).toBe('lake hefner')
    expect(normalizeCourseName('lake hefner golf course')).toBe('lake hefner')
  })
  it('returns empty when only noise words remain', () => {
    expect(normalizeCourseName('The Golf Club')).toBe('')
  })
})

describe('normalizeState', () => {
  it('maps a full state name to its 2-letter code', () => {
    expect(normalizeState('Oklahoma')).toBe('ok')
    expect(normalizeState('New York')).toBe('ny')
  })
  it('passes an existing 2-letter code through (lowercased)', () => {
    expect(normalizeState('OK')).toBe('ok')
  })
  it('returns empty for null/blank', () => {
    expect(normalizeState(null)).toBe('')
    expect(normalizeState('  ')).toBe('')
  })
  it('passes unknown values through lowercased', () => {
    expect(normalizeState('Ontario')).toBe('ontario')
  })
})

describe('isProbableSameCourse', () => {
  it('matches same course with different suffix wording', () => {
    expect(
      isProbableSameCourse(
        { name: 'Lake Hefner Golf Club', state: 'OK' },
        { name: 'Lake Hefner Golf Course', state: 'OK' },
      ),
    ).toBe(true)
  })
  it('treats a missing state as non-disqualifying', () => {
    expect(
      isProbableSameCourse(
        { name: 'Pebble Beach', state: 'CA' },
        { name: 'Pebble Beach', state: null },
      ),
    ).toBe(true)
  })
  it('matches when one side spells the state out and the other abbreviates', () => {
    expect(
      isProbableSameCourse(
        { name: 'Lake Hefner Golf Club', state: 'Oklahoma' },
        { name: 'Lake Hefner Golf Course', state: 'OK' },
      ),
    ).toBe(true)
  })
  it('rejects same name in different states', () => {
    expect(
      isProbableSameCourse(
        { name: 'Pine Valley', state: 'NJ' },
        { name: 'Pine Valley', state: 'NY' },
      ),
    ).toBe(false)
  })
  it('rejects same name where one full-name state differs from the other code', () => {
    expect(
      isProbableSameCourse(
        { name: 'Riverside', state: 'Texas' },
        { name: 'Riverside', state: 'OK' },
      ),
    ).toBe(false)
  })
  it('rejects generic same-name same-state courses in different cities', () => {
    expect(
      isProbableSameCourse(
        { name: 'Riverside Golf Club', state: 'OK', city: 'Tulsa' },
        { name: 'Riverside Golf Club', state: 'OK', city: 'Norman' },
      ),
    ).toBe(false)
  })
  it('treats a missing city as non-disqualifying', () => {
    expect(
      isProbableSameCourse(
        { name: 'Riverside Golf Club', state: 'OK', city: 'Tulsa' },
        { name: 'Riverside Golf Club', state: 'OK', city: null },
      ),
    ).toBe(true)
  })
  it('rejects different courses', () => {
    expect(
      isProbableSameCourse(
        { name: 'North Course', state: 'OK' },
        { name: 'South Course', state: 'OK' },
      ),
    ).toBe(false)
  })
  it('never matches when a normalized name is empty', () => {
    expect(
      isProbableSameCourse({ name: 'The Golf Club' }, { name: 'The Club' }),
    ).toBe(false)
  })
})

describe('distinctiveToken', () => {
  it('breaks a length tie alphabetically so the choice is deterministic', () => {
    // "of" is NOT a noise word, so this normalizes to "merchants of edinburgh";
    // "merchants" and "edinburgh" are both 9 characters.
    expect(distinctiveToken('Merchants of Edinburgh Golf Club')).toBe('edinburgh')
  })

  it('picks the longest token', () => {
    expect(distinctiveToken('Bell Sh')).toBe('bell')
    expect(distinctiveToken('Sundridge Park West')).toBe('sundridge')
  })

  it('returns null for an all-noise-word name', () => {
    // Otherwise the caller builds ilike '%%' across the whole courses table.
    expect(distinctiveToken('The Golf Club')).toBeNull()
    expect(distinctiveToken('   ')).toBeNull()
  })
})

// Review-queue duplicate flag (#882): whole tokens, not a raw substring.
describe('nameTokensContained', () => {
  const n = normalizeCourseName

  it('matches when every word of the shorter name is a word of the longer', () => {
    expect(nameTokensContained(n('Tipperary Golf Club'), n('Tipperary Golf Club and Driving Range'))).toBe(true)
    expect(nameTokensContained(n('Sundridge Park West'), n('Sundridge Park Golf Course'))).toBe(true)
  })

  it('does not match mid-word', () => {
    expect(nameTokensContained(n('Lich'), n('Nolichucky View Golf Club'))).toBe(false)
    expect(nameTokensContained(n('Lich'), n('Lichfield Golf & Country Club'))).toBe(false)
  })

  it('does not match when only some words are shared', () => {
    expect(nameTokensContained(n('Amarillo el Prat'), n('Amarillo Country Club West Course'))).toBe(false)
  })

  it('is false when either name normalizes to nothing', () => {
    expect(nameTokensContained(n('Golf Club'), n('Ocean Course'))).toBe(false)
  })
})

describe('rankPlanCourses (#1223)', () => {
  const hole = (course_id: string, mapped: boolean) => ({ course_id, tee_lat: mapped ? 32.2 : null, pin_lat: mapped ? 32.21 : null })
  // Search order: Laurel (unmapped), Murrieta (no holes), Wentzville (mapped), Hilton Head (mapped, played).
  const courses = [{ id: 'laurel' }, { id: 'murrieta' }, { id: 'wentzville' }, { id: 'hilton' }]
  const holes = [
    ...Array.from({ length: 18 }, () => hole('laurel', false)),
    ...Array.from({ length: 18 }, (_, i) => hole('wentzville', i < 12)),
    ...Array.from({ length: 18 }, () => hole('hilton', true)),
    hole('elsewhere', true),
  ]

  it('counts holes and mapped holes (tee and pin) per course', () => {
    const rows = rankPlanCourses(courses, holes, new Set())
    const by = Object.fromEntries(rows.map((r) => [r.id, [r.holeCount, r.mappedCount, r.played]]))
    expect(by).toEqual({
      laurel: [18, 0, false],
      murrieta: [0, 0, false],
      wentzville: [18, 12, false],
      hilton: [18, 18, false],
    })
  })

  it('a tee without a pin is not mapped', () => {
    const rows = rankPlanCourses([{ id: 'x' }], [{ course_id: 'x', tee_lat: 1, pin_lat: null }], new Set())
    expect(rows[0]!.mappedCount).toBe(0)
  })

  it('played first, then mapped, then the rest, keeping search order within a tier', () => {
    expect(rankPlanCourses(courses, holes, new Set(['hilton'])).map((r) => r.id)).toEqual([
      'hilton',
      'wentzville',
      'laurel',
      'murrieta',
    ])
    expect(rankPlanCourses(courses, holes, new Set()).map((r) => r.id)).toEqual(['wentzville', 'hilton', 'laurel', 'murrieta'])
  })

  it('a played course leads even when it is not mapped', () => {
    expect(rankPlanCourses(courses, holes, new Set(['laurel'])).map((r) => r.id)).toEqual([
      'laurel',
      'wentzville',
      'hilton',
      'murrieta',
    ])
  })
})
