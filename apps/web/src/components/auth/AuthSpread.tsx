import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { PhoneShot } from '../landing/PhoneShot'
import { Wordmark } from '../landing/Wordmark'
import '../landing/landing.css'

// Sign in, sign up and password reset: the form on the paper at left, and
// on a wide screen the landing's Home screen at right, so the page reads as
// the same book the visitor just came from.
export function AuthSpread({ children }: { children: ReactNode }) {
  return (
    <div className="bg-caddie-bg text-caddie-ink" style={{ minHeight: '100vh' }}>
      <div className="auth-top">
        <Wordmark />
      </div>
      <main className="auth-spread">
        <div className="auth-form lb-rise">{children}</div>
        <figure className="auth-figure lb-figure lb-phone-in" aria-hidden>
          <PhoneShot
            src="/landing/home.webp"
            alt=""
            tag={{ text: <>the one<br />sentence</>, left: 186, top: 24, width: 96 }}
            arrow={[238, 70, 250, 152]}
          />
          <figcaption className="lb-caption">Home, after 15 rounds</figcaption>
        </figure>
      </main>
    </div>
  )
}

export function AuthTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 38, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.08, letterSpacing: '-0.02em' }}
      >
        {children}
      </h1>
      {sub && (
        <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 18, lineHeight: 1.5, marginTop: 10 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// The label row can carry a link at its right (Forgot password?), so the
// label points at the input by id instead of wrapping it.
export function AuthField({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactElement<{ id?: string }> }) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 6 }}>
        <label htmlFor={id} className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          {label}
        </label>
        {aside}
      </div>
      {cloneElement(children, { id })}
    </div>
  )
}
