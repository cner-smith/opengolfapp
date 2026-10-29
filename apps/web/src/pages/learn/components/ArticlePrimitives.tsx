import type { ReactNode } from 'react'
import '../learn.css'

// The article's title: the one big italic line, ruled off from the text.
// The category it belongs to is the breadcrumb above (LearnArticlePage).
export function ArticleTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 'clamp(34px, 5vw, 46px)',
        fontWeight: 500,
        fontStyle: 'italic',
        letterSpacing: '-0.02em',
        lineHeight: 1.08,
        paddingBottom: 18,
        borderBottom: '2px solid #1C211C',
        marginBottom: 22,
        textWrap: 'balance',
      } as React.CSSProperties}
    >
      {children}
    </h1>
  )
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 17,
        lineHeight: 1.55,
        maxWidth: 640,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

export function Body({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-caddie-ink"
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 640,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

// A plain heading inside an article: sentence case, upright, under the
// articles' own italic section heads.
export function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.25, marginTop: 22, marginBottom: 12 }}
    >
      {children}
    </h3>
  )
}

export function Bullet({
  term,
  children,
}: {
  term: string
  children: ReactNode
}) {
  return (
    <li
      style={{
        padding: '12px 0',
        borderTop: '1px solid #D9D2BF',
      }}
    >
      <div className="learn-bullet">
        <span
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, fontWeight: 500, fontStyle: 'italic' }}
        >
          {term}
        </span>
        <span
          className="learn-bullet-def text-caddie-ink-dim"
        >
          {children}
        </span>
      </div>
    </li>
  )
}

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-caddie-ink-dim"
      style={{
        fontSize: 12,
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 18,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}

export function fmtSG(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

// Citation block helpers, shared by every article's per-article `Sources()`.
// The label/body styling is identical across articles; only the cited
// content differs, so that stays local while these wrappers live here.
export function SrcLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-caddie-ink"
      style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}
    >
      {children}
    </div>
  )
}

export function SrcBody({ children }: { children: ReactNode }) {
  return (
    <div className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
      {children}
    </div>
  )
}
