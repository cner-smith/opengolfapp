export function StepHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1
        className="text-oga-text-primary"
        style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
      >
        {title}
      </h1>
      {subtitle && (
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 4 }}
        >
          {subtitle}
        </div>
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
    <div className="flex justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        className="bg-oga-bg-card text-oga-text-primary transition-colors hover:bg-oga-bg-input"
        style={{
          border: '0.5px solid #E4E4E0',
          borderRadius: 10,
          padding: '12px 18px',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Back
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || busy}
        className="bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-40"
        style={{
          borderRadius: 10,
          padding: '12px 22px',
          fontSize: 13,
          fontWeight: 500,
          flex: 1,
        }}
      >
        {busy ? 'Saving…' : continueLabel}
      </button>
    </div>
  )
}
