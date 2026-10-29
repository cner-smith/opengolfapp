import type { KeyboardEvent } from 'react'

export function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1
        tabIndex={-1}
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 8, lineHeight: 1.5 }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

// A sentence-case label over a group of keys (Step 4's three questions).
export function GroupLabel({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  )
}

// One-of-many as letterpress keys: each stands on its ledge, the pick is
// latched into the well with a ✓ (.key[aria-checked] in index.css). One tab
// stop; the arrow keys move the pick, as on New round's ChoiceRow.
export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
  minWidth,
}: {
  label: string
  options: readonly { value: T; label: string; blurb?: string }[]
  value: T | null
  onChange: (v: T) => void
  /** Lay the keys side by side, as many as fit at this width each. */
  minWidth?: number
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = i === -1 ? (step > 0 ? 0 : options.length - 1) : (i + step + options.length) % options.length
    onChange(options[next]!.value)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus()
  }
  const picked = options.some((o) => o.value === value)
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ display: 'grid', gridTemplateColumns: minWidth ? `repeat(auto-fit, minmax(${minWidth}px, 1fr))` : '1fr', gap: 10, paddingBottom: 3 }}
    >
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!picked && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className="key"
            style={{
              justifyContent: 'space-between',
              minHeight: o.blurb ? 64 : 48,
              padding: o.blurb ? '12px 16px' : '0 14px',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="font-serif" style={{ fontSize: o.blurb ? 17 : 15, fontWeight: 500 }}>
                {o.label}
              </span>
              {o.blurb && (
                <span className="text-caddie-ink-dim" style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.45 }}>
                  {o.blurb}
                </span>
              )}
            </span>
            <span aria-hidden className="font-serif" style={{ fontSize: 16, fontStyle: 'italic', width: 14, flexShrink: 0 }}>
              {active ? '✓' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function OnboardingButtons({
  onBack,
  onContinue,
  canContinue,
  continueLabel = 'Continue',
  busy = false,
}: {
  /** Absent on the first step: Continue takes the full width. */
  onBack?: () => void
  onContinue: () => void
  canContinue: boolean
  continueLabel?: string
  busy?: boolean
}) {
  return (
    <div className="flex justify-between items-center" style={{ gap: 18, marginTop: 26 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-caddie-ink-dim hover:text-caddie-ink"
          style={{ fontSize: 14, minHeight: 44, padding: '0 4px', background: 'transparent', border: 'none' }}
        >
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            ←
          </span>{' '}
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || busy}
        className="key key-primary"
        style={{
          fontSize: 15,
          letterSpacing: '0.02em',
          flex: 1,
        }}
      >
        {busy ? 'Saving…' : continueLabel}{' '}
        {!busy && (
          <span className="font-serif" style={{ fontStyle: 'italic' }}>
            →
          </span>
        )}
      </button>
    </div>
  )
}
