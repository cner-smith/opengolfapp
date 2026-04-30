import { Link } from 'react-router-dom'

export function PracticePlanPage() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Today's focus
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Practice plan
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
        >
          A drill checklist that follows the math of your strokes gained,
          calibrated to your skill level and goal.
        </p>
      </div>

      <div
        className="bg-caddie-surface"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 4,
          padding: '40px 32px',
          maxWidth: 640,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Coming in phase 5
        </div>
        <h2
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 22,
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.2,
          }}
        >
          A column, not a checklist.
        </h2>
        <p
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            marginTop: 14,
          }}
        >
          Once you have logged enough rounds, this page will read you a
          short opinion: <em>where the strokes are leaking</em>, and
          three drills sized to your facilities and time.
        </p>
        <div style={{ marginTop: 22 }}>
          <Link
            to="/practice/drills"
            className="text-caddie-accent hover:opacity-80"
            style={{
              border: '1px solid #1F3D2C',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderRadius: 2,
              display: 'inline-block',
            }}
          >
            Browse drill library{' '}
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
