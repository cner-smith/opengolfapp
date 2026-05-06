import type { ReactNode } from 'react'

export function Entry({
  id,
  kicker,
  title,
  children,
}: {
  id: string
  kicker: string
  title?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        {kicker}
      </div>
      {title && (
        <h2
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 28,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
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

export function Subkicker({ children }: { children: ReactNode }) {
  return (
    <div
      className="kicker"
      style={{ marginTop: 14, marginBottom: 12, color: '#5C6356' }}
    >
      {children}
    </div>
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
      <div className="flex items-baseline" style={{ gap: 14 }}>
        <span
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, fontWeight: 500, fontStyle: 'italic', minWidth: 160 }}
        >
          {term}
        </span>
        <span
          className="text-caddie-ink-dim"
          style={{ fontSize: 14, lineHeight: 1.5 }}
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
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
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

export function SectionHeader({
  id,
  number,
  title,
}: {
  id: string
  number: string
  title: string
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: '2px solid #9F9580',
        paddingTop: 28,
        marginTop: 14,
        marginBottom: 22,
      }}
    >
      <div className="kicker" style={{ marginBottom: 10 }}>
        {number}
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 32,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
    </section>
  )
}

export function ArticleAnchor({
  id,
  kicker,
  title,
}: {
  id: string
  kicker: string
  title: string
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 18,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        {kicker}
      </div>
      <h3
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
    </section>
  )
}

export function fmtSG(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}
