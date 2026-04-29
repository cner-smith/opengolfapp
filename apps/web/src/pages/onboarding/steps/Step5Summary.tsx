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
        title="You're set"
        subtitle="Confirm and we'll calibrate your strokes-gained baseline to these answers."
      />
      <dl
        className="bg-oga-bg-page"
        style={{
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
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
          className="bg-oga-red-light text-oga-red-dark"
          style={{
            border: '0.5px solid #E24B4A',
            borderRadius: 7,
            padding: '10px 12px',
            fontSize: 13,
            marginBottom: 14,
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
    <div className="flex justify-between" style={{ fontSize: 13 }}>
      <dt className="text-oga-text-muted">{label}</dt>
      <dd className="font-medium tabular text-oga-text-primary">{children}</dd>
    </div>
  )
}
