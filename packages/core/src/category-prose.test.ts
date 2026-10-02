import { describe, expect, it } from 'vitest'
import { normalizeCategoryProse } from './category-prose'

describe('normalizeCategoryProse', () => {
  it('rewrites leaked snake_case categories, any case, whole words only', () => {
    expect(normalizeCategoryProse('Your off_tee and AROUND_GREEN play')).toBe(
      'Your off the tee and around the green play',
    )
    expect(normalizeCategoryProse('playoff_teetime')).toBe('playoff_teetime')
  })

  it('leaves readable categories alone', () => {
    expect(normalizeCategoryProse('approach and putting')).toBe('approach and putting')
  })

  it('degrades null / undefined to empty text', () => {
    expect(normalizeCategoryProse(null)).toBe('')
    expect(normalizeCategoryProse(undefined)).toBe('')
  })
})
