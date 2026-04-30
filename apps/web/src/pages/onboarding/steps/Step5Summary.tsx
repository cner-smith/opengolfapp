import type { OnboardingDraft } from '../OnboardingPage'
import { OnboardingButtons, StepHeading } from './shared'

const SKILL_LABEL: Record<NonNullable<OnboardingDraft['skillLevel']>, string> = {
  beginner: 'Just starting out',
  casual: 'Casual',
  developing: 'Developing player',
  competitive: 'Competitive amateur',
}

const GOAL_LABEL: Record<NonNullable<OnboardingDraft['goal']>, string> = {
  break_100: 'Break 100',
  break_90: 'Break 90',
  break_80: 'Break 80',
  break_70s: 'Break into the 70s',
  scratch: 'Scratch and below',
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'About once a month',
  weekly: 'About once a week',
  multi_weekly: 'Multiple times a week',
  daily: 'Pretty much daily',
}

const FACILITY_LABEL: Record<string, string> = {
  range: 'Driving range',
  short_game: 'Short-game area',
  putting: 'Putting green',
  sim: 'Indoor simulator',
}

export function Step5Summary({
  draft,
  saving,
  error,
  onBack,
  onSave,
}: {
  draft: OnboardingDraft
  saving: boolean
  error: string | null
  onBack: () => void
  onSave: () => void
}) {
  return (
    <div>
      <StepHeading
        kicker="Confirm"
        title="You're set."
        subtitle="We'll calibrate your strokes-gained baseline to these answers."
      />
      <dl style={{ borderTop: '1px solid #D9D2BF' }}>
        <Row label="Skill level">
          {draft.skillLevel ? SKILL_LABEL[draft.skillLevel] : '—'}
        </Row>
        <Row label="Handicap">{draft.handicap}</Row>
        <Row label="Goal">{draft.goal ? GOAL_LABEL[draft.goal] : '—'}</Row>
        <Row label="Frequency">
          {draft.playFrequency ? FREQUENCY_LABEL[draft.playFrequency] ?? draft.playFrequency : '—'}
        </Row>
        <Row label="Play style">
          {draft.playStyle
            ? draft.playStyle.charAt(0).toUpperCase() + draft.playStyle.slice(1)
            : '—'}
        </Row>
        <Row label="Facilities">
          {draft.facilities.length > 0
            ? draft.facilities.map((f) => FACILITY_LABEL[f] ?? f).join(', ')
            : 'None selected'}
        </Row>
      </dl>
      {error && (
        <div
          className="text-caddie-neg"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 2,
            padding: '12px 14px',
            fontSize: 13,
            marginTop: 18,
          }}
        >
          {error}
        </div>
      )}
      <OnboardingButtons
        onBack={onBack}
        onContinue={onSave}
        canContinue={
          draft.skillLevel !== null &&
          draft.goal !== null &&
          draft.playFrequency !== null &&
          draft.playStyle !== null
        }
        continueLabel="Start tracking"
        busy={saving}
      />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{
        padding: '14px 0',
        borderBottom: '1px solid #D9D2BF',
        gap: 18,
      }}
    >
      <dt className="kicker">{label}</dt>
      <dd
        className="font-serif text-caddie-ink text-right"
        style={{ fontSize: 17, fontWeight: 500 }}
      >
        {children}
      </dd>
    </div>
  )
}
