import { describe, it, expect } from 'vitest'
import { HELP_TOPICS, getHelpTopic } from './helpContent'
import { findLearnArticle } from './learn'

describe('helpContent', () => {
  it('returns the stats topic with a linked article', () => {
    const t = getHelpTopic('stats')
    expect(t?.title).toBeTruthy()
    expect(t?.body.length).toBeGreaterThan(20)
    expect(t?.articleId).toBe('strokes-gained')
  })
  it('returns null for an unknown id', () => {
    expect(getHelpTopic('nope')).toBeNull()
  })
  it('every topic id matches its map key', () => {
    for (const [k, v] of Object.entries(HELP_TOPICS)) expect(v.id).toBe(k)
  })
  // Referential integrity across helpContent -> learn (seam guard): every
  // articleId must resolve to a real, PUBLISHED Learn article, so a future
  // Learn rename/unpublish trips CI here instead of dead-linking "Learn more".
  it('every articleId resolves to a published Learn article', () => {
    for (const t of Object.values(HELP_TOPICS)) {
      if (!t.articleId) continue
      const found = findLearnArticle(t.articleId)
      expect(found, `help topic '${t.id}' -> unknown article '${t.articleId}'`).not.toBeNull()
      expect(found?.article.status).toBe('published')
    }
  })
})
