import { formatHandicapIndex, playFrequencyPlan, selectBaselinePlan, type PlayFrequency } from '@oga/core'
import { useCountUp } from '../../../hooks/useCountUp'
import type { OnboardingDraft } from '../OnboardingPage'
import { bracketLabel } from './Step2Handicap'
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

const CHASING: Record<NonNullable<OnboardingDraft['goal']>, string> = {
  break_100: 'chasing 100',
  break_90: 'chasing 90',
  break_80: 'chasing 80',
  break_70s: 'chasing the 70s',
  scratch: 'chasing scratch',
}

const FACILITY_PHRASE: Record<string, string> = {
  range: 'a range',
  short_game: 'a short-game area',
  putting: 'a putting green',
  sim: 'a simulator',
}

// The one coach sentence: their answers read back, then what the first plan
// does with them (the same core calls the plan generator starts from).
function coachLine(draft: OnboardingDraft): string {
  const index = formatHandicapIndex(draft.handicap)
  // Said aloud, 8, 11 and 18 start with a vowel: "an 8.0".
  const article = /^(8|11|18)(\.|$)/.test(index) ? 'An' : 'A'
  const who = `${article} ${index}${draft.goal ? ` ${CHASING[draft.goal]}` : ''}`
  const often = draft.playFrequency ? `, ${FREQUENCY_LABEL[draft.playFrequency]?.toLowerCase()}` : ''
  const f = draft.facilities.map((x) => FACILITY_PHRASE[x] ?? x)
  const where = f.length ? `, with ${f.length > 1 ? `${f.slice(0, -1).join(', ')} and ${f[f.length - 1]}` : f[0]}` : ''
  const { sessionCount } = playFrequencyPlan(draft.playFrequency as PlayFrequency | null)
  const plan = selectBaselinePlan({ skill: draft.skillLevel, goal: draft.goal, weekIndex: 0 })
  const focus = plan.week_focus.charAt(0).toLowerCase() + plan.week_focus.slice(1)
  const sessions = sessionCount === 1 ? 'one session' : `${sessionCount} sessions`
  return `${who}${often}${where}: your first plan is ${sessions} a week, and week one is about how to ${focus}.`
}

export function Step5Summary({
  draft,
  saving,
  error,
  onBack,
  onEdit,
  onSave,
}: {
  draft: OnboardingDraft
  saving: boolean
  error: string | null
  onBack: () => void
  onEdit: (step: number) => void
  onSave: () => void
}) {
  const shown = useCountUp(draft.handicap, { duration: 600 })
  // Each answer is a row back to the step that asked it.
  const rows: [string, string, number][] = [
    ['Skill level', draft.skillLevel ? SKILL_LABEL[draft.skillLevel] : '—', 1],
    ['Goal', draft.goal ? GOAL_LABEL[draft.goal] : '—', 3],
    ['Frequency', draft.playFrequency ? FREQUENCY_LABEL[draft.playFrequency] ?? draft.playFrequency : '—', 4],
    ['Play style', draft.playStyle ? draft.playStyle.charAt(0).toUpperCase() + draft.playStyle.slice(1) : '—', 4],
    ['Facilities', draft.facilities.length ? draft.facilities.map((f) => FACILITY_LABEL[f] ?? f).join(', ') : 'None', 4],
  ]
  return (
    <div>
      <StepHeading title="Page one of your yardage book." />
      <div style={{ borderTop: '1px solid #1C211C', borderBottom: '1px solid #D9D2BF', padding: '26px 0 24px', marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => onEdit(2)}
          aria-label={`Handicap ${formatHandicapIndex(draft.handicap)}. Change it`}
          className="font-serif tabular text-caddie-ink onb-answer-hero"
          style={{ fontSize: 64, fontStyle: 'italic', fontWeight: 500, lineHeight: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          {formatHandicapIndex(shown)}
        </button>
        <div className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, marginTop: 6 }}>
          {bracketLabel(draft.handicap)}
        </div>
        <p className="font-serif text-caddie-ink onb-coach" style={{ fontSize: 19, lineHeight: 1.45, marginTop: 18 }}>
          {coachLine(draft)}
        </p>
      </div>
      <div>
        {rows.map(([label, value, step]) => (
          <button key={label} type="button" onClick={() => onEdit(step)} className="onb-answer">
            <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
              {label}
            </span>
            <span className="font-serif text-caddie-ink" style={{ fontSize: 15, fontWeight: 500, textAlign: 'right' }}>
              {value}{' '}
              <span aria-hidden className="text-caddie-ink-dim" style={{ fontStyle: 'italic' }}>
                ›
              </span>
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div
          role="alert"
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
        continueLabel="Continue"
        busy={saving}
      />
    </div>
  )
}
