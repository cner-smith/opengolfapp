import type { Goal } from '@oga/core'
import { OnboardingButtons, OptionList, StepHeading } from './shared'

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

const TITLE = "What's your goal this season?"

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
        title={TITLE}
        subtitle="The practice planner weights drills toward closing the gap to this number."
      />
      <OptionList label={TITLE} options={OPTIONS} value={value} onChange={onChange} />
      <OnboardingButtons
        onBack={onBack}
        onContinue={onContinue}
        canContinue={value !== null}
      />
    </div>
  )
}
