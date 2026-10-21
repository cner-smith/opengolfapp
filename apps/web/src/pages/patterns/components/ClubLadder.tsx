import { useEffect, useRef } from 'react'
import { MIN_SAMPLES_FOR_STATS, clubNoun, type Club, type DistanceUnit } from '@oga/core'
import { FOCUS_RING, rovingKey } from './LayerControls'

// The club row as a yardage-book gapping chart: each cell is the club over its
// typical distance, with the gap to the next club printed on the rule between
// them. One row; on a phone it scrolls sideways and keeps the chosen club in view.
export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
  aimed,
  unit,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  /** Typical distance in the player's unit; null under five aimed shots. */
  typical: (c: Club) => number | null
  aimed: (c: Club) => number
  unit: DistanceUnit
}) {
  const row = useRef<HTMLDivElement | null>(null)
  const unitLong = unit === 'meters' ? 'metres' : 'yards'
  useEffect(() => {
    const el = row.current
    const cell = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !cell) return
    if (cell.offsetLeft < el.scrollLeft) el.scrollLeft = cell.offsetLeft - 8
    else if (cell.offsetLeft + cell.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = cell.offsetLeft + cell.offsetWidth - el.clientWidth + 8
  }, [value])

  // The widest hole between two clubs that both have a number.
  const numbered = clubs.filter((c) => typical(c) != null)
  let gap: { from: Club; to: Club; size: number } | null = null
  for (let i = 1; i < numbered.length; i++) {
    const size = typical(numbered[i - 1]!)! - typical(numbered[i]!)!
    if (!gap || size > gap.size) gap = { from: numbered[i - 1]!, to: numbered[i]!, size }
  }
  const i = clubs.indexOf(value)

  return (
    // width 0 / min-width 100%: the row scrolls inside the page instead of widening it.
    <div style={{ width: 0, minWidth: '100%' }}>
      <div
        ref={row}
        role="radiogroup"
        aria-label="Club"
        className="flex"
        style={{ overflowX: 'auto', borderTop: '1px solid #9F9580', borderLeft: '1px solid #D9D2BF', scrollbarWidth: 'thin' }}
      >
        {clubs.map((c, j) => {
          const on = c === value
          const t = typical(c)
          const n = aimed(c)
          const prev = j > 0 ? typical(clubs[j - 1]!) : null
          const label =
            t != null
              ? `${clubNoun(c)}, typical distance ${t} ${unitLong}`
              : n > 0
                ? `${clubNoun(c)}, ${n} of ${MIN_SAMPLES_FOR_STATS} aimed shots`
                : `${clubNoun(c)}, no aimed shots yet`
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              tabIndex={j === i ? 0 : -1}
              onClick={() => onChange(c)}
              onKeyDown={(e) => {
                const k = rovingKey(e, j, clubs.length)
                if (k != null) onChange(clubs[k]!)
              }}
              className={`${FOCUS_RING} focus-visible:-outline-offset-2`}
              style={{
                position: 'relative',
                flex: '1 0 54px',
                background: on ? '#1F3D2C' : 'transparent',
                color: on ? '#F2EEE5' : '#1C211C',
                border: 'none',
                borderRight: '1px solid #D9D2BF',
                borderBottom: '1px solid #D9D2BF',
                padding: '6px 4px 7px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                minHeight: 46,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: on ? 600 : 400 }}>{c === 'driver' ? 'dr' : c}</span>
              {t != null ? (
                <span className="font-serif tabular" style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.1 }}>{t}</span>
              ) : (
                <span style={{ fontSize: 12, lineHeight: 1.5, color: on ? '#F2EEE5' : '#5C6356' }}>{n > 0 ? `${n} of ${MIN_SAMPLES_FOR_STATS}` : '—'}</span>
              )}
              {t != null && prev != null && (
                <span
                  aria-hidden
                  className="font-serif tabular"
                  style={{
                    position: 'absolute',
                    left: -1,
                    bottom: 3,
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    lineHeight: 1,
                    padding: '1px 0',
                    background: '#F2EEE5',
                    color: '#5C6356',
                    zIndex: 1,
                  }}
                >
                  {prev - t}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {gap && gap.size > 25 && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 6 }}>
          {gap.size} {unit === 'meters' ? 'm' : 'yd'} between your {clubNoun(gap.from)} and {clubNoun(gap.to)}, the widest gap in the bag.
        </div>
      )}
    </div>
  )
}
