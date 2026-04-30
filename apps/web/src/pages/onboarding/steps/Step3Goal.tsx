import type { Goal } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

const OPTIONS: Array<{ value: Goal; label: string; blurb: string }> = [
  {
    value: 'break_100',
    label: 'Break 100',
    blurb: 'A solid round under 100 strokes is the bar.',
  },
  {
    value: 'break_90',
    label: 'Break 90',
    blurb: 'You see plenty of bogeys. Goal: turn some into pars.',
  },
  {
    value: 'break_80',
    label: 'Break 80',
    blurb: 'Single-digit golf — clean tee shots, sharp wedges.',
  },
  {
    value: 'break_70s',
    label: 'Break into the 70s',
    blurb: 'Consistent rounds in the high 70s. Make the cut.',
  },
  {
    value: 'scratch',
    label: 'Scratch and below',
    blurb: 'Tournament-ready. Every part of the game has to fire.',
  },
]

export function Step3Goal({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: Goal | null
  onChange: (v: Goal) => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div>
      <StepHeading
        kicker="Goal"
        title="What's your goal this season?"
        subtitle="The practice planner weights drills toward closing the gap to this number."
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
