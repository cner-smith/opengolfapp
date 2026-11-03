import { DEFAULT_BAG } from '@oga/core'
import { OnboardingButtons, StepHeading } from './shared'

// Four rows, as the bag is packed: DEFAULT_BAG's sort_order, top of the bag down.
const GROUPS = [
  { label: 'Woods and hybrids', from: 0, to: 3 },
  { label: 'Irons', from: 4, to: 8 },
  { label: 'Wedges', from: 9, to: 12 },
  { label: 'Putter', from: 13, to: 13 },
]

interface Step6BagProps {
  /** Set of canonical club_type strings the user has chosen to keep
   *  in their bag. Starts populated with all DEFAULT_BAG entries; user
   *  toggles off the ones they don't carry. */
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  onBack: () => void
  onContinue: () => void
  busy: boolean
  error: string | null
}

export function Step6Bag({
  selected,
  onChange,
  onBack,
  onContinue,
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
        subtitle="Every club stands in the bag. Press one you don't carry to take it out; add your own later in My bag."
      />
      {GROUPS.map((g) => (
        <div key={g.label} style={{ marginBottom: 14 }}>
          <div id={`bag-${g.from}`} className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>
            {g.label}
          </div>
          <div role="group" aria-labelledby={`bag-${g.from}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingBottom: 3 }}>
            {DEFAULT_BAG.filter((c) => c.sort_order >= g.from && c.sort_order <= g.to).map((c) => (
              <button
                key={c.club_type}
                type="button"
                onClick={() => toggle(c.club_type)}
                aria-pressed={selected.has(c.club_type)}
                className="key onb-club"
                style={{ minHeight: 40, padding: '0 14px', fontSize: 13, fontWeight: 500 }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="text-caddie-ink" style={{ marginTop: 18, fontSize: 14 }}>
        <span
          key={selected.size}
          className="font-serif tabular onb-tick"
          style={{ display: 'inline-block', fontSize: 17, fontStyle: 'italic', fontWeight: 500 }}
        >
          {selected.size}
        </span>{' '}
        of {DEFAULT_BAG.length} in the bag
      </div>
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
        // Even zero selected is a valid "Looks good": it leaves the bag
        // empty, and useUserBag falls back to DEFAULT_BAG. The earlier
        // `selected.size > 0` gate looked like the button was broken.
        canContinue={true}
        continueLabel={busy ? 'Saving…' : 'Looks good'}
        busy={busy}
      />
    </div>
  )
}
