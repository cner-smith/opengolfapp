import type { SkillLevel } from '@oga/core'
import { OnboardingButtons, OptionList, StepHeading } from './shared'

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

const TITLE = 'How would you describe your golf?'

export function Step1Skill({
  value,
  onChange,
  onContinue,
}: {
  value: SkillLevel | null
  onChange: (v: SkillLevel) => void
  onContinue: () => void
}) {
  return (
    <div>
      <StepHeading
        title={TITLE}
        subtitle="We use this to calibrate strokes-gained baselines and tailor practice plans."
      />
      <OptionList label={TITLE} options={OPTIONS} value={value} onChange={onChange} />
      <OnboardingButtons
        onContinue={onContinue}
        canContinue={value !== null}
      />
    </div>
  )
}
