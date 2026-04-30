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
        kicker="Details"
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
                style={chipStyle(active)}
              >
                {FACILITY_LABEL[f]}
              </button>
            )
          })}
        </div>
        <div
          className="text-caddie-ink-mute"
          style={{ fontSize: 12, marginTop: 8 }}
        >
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
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 14,
        marginBottom: 22,
      }}
    >
      <div className="kicker" style={{ marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
  }
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
            style={chipStyle(active)}
          >
            {renderLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}
