import type { ClubDistanceStat } from '@oga/core'
import { formatClubLabel, YARDS_TO_METERS } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { Section } from '../components/Section'

// Per-club typical distance (avg + shortest–longest), from every tracked
// shot's start→end across the loaded rounds. Mirrors the mobile Stats section
// so both surfaces read the same @oga/core computation. Drawn as a yardage
// book: each club's spread on one shared scale, its average as a mark.
export function ClubDistancesSection({
  clubDistances,
}: {
  clubDistances: ClubDistanceStat[]
}) {
  const { unit, toDisplay } = useUnits()
  if (clubDistances.length === 0) return null
  const conv = (y: number) =>
    unit === 'meters' ? Math.round(y * YARDS_TO_METERS) : Math.round(y)
  // A yardage scale in steps of 50 that just holds every club's spread.
  const lo = Math.max(0, Math.floor(Math.min(...clubDistances.map((c) => c.min)) / 50) * 50)
  const hi = Math.max(lo + 50, Math.ceil(Math.max(...clubDistances.map((c) => c.max)) / 50) * 50)
  const at = (y: number) => `${((y - lo) / (hi - lo)) * 100}%`
  const ticks = Array.from({ length: (hi - lo) / 50 + 1 }, (_, i) => lo + i * 50)
  const cols = 'clamp(60px, 14vw, 130px) minmax(0, 1fr) 72px'
  return (
    <Section title="Club distances">
      <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, fontStyle: 'italic', margin: '-4px 0 14px', maxWidth: 640 }}>
        Typical distance: where the ball finished. The mark is your average; the line runs from your shortest to your longest.
      </p>
      <div className="grid" aria-hidden style={{ gridTemplateColumns: cols, gap: 16, paddingBottom: 6 }}>
        <span />
        <div style={{ position: 'relative', height: 14 }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="tabular text-caddie-ink-mute"
              style={{ position: 'absolute', left: at(t), transform: 'translateX(-50%)', fontSize: 11 }}
            >
              {conv(t)}
            </span>
          ))}
        </div>
        <span />
      </div>
      <div style={{ borderTop: '1px solid #1C211C' }}>
        {clubDistances.map((c, i) => (
          <div
            key={c.club}
            className="grid items-center"
            style={{
              gridTemplateColumns: cols,
              gap: 16,
              borderBottom: '1px solid #E4DCC8',
              padding: '10px 0',
            }}
          >
            <div>
              <div className="text-caddie-ink" style={{ fontSize: 15 }}>
                {formatClubLabel({ club_type: c.club }).replace(/^[a-z]{3,}/, (w) => w.charAt(0).toUpperCase() + w.slice(1))}
              </div>
              <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
                {c.count} shot{c.count === 1 ? '' : 's'}
              </div>
            </div>
            <div aria-hidden style={{ position: 'relative', height: 22 }}>
              {ticks.map((t) => (
                <div key={t} style={{ position: 'absolute', left: at(t), top: -10, bottom: -10, width: 1, background: '#E4DCC8' }} />
              ))}
              <div
                className="st-grow"
                style={{
                  position: 'absolute',
                  top: 8,
                  height: 7,
                  left: at(c.min),
                  width: `${((c.max - c.min) / (hi - lo)) * 100}%`,
                  background: '#D9D2BF',
                  borderLeft: '1px solid #8A8B7E',
                  borderRight: '1px solid #8A8B7E',
                  transformOrigin: 'left',
                  animationDelay: `${i * 30}ms`,
                }}
              />
              <div
                className="st-rise"
                style={{
                  position: 'absolute',
                  top: 2,
                  height: 18,
                  width: 3,
                  marginLeft: -1,
                  left: at(c.avg),
                  background: '#1C211C',
                  animationDelay: `${120 + i * 30}ms`,
                }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-serif tabular text-caddie-ink" style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.1 }}>
                {toDisplay(c.avg)}
              </div>
              <div className="tabular text-caddie-ink-mute" style={{ fontSize: 11 }}>
                {conv(c.min)}–{conv(c.max)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
