// Contextual "?" help copy, one entry per screen. Single source of truth for
// web + mobile so the two stay in sync. `body` answers "what am I looking at /
// what does this do" for THIS screen; `articleId` (optional) deep-links the
// matching Learn article (LearnArticle.id) for depth. Keep body to 2-4 short
// sentences — this is the in-the-moment answer, not the full lesson.
export interface HelpTopic {
  id: string
  title: string
  body: string
  articleId?: string
}

export const HELP_TOPICS = {
  stats: {
    id: 'stats',
    title: 'Reading your stats',
    body:
      'Strokes Gained compares each shot to what a golfer in your handicap ' +
      'bracket would average from the same spot. A positive number means you ' +
      'gained strokes on the field; negative means you lost them. Use it to ' +
      'see which part of your game is costing you the most.',
    articleId: 'strokes-gained',
  },
  // Phase 2 (with the deferred live-map "?") adds a 'live-round-map' topic here
  // (static, no articleId — no live-round Learn article exists).
} satisfies Record<string, HelpTopic>

// `satisfies` (not a `Record<string, …>` annotation) keeps the literal keys so
// this union narrows to the real topic ids instead of `string`.
export type HelpTopicId = keyof typeof HELP_TOPICS

export function getHelpTopic(id: string): HelpTopic | null {
  return (HELP_TOPICS as Record<string, HelpTopic>)[id] ?? null
}
