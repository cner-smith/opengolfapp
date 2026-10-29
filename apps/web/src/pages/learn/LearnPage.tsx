import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEARN_SECTIONS,
  findLearnArticle,
  readingTimeMinutes,
  type LearnArticle,
  type LearnSection,
} from '@oga/core'
import { Footnote } from './components/ArticlePrimitives'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import './learn.css'

// Read first: the lead, and three picks for someone new to the book.
const LEAD = 'strokes-gained'
const START_HERE = ['how-to-practice', 'course-management', 'building-your-bag']

export function LearnPage() {
  useDocumentTitle('The yardage book · OGA')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterSections(LEARN_SECTIONS, query), [query])
  const lead = findLearnArticle(LEAD)?.article
  const picks = START_HERE.map((id) => findLearnArticle(id)?.article).filter((a): a is LearnArticle => !!a)

  return (
    <div className="learn-index">
      <header className="learn-hero">
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 'clamp(36px, 5vw, 46px)', fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          The yardage book.
        </h1>
        <p className="font-serif text-caddie-ink" style={{ fontSize: 18, marginTop: 12, maxWidth: 560, lineHeight: 1.55 }}>
          Guides, references, and frameworks for players who want to improve.
        </p>
        {lead && (
          <Link to={`/learn/${lead.id}`} className="learn-lead learn-row">
            <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
              Start with the one the rest lean on
            </span>
            <span className="learn-row-title font-serif" style={{ fontSize: 28, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15 }}>
              {lead.title}
            </span>
            <span className="font-serif text-caddie-ink" style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 560 }}>
              {lead.description}
            </span>
            <span className="learn-arrow font-serif" aria-hidden style={{ fontSize: 22, fontStyle: 'italic' }}>
              →
            </span>
          </Link>
        )}
      </header>

      <aside className="learn-aside">
        <div className="learn-aside-inner">
          <SearchInput value={query} onChange={setQuery} />
          <h2 className="font-serif text-caddie-ink" style={{ fontSize: 18, fontWeight: 500, fontStyle: 'italic', margin: '22px 0 6px' }}>
            Start here
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {picks.map((a) => (
              <li key={a.id} style={{ borderTop: '1px solid #D9D2BF' }}>
                <Link to={`/learn/${a.id}`} className="learn-row" style={{ padding: '10px 0', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <span className="learn-row-title font-serif" style={{ fontSize: 16, fontWeight: 500, fontStyle: 'italic' }}>
                    {a.title}
                  </span>
                  <span className="learn-arrow font-serif" aria-hidden style={{ fontStyle: 'italic' }}>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="learn-sections">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div key={query} className="pat-fade" style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {filtered.map((s) => (
              <SectionList key={s.id} section={s} />
            ))}
          </div>
        )}

        <p className="font-serif text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, marginTop: 40 }}>
          Questions the guides don&rsquo;t answer?{' '}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer noopener" style={{ color: '#1F3D2C', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Open an issue →
          </a>
        </p>

        <Footnote>
          Benchmarks based on Mark Broadie's strokes gained research and PGA Tour
          ShotLink data. Amateur averages approximate.
        </Footnote>
      </div>
    </div>
  )
}

const ISSUES_URL = 'https://github.com/cner-smith/opengolfapp/issues'

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
    <div style={{ position: 'relative' }}>
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="#5C6356" strokeWidth="1.4" />
        <path d="M9.4 9.4 13 13" stroke="#5C6356" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search guides…"
        aria-label="Search Learn articles"
        className="learn-search text-caddie-ink"
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
    <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 18, fontStyle: 'italic', padding: '22px 0', borderTop: '2px solid #1C211C' }}>
      No guide matches that. Try a shorter word.
    </p>
  )
}

// A section of the table of contents: an italic head on a 2px ink rule,
// then its guides on hairlines.
function SectionList({ section }: { section: LearnSection }) {
  return (
    <section>
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', borderTop: '2px solid #1C211C', paddingTop: 12, marginBottom: 2 }}
      >
        {section.title}
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {section.articles.map((a, i) => (
          <ArticleRow key={a.id} article={a} first={i === 0} />
        ))}
      </ul>
    </section>
  )
}

function ArticleRow({ article, first }: { article: LearnArticle; first: boolean }) {
  const isSoon = article.status === 'soon'
  const isDraft = article.status === 'draft'
  const reading = readingTimeMinutes(article)

  const inner = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="learn-row-title font-serif"
          style={{ display: 'block', fontSize: 18, fontWeight: 500, fontStyle: 'italic', color: isSoon ? '#8A8B7E' : undefined, marginBottom: 3 }}
        >
          {article.title}
          {isDraft && (
            <span className="text-caddie-warn" style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 12, fontStyle: 'normal', fontWeight: 600, marginLeft: 10 }}>
              Draft
            </span>
          )}
        </span>
        <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 14, lineHeight: 1.5 }}>
          {article.description}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
        {isSoon ? (
          <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
            Soon
          </span>
        ) : (
          <>
            {reading != null && (
              <span className="font-serif text-caddie-ink-dim" style={{ fontSize: 15, fontStyle: 'italic' }}>
                {reading} min
              </span>
            )}
            <span className="learn-arrow font-serif" style={{ fontSize: 18, fontStyle: 'italic' }} aria-hidden>
              →
            </span>
          </>
        )}
      </span>
    </>
  )

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 0',
    borderTop: first ? 'none' : '1px solid #D9D2BF',
  }
  if (isSoon) {
    return (
      <li aria-disabled="true" style={rowStyle}>
        {inner}
      </li>
    )
  }
  return (
    <li>
      <Link to={`/learn/${article.id}`} className="learn-row" style={rowStyle}>
        {inner}
      </Link>
    </li>
  )
}
