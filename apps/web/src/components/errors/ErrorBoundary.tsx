import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info)
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} />
    }
    return this.props.children
  }
}

// React Router v6 routes use this — its hook gives us the thrown value, no
// class component needed since the router catches the error itself.
export function RouteErrorBoundary() {
  const error = useRouteError()
  const normalized = error instanceof Error ? error : new Error(String(error))
  return <ErrorScreen error={normalized} />
}

function ErrorScreen({ error }: { error: Error }) {
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
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 38,
            color: 'var(--caddie-ink)',
            margin: 0,
          }}
        >
          Something went wrong.
        </h1>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            color: 'var(--caddie-ink-dim)',
            marginTop: 14,
            marginBottom: 22,
          }}
        >
          The page hit an unexpected error. Reloading usually clears it.
        </p>
        {import.meta.env.DEV && (
          <pre
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: 'var(--caddie-neg)',
              backgroundColor: 'var(--caddie-surface)',
              border: '1px solid var(--caddie-line)',
              borderRadius: 4,
              padding: 14,
              marginBottom: 22,
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: 240,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.28,
            backgroundColor: 'var(--caddie-accent)',
            color: 'var(--caddie-accent-ink)',
            border: 'none',
            borderRadius: 2,
            padding: '12px 16px',
            cursor: 'pointer',
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
