// Hand-maintained snapshot of the PUBLISHED Learn articles, for the practice-plan
// Edge Function's §21 citation set. The source of truth is
// `packages/core/src/learn.ts` (`LEARN_SECTIONS`), but that module is large and
// NOT import-free (it pulls in section structure unrelated to Deno), so a full
// vendor is wrong. Instead we copy only the articles whose `status` is
// 'published' — currently exactly two.
//
// `article_id` and `slug` are identical here because the web router keys the
// article URL off the catalog `id` (`/learn/${article.id}`); `summary` mirrors
// the catalog `description`.
//
// REVISIT when the Learn-publish track grows: each time an article in
// `learn.ts` flips `draft → published`, add it here (keep the two in sync).
// Only `published` articles may be cited by a generated plan (spec §21).

/** A published Learn article eligible for citation. `article_ref` indexes this set. */
export interface PublishedArticle {
  article_id: string
  title: string
  slug: string
  summary: string
}

const PUBLISHED_ARTICLES: PublishedArticle[] = [
  {
    article_id: 'strokes-gained',
    title: 'How strokes gained works',
    slug: 'strokes-gained',
    summary:
      'How every shot is graded against an expectation, and what +0.3 SG-Putting actually means.',
  },
  {
    article_id: 'benchmarks',
    title: 'Reading your stats',
    slug: 'benchmarks',
    summary:
      'Where each stat lands across the field, from a 25-handicap weekend round up to the PGA Tour.',
  },
]

/** The fixed set of published Learn articles a plan may cite (worst-first order
 *  is irrelevant — `article_ref` is a 0-based index into this exact array). */
export function getPublishedArticles(): PublishedArticle[] {
  return PUBLISHED_ARTICLES
}
