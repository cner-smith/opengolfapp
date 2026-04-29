import type { SkillLevel } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

interface Option {
  value: SkillLevel
  label: string
  blurb: string
}

const OPTIONS: Option[] = [
  {
    value: 'beginner',
    label: 'Just starting out',
    blurb: 'Less than 6 months in. Still learning the basics.',
  },
  {
    value: 'casual',
    label: 'Casual',
    blurb: 'You play for fun a few times a year, not chasing a number.',
  },
  {
    value: 'developing',
    label: 'Developing player',
    blurb: 'Working on your game, watching the handicap drop.',
  },
  {
    value: 'competitive',
    label: 'Competitive amateur',
    blurb: 'Tournaments, club championships, single-digit handicap territory.',
  },
]

export function Step1Skill({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: SkillLevel | null
  onChange: (v: SkillLevel) => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div>
      <StepHeading
        title="How would you describe your golf?"
        subtitle="We'll use this to calibrate strokes-gained baselines and practice plans."
      />
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        style={{ marginBottom: 18 }}
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className="text-left transition-colors"
              style={{
                backgroundColor: active ? '#E1F5EE' : '#FFFFFF',
                border: `0.5px solid ${active ? '#1D9E75' : '#E4E4E0'}`,
                color: active ? '#0F6E56' : '#111111',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 2,
                }}
              >
                {opt.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: active ? '#0F6E56' : '#888880',
                }}
              >
                {opt.blurb}
              </div>
            </button>
          )
        })}
      </div>
      <OnboardingButtons
        onBack={onBack}
        onContinue={onContinue}
        canContinue={value !== null}
      />
    </div>
  )
}
