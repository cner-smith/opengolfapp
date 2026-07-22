import { describe, it, expect } from 'vitest'
import { normalizeCourseName, isProbableSameCourse } from './course-match'

describe('normalizeCourseName', () => {
  it('strips golf noise words, punctuation, and case', () => {
    expect(normalizeCourseName('Lake Hefner Golf Club')).toBe('lake hefner')
    expect(normalizeCourseName('lake hefner golf course')).toBe('lake hefner')
  })
  it('returns empty when only noise words remain', () => {
    expect(normalizeCourseName('The Golf Club')).toBe('')
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
  it('rejects same name in different states', () => {
    expect(
      isProbableSameCourse(
        { name: 'Pine Valley', state: 'NJ' },
        { name: 'Pine Valley', state: 'NY' },
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
