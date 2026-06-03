import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEARN_SECTIONS,
  readingTimeMinutes,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { Footnote } from './components/ArticlePrimitives'

export function LearnPage() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterSections(LEARN_SECTIONS, query), [query])

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Golf education
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 38,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            lineHeight: 1.05,
          }}
        >
          Learn.
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 8, maxWidth: 600, lineHeight: 1.55 }}
        >
          Guides, references, and frameworks for players who want to improve.
        </p>
      </div>

      <SearchInput value={query} onChange={setQuery} />

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {filtered.map((s) => (
            <SectionCard key={s.id} section={s} />
          ))}
        </div>
      )}

      <Footnote>
        Benchmarks based on Mark Broadie's strokes gained research and PGA Tour
        ShotLink data. Amateur averages approximate.
      </Footnote>
    </div>
  )
}

function filterSections(
  sections: LearnSection[],
  rawQuery: string,
): LearnSection[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return sections
  return sections
    .map((s) => {
      const sectionMatch = s.title.toLowerCase().includes(q)
      const articles = s.articles.filter(
        (a) =>
          sectionMatch ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      )
      return { ...s, articles }
    })
    .filter((s) => s.articles.length > 0)
}

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 28 }}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search guides…"
        aria-label="Search Learn articles"
        className="text-caddie-ink"
        style={{
          width: '100%',
          background: '#FBF8F1',
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '12px 36px 12px 14px',
          fontSize: 14,
          fontFamily: 'Epilogue, sans-serif',
          color: '#1C211C',
          outline: 'none',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#5C6356',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="text-caddie-ink-dim"
      style={{
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
        borderRadius: 4,
        padding: 32,
        textAlign: 'center',
        fontSize: 15,
        fontStyle: 'italic',
      }}
    >
      No articles found.
    </div>
  )
}

function SectionCard({ section }: { section: LearnSection }) {
  return (
    <section
      style={{
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
        borderRadius: 4,
      }}
    >
      <header
        style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        <div className="kicker" style={{ marginBottom: 6 }}>
          {section.title}
        </div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
          }}
        >
          {section.articles.length}{' '}
          {section.articles.length === 1 ? 'article' : 'articles'}
        </div>
      </header>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {section.articles.map((a, i) => (
          <ArticleRow
            key={a.id}
            article={a}
            isLast={i === section.articles.length - 1}
          />
        ))}
      </ul>
    </section>
  )
}

function ArticleRow({
  article,
  isLast,
}: {
  article: LearnArticle
  isLast: boolean
}) {
  const isSoon = article.status === 'soon'
  const isDraft = article.status === 'draft'
  const reading = readingTimeMinutes(article)

  const inner = (
    <div
      style={{
        padding: '16px 22px',
        borderBottom: isLast ? 'none' : '1px solid #D9D2BF',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-serif"
          style={{
            fontSize: 17,
            fontWeight: 500,
            fontStyle: 'italic',
            color: isSoon ? '#8A8B7E' : '#1C211C',
            marginBottom: 4,
          }}
        >
          {article.title}
          {isDraft && (
            <span
              className="font-mono uppercase text-caddie-warn"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                marginLeft: 10,
                fontStyle: 'normal',
                fontWeight: 500,
              }}
            >
              Draft
            </span>
          )}
        </div>
        <div
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          {article.description}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {isSoon ? (
          <span
            className="font-mono uppercase text-caddie-ink-mute"
            style={{ fontSize: 10, letterSpacing: '0.14em' }}
          >
            Soon
          </span>
        ) : (
          <>
            {reading != null && (
              <span
                className="font-mono uppercase text-caddie-ink-mute"
                style={{ fontSize: 10, letterSpacing: '0.14em' }}
              >
                {reading} min
              </span>
            )}
            <span
              className="font-serif text-caddie-ink-mute"
              style={{ fontSize: 18, fontStyle: 'italic' }}
              aria-hidden
            >
              →
            </span>
          </>
        )}
      </div>
    </div>
  )

  if (isSoon) {
    return <li aria-disabled="true">{inner}</li>
  }
  return (
    <li>
      <Link
        to={`/learn/${article.id}`}
        style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}
      >
        {inner}
      </Link>
    </li>
  )
}
