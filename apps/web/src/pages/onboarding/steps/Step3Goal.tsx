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
        title="What's your goal this season?"
        subtitle="The practice planner weights drills toward closing the gap to this number."
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
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500 }}>{opt.label}</div>
              <div
                style={{
                  fontSize: 12,
                  color: active ? '#0F6E56' : '#888880',
                  marginTop: 2,
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
