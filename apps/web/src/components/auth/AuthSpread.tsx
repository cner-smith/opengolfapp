import { cloneElement, useId, useState, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { PhoneShot } from '../landing/PhoneShot'
import { Wordmark } from '../landing/Wordmark'
import '../landing/landing.css'

// Sign in, sign up and password reset as an open book: the form on the left
// page under the wordmark, and on a wide screen the landing's Home screen on
// the right page, so the page reads as the same book the visitor came from.
// The landing hero's phone, its arrow on the sentence as there (#1256).
const HOME = (
  <PhoneShot
    src="/landing/home.webp"
    alt=""
    tag={{ text: <>the one<br />sentence</>, left: 186, top: 24, width: 96 }}
    arrow={[262, 72, 262, 160]}
  />
)

export function AuthSpread({ children }: { children: ReactNode }) {
  return (
    <div className="bg-caddie-bg text-caddie-ink" style={{ minHeight: '100vh' }}>
      <main className="auth-spread">
        <div className="auth-form lb-rise">
          <div className="auth-wordmark">
            <Wordmark />
          </div>
          {children}
          {/* A phone loses the figure at right: its top third, clipped on a hairline. */}
          <figure className="auth-peek lb-phone-in" aria-hidden>
            <div className="auth-peek-crop">{HOME}</div>
            <figcaption className="lb-caption">Home, after 15 rounds</figcaption>
          </figure>
        </div>
        <div className="auth-fold" aria-hidden />
        <figure className="auth-figure lb-figure lb-phone-in" aria-hidden>
          {HOME}
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
        id="auth-title"
        tabIndex={-1}
        className="font-serif text-caddie-ink outline-none"
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

// The label points at the input by id, so the input can sit inside a
// wrapper (PasswordInput) instead of the label.
export function AuthField({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 6 }}>
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  )
}

// A password field with a Show key inside its right edge (sign in, sign up, reset).
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)
  return (
    <div className="auth-pw">
      <input {...props} type={shown ? 'text' : 'password'} className="auth-input" />
      <button type="button" className="auth-pw-toggle" aria-pressed={shown} aria-label="Show password" onClick={() => setShown((v) => !v)}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
