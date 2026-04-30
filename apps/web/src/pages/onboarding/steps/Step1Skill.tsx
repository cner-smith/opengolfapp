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
    blurb: 'Tournaments, club championships, single-digit territory.',
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
        kicker="Skill"
        title="How would you describe your golf?"
        subtitle="We use this to calibrate strokes-gained baselines and tailor practice plans."
      />
      <div role="radiogroup" style={{ borderTop: '1px solid #D9D2BF' }}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className="text-left transition-colors w-full"
              style={{
                backgroundColor: active ? '#FBF8F1' : 'transparent',
                borderBottom: '1px solid #D9D2BF',
                padding: '18px 14px',
                display: 'block',
              }}
            >
              <div className="flex items-baseline justify-between">
                <div
                  className="font-serif text-caddie-ink"
                  style={{ fontSize: 17, fontWeight: 500 }}
                >
                  {opt.label}
                </div>
                {active && (
                  <span
                    className="font-mono uppercase text-caddie-accent"
                    style={{ fontSize: 10, letterSpacing: '0.14em' }}
                  >
                    Selected
                  </span>
                )}
              </div>
              <div
                className="text-caddie-ink-dim"
                style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}
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
