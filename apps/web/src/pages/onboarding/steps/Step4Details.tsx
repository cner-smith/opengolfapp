import { FACILITIES, type Facility } from '@oga/core'
import { GroupLabel, OnboardingButtons, OptionList, StepHeading } from './shared'

const FREQUENCIES = [
  { value: 'monthly', label: 'About once a month' },
  { value: 'weekly', label: 'About once a week' },
  { value: 'multi_weekly', label: 'Multiple times a week' },
  { value: 'daily', label: 'Pretty much daily' },
] as const

const PLAY_STYLES = [
  { value: 'casual' as const, label: 'Casual' },
  { value: 'mixed' as const, label: 'Mixed' },
  { value: 'competitive' as const, label: 'Competitive' },
]

const FACILITY_LABEL: Record<Facility, string> = {
  range: 'Driving range',
  short_game: 'Short-game area',
  putting: 'Putting green',
  sim: 'Indoor simulator',
}

export function Step4Details({
  frequency,
  facilities,
  playStyle,
  onChange,
  onBack,
  onContinue,
}: {
  frequency: string | null
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive' | null
  onChange: (patch: Partial<{
    frequency: string | null
    facilities: Facility[]
    playStyle: 'casual' | 'mixed' | 'competitive' | null
  }>) => void
  onBack: () => void
  onContinue: () => void
}) {
  function toggleFacility(f: Facility) {
    const next = facilities.includes(f)
      ? facilities.filter((x) => x !== f)
      : [...facilities, f]
    onChange({ facilities: next })
  }

  return (
    <div>
      <StepHeading
        title="A bit about how you play"
        subtitle="Drives the practice plan and the kinds of drills you'll see."
      />

      <Field label="How often do you play or practice?">
        <OptionList
          label="How often do you play or practice?"
          options={FREQUENCIES}
          value={frequency}
          onChange={(v) => onChange({ frequency: v })}
          minWidth={200}
        />
      </Field>

      <Field label="Facilities you have access to" note="Select any that apply.">
        <div role="group" aria-label="Facilities you have access to" className="flex flex-wrap" style={{ gap: 10, paddingBottom: 3 }}>
          {FACILITIES.map((f) => {
            const active = facilities.includes(f)
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFacility(f)}
                className="key"
                style={{ padding: '0 14px' }}
              >
                <span className="font-serif" style={{ fontSize: 15, fontWeight: 500 }}>
                  {FACILITY_LABEL[f]}
                </span>
                <span aria-hidden className="font-serif" style={{ fontSize: 16, fontStyle: 'italic', width: 14, flexShrink: 0 }}>
                  {active ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="How do you usually play?">
        <OptionList
          label="How do you usually play?"
          options={PLAY_STYLES}
          value={playStyle}
          onChange={(v) => onChange({ playStyle: v })}
          minWidth={110}
        />
      </Field>

      <OnboardingButtons
        onBack={onBack}
        onContinue={onContinue}
        canContinue={frequency !== null && playStyle !== null}
      />
    </div>
  )
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 16, marginBottom: 24 }}>
      <GroupLabel>{label}</GroupLabel>
      {children}
      {note && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  )
}
