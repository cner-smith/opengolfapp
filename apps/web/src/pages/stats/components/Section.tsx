import type { CSSProperties, ReactNode } from 'react'

export function Section({
  title,
  children,
}: {
  title: string
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
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2, marginBottom: 12 }}
      >
        {title}
      </h2>
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
    <h3 className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, ...style }}>
      {children}
    </h3>
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
