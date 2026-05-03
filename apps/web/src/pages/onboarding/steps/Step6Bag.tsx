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
}

export function Step6Bag({
  selected,
  onChange,
  onBack,
  onContinue,
  onSkip,
  busy,
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
        subtitle="Tap to add or remove clubs. Only the clubs in your bag will show up when logging shots. You can update this any time in settings."
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
                backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
                color: active ? '#F2EEE5' : '#1C211C',
                border: 'none',
                borderRadius: 2,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
              }}
            >
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
      <OnboardingButtons
        onBack={onBack}
        onContinue={onContinue}
        canContinue={selected.size > 0}
        continueLabel={busy ? 'Saving…' : 'Looks good'}
        busy={busy}
      />
      <button
        type="button"
        onClick={onSkip}
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{
          fontSize: 10,
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
        Skip for now →
      </button>
    </div>
  )
}
