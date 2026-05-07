// Stub. Real content lands in a follow-up commit ("feat: landing page
// with app preview").
export function LandingPage() {
  return (
    <main style={{ paddingTop: 140, minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 28px',
        }}
      >
        <h1
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 56,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          OGA
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 16, marginTop: 12 }}
        >
          Open Golf App.
        </p>
      </div>
    </main>
  )
}
