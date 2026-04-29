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
        title="What's your handicap index?"
        subtitle="It calibrates the strokes-gained baseline. Don't have one — your best guess is fine."
      />
      <div
        className="bg-oga-bg-page text-center"
        style={{
          borderRadius: 8,
          padding: '20px 16px',
          marginBottom: 16,
        }}
      >
        <div
          className="tabular text-oga-text-primary"
          style={{ fontSize: 36, fontWeight: 500, lineHeight: 1 }}
        >
          {value}
        </div>
        <div
          className="text-oga-green-dark"
          style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}
        >
          {bracket.name}
        </div>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 11, marginTop: 2 }}
        >
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
          accentColor: '#1D9E75',
          marginBottom: 8,
        }}
      />
      <div
        className="text-oga-text-muted flex justify-between"
        style={{ fontSize: 11, marginBottom: 18 }}
      >
        <span>0 (scratch)</span>
        <span>36+</span>
      </div>
      <OnboardingButtons onBack={onBack} onContinue={onContinue} canContinue={true} />
    </div>
  )
}
