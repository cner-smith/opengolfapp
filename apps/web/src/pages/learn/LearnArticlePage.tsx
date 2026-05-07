import { Link, Navigate, useParams } from 'react-router-dom'
import { getArticleComponent } from './data/articleRegistry'
import {
  findArticle,
  type ArticleStub,
  type LearnSection,
} from './data/learnSections'

export function LearnArticlePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const found = findArticle(slug)
  const Component = getArticleComponent(slug)

  if (!found || !Component) {
    return <Navigate to="/learn" replace />
  }

  const { article, section } = found
  const { prev, next } = neighbours(section, article.id)
  const isDraft = article.status === 'draft'

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink />
      <Breadcrumb section={section} title={article.title} />
      <Component />
      {isDraft && <DraftBanner />}
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

function Breadcrumb({
  section,
  title,
}: {
  section: LearnSection
  title: string
}) {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        marginBottom: 22,
      }}
    >
      Learn / <span style={{ color: '#5C6356' }}>{section.title}</span> /{' '}
      <span style={{ color: '#1C211C' }}>{title}</span>
    </div>
  )
}

function DraftBanner() {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 14,
        marginTop: 22,
        marginBottom: 22,
        fontSize: 10,
        letterSpacing: '0.14em',
      }}
    >
      Draft · content under review
    </div>
  )
}

function neighbours(
  section: LearnSection,
  currentId: string,
): { prev: ArticleStub | null; next: ArticleStub | null } {
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
  prev: ArticleStub | null
  next: ArticleStub | null
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
  article: ArticleStub | null
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
