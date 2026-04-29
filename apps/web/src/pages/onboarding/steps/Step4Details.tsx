import { FACILITIES, type Facility } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

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
        <ChipGroup
          options={FREQUENCIES.map((f) => f.value)}
          value={frequency}
          onChange={(v) => onChange({ frequency: v })}
          renderLabel={(v) => FREQUENCIES.find((f) => f.value === v)?.label ?? v}
        />
      </Field>

      <Field label="Facilities you have access to">
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {FACILITIES.map((f) => {
            const active = facilities.includes(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFacility(f)}
                style={{
                  backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
                  color: active ? '#0F6E56' : '#111111',
                  border: `0.5px solid ${active ? '#1D9E75' : '#E0E0DA'}`,
                  borderRadius: 7,
                  padding: '7px 10px',
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                }}
              >
                {FACILITY_LABEL[f]}
              </button>
            )
          })}
        </div>
        <div className="text-oga-text-muted" style={{ fontSize: 11, marginTop: 6 }}>
          Select any that apply.
        </div>
      </Field>

      <Field label="How do you usually play?">
        <ChipGroup
          options={PLAY_STYLES.map((p) => p.value)}
          value={playStyle}
          onChange={(v) =>
            onChange({ playStyle: v as 'casual' | 'mixed' | 'competitive' | null })
          }
          renderLabel={(v) => PLAY_STYLES.find((p) => p.value === v)?.label ?? v}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="text-oga-text-muted uppercase"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 0.4,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

interface ChipGroupProps<T extends string> {
  options: readonly T[]
  value: T | null
  onChange: (v: T) => void
  renderLabel: (v: T) => string
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
}: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
              color: active ? '#0F6E56' : '#111111',
              border: `0.5px solid ${active ? '#1D9E75' : '#E0E0DA'}`,
              borderRadius: 7,
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: active ? 500 : 400,
            }}
          >
            {renderLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}
