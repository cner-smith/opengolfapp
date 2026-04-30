import { Link } from 'react-router-dom'

export function DrillLibraryPage() {
  return (
    <div>
      <Link
        to="/practice"
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 18,
          display: 'inline-block',
        }}
      >
        ← Practice plan
      </Link>

      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Drill library
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          The full set
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
        >
          The drill library is seeded in Supabase and surfaces here once
          Phase 5 ships.
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
          Drills with intent.
        </h2>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 17, lineHeight: 1.55, marginTop: 14 }}
        >
          Filter by <em>category</em>, facility, and skill level. Each
          drill explains the why, the how, and the rep target — no
          gimmicks.
        </p>
      </div>
    </div>
  )
}
