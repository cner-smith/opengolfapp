import { useEffect, useId, useMemo, useState } from 'react'
import { DEFAULT_BAG, YARDS_TO_METERS, bagGaps, clubNoun, distanceUnitAbbr, wholeDistance, type DistanceUnit } from '@oga/core'
import { GapChart, type BagRung } from '../../pages/settings/GapChart'
import { FOCUS_RING } from '../../pages/patterns/components/LayerControls'

// The landing page's "Try yours": My Bag's own gapping chart and headline on
// a bag the visitor types. Nothing leaves the page (no storage, no network).
// Lazy-loaded so it never holds up the headline.

const MAX_YARDS = 400
// A mid-handicap's typical distances, every gap under 20 yd.
const EXAMPLE: Record<string, number> = {
  driver: 228,
  '3w': 212,
  '5w': 197,
  '5h': 184,
  '5i': 173,
  '6i': 163,
  '7i': 152,
  '8i': 141,
  '9i': 130,
  pw: 119,
  gw: 105,
  sw: 91,
  lw: 76,
}
const CLUBS = DEFAULT_BAG.filter((c) => c.club_type !== 'putter').map((c, i) => {
  const noun = clubNoun(c.club_type)
  return { type: c.club_type, label: noun[0]!.toUpperCase() + noun.slice(1), order: i }
})

interface Entry {
  /** Yards, unrounded so a metres round trip doesn't drift; null = no number. */
  yards: number | null
  inBag: boolean
}
const fresh = (): Record<string, Entry> =>
  Object.fromEntries(CLUBS.map((c) => [c.type, { yards: EXAMPLE[c.type]!, inBag: true }]))

const UNITS: { value: DistanceUnit; label: string }[] = [
  { value: 'yards', label: 'Yards' },
  { value: 'meters', label: 'Metres' },
]

export default function LadderDemo() {
  const [bag, setBag] = useState(fresh)
  const [unit, setUnit] = useState<DistanceUnit>('yards')
  const [edited, setEdited] = useState(false)
  const [announce, setAnnounce] = useState('')
  const titleId = useId()
  const u = distanceUnitAbbr(unit)
  const unitLong = unit === 'meters' ? 'metres' : 'yards'
  const max = wholeDistance(MAX_YARDS, unit)

  const gaps = useMemo(() => {
    const rungs: BagRung[] = CLUBS.filter((c) => bag[c.type]!.inBag).map((c) => {
      const yards = bag[c.type]!.yards
      return {
        clubType: c.type,
        typical: yards == null ? null : { yards, source: 'estimate' },
        range: null,
        club: {
          id: c.type,
          club_type: c.type,
          name: c.label,
          loft: null,
          in_bag: true,
          sort_order: c.order,
          typical_distance_yards: yards,
          user_id: '',
          created_at: '',
        },
      }
    })
    return bagGaps(rungs, unit)
  }, [bag, unit])

  // Read the new headline once typing settles, not on every keystroke; only
  // after an edit, so the page doesn't read it twice on arrival.
  const said = gaps.headline ?? 'Give two clubs a typical distance and the gaps between them show here.'
  useEffect(() => {
    if (!edited) return setAnnounce('')
    const t = setTimeout(() => setAnnounce(said), 700)
    return () => clearTimeout(t)
  }, [said, edited])

  const change = (type: string, patch: Partial<Entry>) => {
    setBag((b) => ({ ...b, [type]: { ...b[type]!, ...patch } }))
    setEdited(true)
  }
  const type = (club: string, text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 3)
    if (!digits) return change(club, { yards: null })
    const n = Math.min(Number(digits), max)
    change(club, { yards: unit === 'meters' ? n / YARDS_TO_METERS : n })
  }

  return (
    <div>
      <div className="lb-ladder-top">
        <div className="lb-ladder-head">
          <h3 id={titleId} className="font-serif lb-ladder-title">
            Try yours.
          </h3>
          {edited ? null : <span className="lb-stamp">Example</span>}
        </div>
        <div className="lb-ladder-tools">
          <div role="group" aria-label="Units" className="lb-seg">
            {UNITS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={unit === o.value}
                onClick={() => setUnit(o.value)}
                className={FOCUS_RING}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`lb-reset ${FOCUS_RING}`}
            disabled={!edited}
            onClick={() => {
              setBag(fresh())
              setEdited(false)
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="lb-ladder-grid">
        <ul className="lb-rungs" aria-labelledby={titleId}>
          {CLUBS.map((c) => {
            const e = bag[c.type]!
            const inputId = `${titleId}-${c.type}`
            return (
              <li key={c.type} className={e.inBag ? 'lb-rung' : 'lb-rung lb-rung-out'}>
                <label htmlFor={inputId} className="lb-rung-name">
                  {c.label}
                  <span className="sr-only">{` typical distance, ${unitLong}`}</span>
                </label>
                <span className="lb-rung-num">
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={3}
                    disabled={!e.inBag}
                    value={e.yards == null ? '' : String(wholeDistance(e.yards, unit))}
                    onChange={(ev) => type(c.type, ev.target.value)}
                    className={`font-serif tabular ${FOCUS_RING}`}
                  />
                  <span aria-hidden className="lb-rung-unit">
                    {u}
                  </span>
                </span>
                <button
                  type="button"
                  aria-pressed={e.inBag}
                  aria-label={`${c.label} in the bag`}
                  onClick={() => change(c.type, { inBag: !e.inBag })}
                  className={`lb-inbag ${FOCUS_RING}`}
                >
                  <span aria-hidden className="lb-inbag-box">
                    {e.inBag ? '✓' : ''}
                  </span>
                  In the bag
                </button>
              </li>
            )
          })}
        </ul>
        <div className="lb-ladder-chart">
          <GapChart bag={gaps} unit={unit} example />
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          <p className="lb-ladder-note">{`Up to ${max} ${u} a club. Clear a number to leave the club without one.`}</p>
        </div>
      </div>
    </div>
  )
}
