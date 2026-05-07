import { describe, expect, it } from 'vitest'
import {
  LEARN_SECTIONS,
  findLearnArticle,
  readingTimeMinutes,
  type LearnArticle,
} from '../learn'

describe('findLearnArticle', () => {
  it('returns the article and its section for a known slug', () => {
    const found = findLearnArticle('strokes-gained')
    expect(found).not.toBeNull()
    expect(found?.article.id).toBe('strokes-gained')
    expect(found?.section.id).toBe('understanding-the-game')
  })

  it('returns null for an unknown slug', () => {
    expect(findLearnArticle('not-a-real-article')).toBeNull()
  })

  it('returns null for the empty string', () => {
    expect(findLearnArticle('')).toBeNull()
  })

  it('finds every article in every section', () => {
    for (const section of LEARN_SECTIONS) {
      for (const article of section.articles) {
        const found = findLearnArticle(article.id)
        expect(found?.section.id).toBe(section.id)
        expect(found?.article.id).toBe(article.id)
      }
    }
  })
})

describe('readingTimeMinutes', () => {
  it('returns null when words is missing (soon articles)', () => {
    const a: LearnArticle = {
      id: 'x',
      title: 't',
      description: 'd',
      status: 'soon',
    }
    expect(readingTimeMinutes(a)).toBeNull()
  })

  it('rounds up partial minutes', () => {
    const a: LearnArticle = {
      id: 'x',
      title: 't',
      description: 'd',
      status: 'published',
      words: 250,
    }
    expect(readingTimeMinutes(a)).toBe(2)
  })

  it('clamps to at least one minute for very short articles', () => {
    const a: LearnArticle = {
      id: 'x',
      title: 't',
      description: 'd',
      status: 'published',
      words: 10,
    }
    expect(readingTimeMinutes(a)).toBe(1)
  })
})

describe('LEARN_SECTIONS', () => {
  it('has unique article ids across all sections', () => {
    const ids = LEARN_SECTIONS.flatMap((s) => s.articles.map((a) => a.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique section ids', () => {
    const ids = LEARN_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
