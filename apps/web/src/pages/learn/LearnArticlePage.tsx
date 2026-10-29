import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  READABLE_LEARN_ARTICLES,
  findLearnArticle,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { getArticleComponent } from './data/articleRegistry'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function LearnArticlePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const found = findLearnArticle(slug)
  const Component = getArticleComponent(slug)
  useDocumentTitle(found ? `${found.article.title} · OGA Learn` : 'The yardage book · OGA')

  if (!found || !Component) {
    return <Navigate to="/learn" replace />
  }

  const { article, section } = found
  const { prev, next } = neighbours(article.id)
  const isDraft = article.status === 'draft'

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Breadcrumb section={section} />
      {isDraft && <DraftBanner slug={article.id} />}
      <Component />
      <NeighbourNav prev={prev} next={next} />
    </div>
  )
}

// The one way back, and the article's category (no separate kicker).
function Breadcrumb({ section }: { section: LearnSection }) {
  return (
    <nav aria-label="Breadcrumb" className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 18 }}>
      <Link to="/learn" className="hover:text-caddie-ink" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
        Learn
      </Link>
      <span aria-hidden style={{ margin: '0 8px' }}>
        /
      </span>
      <span className="text-caddie-ink">{section.title}</span>
    </nav>
  )
}

function DraftBanner({ slug }: { slug: string }) {
  const key = `oga.learn.${slug}.wip-dismissed`
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(key) === '1') setDismissed(true)
  }, [key])
  if (dismissed) return null
  return (
    <div
      role="note"
      style={{
        background: '#FBF8F1',
        borderLeft: '3px solid #A66A1F',
        borderTop: '1px solid #D9D2BF',
        borderRight: '1px solid #D9D2BF',
        borderBottom: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '14px 18px',
        marginBottom: 22,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#A66A1F' }}>
          Work in progress
        </div>
        <p
          className="text-caddie-ink"
          style={{ fontSize: 14, lineHeight: 1.55 }}
        >
          This guide is being reviewed for accuracy. Treat specific
          technique advice as provisional until the notice is removed.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          window.sessionStorage.setItem(key, '1')
          setDismissed(true)
        }}
        className="key"
        style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}
      >
        Dismiss
      </button>
    </div>
  )
}

// Reading order runs through the whole book, so the last guide in a section
// leads on to the next section instead of to nothing.
function neighbours(currentId: string): { prev: LearnArticle | null; next: LearnArticle | null } {
  const idx = READABLE_LEARN_ARTICLES.findIndex((a) => a.id === currentId)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: READABLE_LEARN_ARTICLES[idx - 1] ?? null,
    next: READABLE_LEARN_ARTICLES[idx + 1] ?? null,
  }
}

function NeighbourNav({
  prev,
  next,
}: {
  prev: LearnArticle | null
  next: LearnArticle | null
}) {
  if (!prev && !next) return null
  return (
    <nav
      aria-label="More guides"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginTop: 32,
      }}
    >
      <NeighbourLink direction="prev" article={prev} />
      <NeighbourLink direction="next" article={next} />
    </nav>
  )
}

function NeighbourLink({
  direction,
  article,
}: {
  direction: 'prev' | 'next'
  article: LearnArticle | null
}) {
  const isNext = direction === 'next'
  const align = isNext ? 'right' : 'left'
  if (!article) return <div />
  return (
    <Link
      to={`/learn/${article.id}`}
      style={{ textDecoration: 'none', textAlign: align, display: 'block' }}
    >
      <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 6 }}>
        {isNext ? 'Next →' : '← Previous'}
      </div>
      <div
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 17,
          fontWeight: 500,
          fontStyle: 'italic',
          lineHeight: 1.3,
        }}
      >
        {article.title}
      </div>
    </Link>
  )
}
