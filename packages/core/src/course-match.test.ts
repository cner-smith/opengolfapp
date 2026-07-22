import { describe, it, expect } from 'vitest'
import {
  normalizeCourseName,
  normalizeState,
  isProbableSameCourse,
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
