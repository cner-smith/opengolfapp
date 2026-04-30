import { OnboardingButtons, StepHeading } from './shared'

function bracketLabel(handicap: number): { name: string; description: string } {
  if (handicap <= 2) return { name: 'Scratch', description: 'Bracket: 0–2 handicap' }
  if (handicap <= 7)
    return { name: 'Single digit', description: 'Bracket: 3–7 handicap' }
  if (handicap <= 12)
    return { name: 'Low double digit', description: 'Bracket: 8–12 handicap' }
  if (handicap <= 17)
    return { name: 'Mid double digit', description: 'Bracket: 13–17 handicap' }
  if (handicap <= 22) return { name: 'High teens', description: 'Bracket: 18–22 handicap' }
  if (handicap <= 27)
    return { name: 'Twenty-something', description: 'Bracket: 23–27 handicap' }
  return { name: 'New to scoring', description: 'Bracket: 28+ handicap' }
}

export function Step2Handicap({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: number
  onChange: (v: number) => void
  onBack: () => void
  onContinue: () => void
}) {
  const bracket = bracketLabel(value)
  return (
    <div>
      <StepHeading
        kicker="Handicap"
        title="What's your handicap index?"
        subtitle="It calibrates the strokes-gained baseline. No official number — your best guess is fine."
      />
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          borderBottom: '1px solid #D9D2BF',
          padding: '32px 0',
          textAlign: 'center',
          marginBottom: 22,
        }}
      >
        <div
          className="font-serif tabular text-caddie-ink"
          style={{
            fontSize: 64,
            fontStyle: 'italic',
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          className="font-serif text-caddie-ink-dim"
          style={{ fontSize: 17, marginTop: 10 }}
        >
          {bracket.name}
        </div>
        <div className="kicker" style={{ marginTop: 6 }}>
          {bracket.description}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={36}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#1F3D2C',
          marginBottom: 8,
        }}
      />
      <div
        className="font-mono uppercase tabular text-caddie-ink-mute flex justify-between"
        style={{ fontSize: 10, letterSpacing: '0.14em' }}
      >
        <span>0 SCRATCH</span>
        <span>36+</span>
      </div>
      <OnboardingButtons onBack={onBack} onContinue={onContinue} canContinue={true} />
    </div>
  )
}
