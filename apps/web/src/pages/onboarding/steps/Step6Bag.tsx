import { DEFAULT_BAG } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

interface Step6BagProps {
  /** Set of canonical club_type strings the user has chosen to keep
   *  in their bag. Starts populated with all DEFAULT_BAG entries; user
   *  toggles off the ones they don't carry. */
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  onBack: () => void
  onContinue: () => void
  onSkip: () => void
  busy: boolean
  error: string | null
}

export function Step6Bag({
  selected,
  onChange,
  onBack,
  onContinue,
  onSkip,
  busy,
  error,
}: Step6BagProps) {
  function toggle(clubType: string) {
    const next = new Set(selected)
    if (next.has(clubType)) next.delete(clubType)
    else next.add(clubType)
    onChange(next)
  }

  return (
    <div>
      <StepHeading
        kicker="Optional"
        title="Build your bag."
        subtitle="Standard bags carry up to 14 clubs. Select what you carry — tap to toggle. You can customise your bag fully in settings later."
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 4,
        }}
      >
        {DEFAULT_BAG.map((c) => {
          const active = selected.has(c.club_type)
          return (
            <button
              key={c.club_type}
              type="button"
              onClick={() => toggle(c.club_type)}
              aria-pressed={active}
              style={{
                // Outline style for unselected, filled accent + leading
                // checkmark for selected — gives an obvious binary read
                // at a glance instead of "two shades of green".
                backgroundColor: active ? '#1F3D2C' : 'transparent',
                color: active ? '#F2EEE5' : '#5C6356',
                border: active ? '1px solid #1F3D2C' : '1px solid #D9D2BF',
                borderRadius: 2,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 12,
                  fontSize: 12,
                  lineHeight: 1,
                  textAlign: 'center',
                }}
              >
                {active ? '✓' : ''}
              </span>
              {c.name}
            </button>
          )
        })}
      </div>
      <div
        className="kicker"
        style={{ marginTop: 22, color: '#8A8B7E' }}
      >
        {selected.size} of {DEFAULT_BAG.length} selected
      </div>
      <p
        className="text-caddie-ink-mute"
        style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}
      >
        You can add custom clubs and reorder your bag any time in
        Settings → My Bag.
      </p>
      {error && (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 13,
            marginTop: 14,
          }}
        >
          {error}
        </div>
      )}
      <OnboardingButtons
        onBack={onBack}
        onContinue={onContinue}
        // The bag step is optional — even zero selected is a valid
        // "Looks good" (it just leaves the bag empty, equivalent to
        // skipping). The earlier `selected.size > 0` gate looked like
        // the button was broken when the user trimmed everything.
        canContinue={true}
        continueLabel={busy ? 'Saving…' : 'Looks good'}
        busy={busy}
      />
      <button
        type="button"
        onClick={onSkip}
        className="font-mono uppercase text-caddie-ink-dim hover:text-caddie-ink"
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          padding: '14px 0 0',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'center',
          display: 'block',
        }}
        disabled={busy}
      >
        Set up later →
      </button>
    </div>
  )
}
