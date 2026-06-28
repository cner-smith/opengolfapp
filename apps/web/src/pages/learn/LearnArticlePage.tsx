import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  findLearnArticle,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { getArticleComponent } from './data/articleRegistry'

export function LearnArticlePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const found = findLearnArticle(slug)
  const Component = getArticleComponent(slug)

  if (!found || !Component) {
    return <Navigate to="/learn" replace />
  }

  const { article, section } = found
  const { prev, next } = neighbours(section, article.id)
  const isDraft = article.status === 'draft'

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <BackLink />
      <Breadcrumb section={section} />
      {isDraft && <DraftBanner slug={article.id} />}
      <Component />
      <NeighbourNav prev={prev} next={next} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/learn"
      className="font-mono uppercase"
      style={{
        display: 'inline-block',
        fontSize: 10,
        letterSpacing: '0.14em',
        color: '#5C6356',
        textDecoration: 'none',
        marginBottom: 18,
      }}
    >
      ← Learn
    </Link>
  )
}

function Breadcrumb({ section }: { section: LearnSection }) {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        marginBottom: 22,
      }}
    >
      Learn / <span style={{ color: '#1C211C' }}>{section.title}</span>
    </div>
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
        <div className="kicker" style={{ marginBottom: 6, color: '#A66A1F' }}>
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
        className="font-mono uppercase"
        style={{
          background: 'transparent',
          border: '1px solid #D9D2BF',
          padding: '6px 10px',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: '#5C6356',
          cursor: 'pointer',
          borderRadius: 2,
        }}
      >
        Dismiss
      </button>
    </div>
  )
}

function neighbours(
  section: LearnSection,
  currentId: string,
): { prev: LearnArticle | null; next: LearnArticle | null } {
  const reachable = section.articles.filter((a) => a.status !== 'soon')
  const idx = reachable.findIndex((a) => a.id === currentId)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: idx > 0 ? (reachable[idx - 1] ?? null) : null,
    next: idx < reachable.length - 1 ? (reachable[idx + 1] ?? null) : null,
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
      <div
        className="font-mono uppercase text-caddie-ink-mute"
        style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 6 }}
      >
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
