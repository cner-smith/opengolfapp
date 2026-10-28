import type { CSSProperties, ReactNode } from 'react'

// Paper section head (mobile components/paper/Section.tsx SectionHead): one
// ink rule, then a Fraunces-italic title; `aside` sits on the title's line.
export function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section style={{ borderTop: '1px solid #1C211C', paddingTop: 14, marginBottom: 44 }}>
      <div className="flex items-baseline justify-between flex-wrap" style={{ gap: 12, marginBottom: 14 }}>
        <h2
          className="font-serif text-caddie-ink"
          style={{ fontSize: 26, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2 }}
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Subhead({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, marginBottom: 10, ...style }}
    >
      {children}
    </h3>
  )
}

export function Insufficient({ note }: { note: string }) {
  return (
    <div
      className="font-serif text-caddie-ink-dim"
      style={{
        borderTop: '1px solid #D9D2BF',
        borderBottom: '1px solid #D9D2BF',
        padding: '16px 0',
        fontSize: 16,
        fontStyle: 'italic',
      }}
    >
      {note}
    </div>
  )
}

export function Skeleton() {
  return (
    <div aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} style={{ borderTop: '1px solid #1C211C', paddingTop: 14, marginBottom: 44 }}>
          <div style={{ height: 22, width: 180, background: '#EBE5D6', marginBottom: 18 }} />
          <div style={{ height: 14, width: '60%', maxWidth: 520, background: '#EBE5D6', marginBottom: 22 }} />
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 16 }}>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="paper-tile" style={{ height: 118, opacity: 0.6 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
