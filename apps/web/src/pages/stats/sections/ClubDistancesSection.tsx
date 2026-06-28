import type { ClubDistanceStat } from '@oga/core'
import { formatClubLabel, YARDS_TO_METERS } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { Section } from '../components/Section'

// Per-club total distance (avg + min–max), from every tracked shot's
// start→end across the loaded rounds. Mirrors the mobile Stats section so
// both surfaces read the same @oga/core computation.
export function ClubDistancesSection({
  clubDistances,
}: {
  clubDistances: ClubDistanceStat[]
}) {
  const { unit, toDisplay } = useUnits()
  if (clubDistances.length === 0) return null
  // avg shows the unit via toDisplay; the range shows bare numbers in the same
  // unit so the row doesn't repeat "yd" three times.
  const conv = (y: number) =>
    unit === 'meters' ? Math.round(y * YARDS_TO_METERS) : Math.round(y)
  return (
    <Section kicker="Club distances">
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}
      >
        Total distance, not carry · avg (min–max)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {clubDistances.map((c) => (
          <div
            key={c.club}
            className="flex items-baseline"
            style={{ gap: 12, borderBottom: '1px solid #EBE5D6', padding: '9px 0' }}
          >
            <div
              className="font-medium text-caddie-ink capitalize"
              style={{ flex: 1, fontSize: 14 }}
            >
              {formatClubLabel({ club_type: c.club })}
            </div>
            <div
              className="font-serif text-caddie-ink"
              style={{ fontSize: 16, fontVariant: 'tabular-nums' }}
            >
              {toDisplay(c.avg)}
            </div>
            <div
              className="text-caddie-ink-dim"
              style={{ width: 96, textAlign: 'right', fontSize: 13, fontVariant: 'tabular-nums' }}
            >
              {conv(c.min)}–{conv(c.max)}
            </div>
            <div
              className="text-caddie-ink-mute"
              style={{ width: 64, textAlign: 'right', fontSize: 12 }}
            >
              {c.count} shot{c.count === 1 ? '' : 's'}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
