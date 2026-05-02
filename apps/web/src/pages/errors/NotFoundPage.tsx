import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--caddie-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--caddie-ink-mute)',
            marginBottom: 14,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 38,
            color: 'var(--caddie-ink)',
            margin: 0,
            letterSpacing: '-0.015em',
          }}
        >
          Page not found.
        </h1>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            color: 'var(--caddie-ink-dim)',
            marginTop: 14,
            marginBottom: 22,
            lineHeight: 1.5,
          }}
        >
          The page you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.28,
            backgroundColor: 'var(--caddie-accent)',
            color: 'var(--caddie-accent-ink)',
            border: 'none',
            borderRadius: 2,
            padding: '12px 18px',
            cursor: 'pointer',
          }}
        >
          ← Back to dashboard
        </button>
      </div>
    </div>
  )
}
