export function StepHeading({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      {kicker && <div className="kicker" style={{ marginBottom: 8 }}>{kicker}</div>}
      <h1
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

export function OnboardingButtons({
  onBack,
  onContinue,
  canContinue,
  continueLabel = 'Continue',
  busy = false,
}: {
  onBack: () => void
  onContinue: () => void
  canContinue: boolean
  continueLabel?: string
  busy?: boolean
}) {
  return (
    <div className="flex justify-between" style={{ gap: 12, marginTop: 22 }}>
      <button
        type="button"
        onClick={onBack}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
        }}
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || busy}
        className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
        style={{
          borderRadius: 2,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 600,
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
