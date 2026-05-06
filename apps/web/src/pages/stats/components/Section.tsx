import type { CSSProperties, ReactNode } from 'react'

export function Section({
  kicker,
  children,
}: {
  kicker: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 18 }}>
        {kicker}
      </div>
      {children}
    </section>
  )
}

export function Subkicker({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className="kicker"
      style={{
        marginBottom: 12,
        color: '#5C6356',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Insufficient({ note }: { note: string }) {
  return (
    <div
      className="text-caddie-ink-mute"
      style={{
        border: '1px dashed #D9D2BF',
        borderRadius: 4,
        padding: '18px 22px',
        fontSize: 13,
      }}
    >
      {note}
    </div>
  )
}

export function EmptyState() {
  return (
    <div
      className="bg-caddie-surface text-center"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 4,
        padding: '40px 24px',
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500 }}
      >
        No rounds in this window.
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 15, marginTop: 8, maxWidth: 360, marginInline: 'auto' }}
      >
        Finalize a round to see the full breakdown — strokes gained,
        scoring, ball striking, short game, and patterns.
      </div>
    </div>
  )
}

export function Skeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            borderTop: '1px solid #D9D2BF',
            paddingTop: 18,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              height: 10,
              width: 120,
              background: '#EBE5D6',
              marginBottom: 18,
            }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14 }}>
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                style={{
                  border: '1px solid #D9D2BF',
                  background: '#FBF8F1',
                  borderRadius: 4,
                  padding: 18,
                  height: 96,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
