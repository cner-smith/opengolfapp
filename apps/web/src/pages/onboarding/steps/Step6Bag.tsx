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
        title="Build your bag."
        subtitle="Standard bags carry up to 14 clubs. Press a club to take it out or put it back. You can customise your bag fully in settings later."
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 4,
          paddingBottom: 3,
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
              className="key"
              style={{ minHeight: 40, padding: '0 12px', fontSize: 13, fontWeight: 500, gap: 6 }}
            >
              <span aria-hidden className="font-serif" style={{ display: 'inline-block', width: 10, fontStyle: 'italic' }}>
                {active ? '✓' : ''}
              </span>
              {c.name}
            </button>
          )
        })}
      </div>
      <div className="text-caddie-ink" style={{ marginTop: 22, fontSize: 14 }}>
        <span className="font-serif tabular" style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 500 }}>
          {selected.size}
        </span>{' '}
        of {DEFAULT_BAG.length} in the bag
      </div>
      <p
        className="text-caddie-ink-dim"
        style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}
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
        className="text-caddie-ink-dim hover:text-caddie-ink"
        style={{
          fontSize: 14,
          minHeight: 44,
          marginTop: 8,
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
