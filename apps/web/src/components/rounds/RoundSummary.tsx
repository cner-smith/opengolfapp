import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  formatSG,
  formatToPar,
  pickRoundFocus,
  roundFocusHeadline,
  selectNudgeDrills,
  type RoundFocus,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { useProfile } from '../../hooks/useProfile'
import { useDrills } from '../../hooks/useDrills'

type RoundRow = Database['public']['Tables']['rounds']['Row']

/** One scored hole: its number, the score and the tee-resolved par. */
export interface ScoredHole {
  number: number
  score: number
  par: number
}

const SG_ROWS = [
  { key: 'sg_off_tee', label: 'Off the tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around the green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

const NEG = '#A33A2A'
const INK35 = 'rgba(28,33,28,.35)'
const sg = (n: number | null | undefined) => (n == null ? '—' : formatSG(n))
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const strokes = (n: number) => `${WORDS[n] ?? n} stroke${n === 1 ? '' : 's'}`

// Round totals, flat on the paper as on the phone (#611 §19.7): the score at
// hero size with to-par beside it and SG on the right, one line on the best
// and worst holes, then the four SG categories as diverging bars.
export function RoundTotals({
  round,
  scored,
  handicap,
}: {
  round: RoundRow
  scored: ScoredHole[]
  handicap: number | null
}) {
  const score = scored.reduce((s, h) => s + h.score, 0)
  const par = scored.reduce((s, h) => s + h.par, 0)
  let best: ScoredHole | undefined
  let worst: ScoredHole | undefined
  for (const h of scored) {
    if (!best || h.score - h.par < best.score - best.par) best = h
    if (!worst || h.score - h.par > worst.score - worst.par) worst = h
  }
  const bestDiff = best ? best.score - best.par : 0
  const worstDiff = worst ? worst.score - worst.par : 0
  const values = SG_ROWS.map((r) => round[r.key])
  const max = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)))

  return (
    <section
      aria-label="Round totals"
      className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      style={{ columnGap: 56, rowGap: 22 }}
    >
      <div>
        <div className="flex items-end">
          <span
            className="font-serif italic tabular"
            style={{
              fontSize: 'clamp(56px, 7vw, 76px)',
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              color: par === 0 ? INK35 : '#1C211C',
            }}
          >
            {par === 0 ? '—' : score}
          </span>
          <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 6 }}>
            {par > 0 && (
              <>
                <div className="font-serif italic tabular text-caddie-ink" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.1 }}>
                  {formatToPar(score - par)}
                </div>
                <div className="text-caddie-ink" style={{ fontSize: 13 }}>
                  to par · {par}
                </div>
              </>
            )}
          </div>
          <div className="text-right" style={{ paddingBottom: 6 }}>
            <div
              className="font-serif italic tabular"
              style={{
                fontSize: 24,
                fontWeight: 500,
                lineHeight: 1.1,
                color: round.sg_total == null ? INK35 : round.sg_total < 0 ? NEG : '#1C211C',
              }}
            >
              {sg(round.sg_total)}
            </div>
            <div className="text-caddie-ink" style={{ fontSize: 13, lineHeight: 1.25 }}>
              strokes gained
              {handicap != null && (
                <>
                  <br />
                  vs a {handicap} handicap
                </>
              )}
            </div>
          </div>
        </div>
        {best && worst && worstDiff > bestDiff && (
          <p className="font-serif text-caddie-ink" style={{ fontSize: 18, lineHeight: 1.5, marginTop: 18, maxWidth: 460 }}>
            <em style={{ fontWeight: 500 }}>Hole {best.number}</em> was your best ({formatToPar(bestDiff)});{' '}
            {worstDiff > 0 ? (
              <>
                <em style={{ fontWeight: 500 }}>hole {worst.number}</em> cost you {strokes(worstDiff)}.
              </>
            ) : (
              <>nothing went over par.</>
            )}
          </p>
        )}
      </div>

      <div style={{ borderTop: '1px solid #1C211C' }}>
        {SG_ROWS.map((r, i) => (
          <SGBarRow key={r.key} label={r.label} value={values[i] ?? null} max={max} />
        ))}
      </div>
    </section>
  )
}

// Diverging SG bar (DESIGN.md): a hairline track with a centre tick, forest
// to the right, brick to the left, the figure in Fraunces italic at the end.
function SGBarRow({ label, value, max }: { label: string; value: number | null; max: number }) {
  const v = value ?? 0
  const pct = Math.min(Math.abs(v) / max, 1) * 50
  return (
    <div
      className="grid items-center grid-cols-[136px_minmax(0,1fr)_60px] sm:grid-cols-[150px_minmax(0,1fr)_64px]"
      style={{ minHeight: 46, borderBottom: '1px solid #D9D2BF', columnGap: 12 }}
    >
      <span className="text-caddie-ink" style={{ fontSize: 15 }}>
        {label}
      </span>
      <div className="relative" style={{ height: 10 }}>
        <div className="absolute inset-x-0" style={{ top: '50%', height: 1, background: '#D9D2BF' }} />
        <div className="absolute" style={{ left: '50%', top: -3, bottom: -3, width: 1, background: '#9F9580' }} />
        {value != null && v !== 0 && (
          <div
            className="absolute"
            style={{
              left: v > 0 ? '50%' : `${50 - pct}%`,
              width: `${pct}%`,
              top: 1,
              bottom: 1,
              background: v > 0 ? '#1F3D2C' : NEG,
            }}
          />
        )}
      </div>
      <span
        className="font-serif italic tabular text-right"
        style={{ fontSize: 18, fontWeight: 500, color: value == null ? INK35 : v < 0 ? NEG : '#1C211C' }}
      >
        {sg(value)}
      </span>
    </div>
  )
}

// Beside the card on desktop, under it on a phone: the focus lede and drills,
// the rest of the numbers as a divided list, then the round's actions.
export function RoundSide({
  round,
  holesPlayed,
  totalRoundsLogged,
  children,
}: {
  round: RoundRow
  holesPlayed: number
  totalRoundsLogged: number
  children: ReactNode
}) {
  const focus = pickRoundFocus(round)
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Putts', value: round.total_putts ?? '—' },
    {
      label: 'Fairways',
      value: round.fairways_total ? (
        <>
          {round.fairways_hit ?? 0} <Of n={round.fairways_total} />
        </>
      ) : (
        '—'
      ),
    },
    {
      label: 'Greens in regulation',
      value:
        round.gir != null ? (
          <>
            {round.gir} <Of n={holesPlayed} />
          </>
        ) : (
          '—'
        ),
    },
  ]
  return (
    <aside>
      {focus && <RoundNudge focus={focus} />}
      {totalRoundsLogged >= 3 && (
        <div style={{ margin: focus ? '18px 0 28px' : '0 0 28px' }}>
          <Link to="/practice" className="key key-primary">
            Go to Practice <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
          </Link>
        </div>
      )}
      <div style={{ borderTop: '1px solid #1C211C', marginTop: focus ? 28 : 0 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between"
            style={{ minHeight: 46, paddingTop: 12, borderBottom: '1px solid #D9D2BF' }}
          >
            <span className="text-caddie-ink" style={{ fontSize: 15 }}>
              {r.label}
            </span>
            <span className="font-serif italic tabular text-caddie-ink" style={{ fontSize: 20, fontWeight: 500 }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {children}
    </aside>
  )
}

function Of({ n }: { n: number }) {
  return (
    <span className="not-italic font-sans text-caddie-ink-dim" style={{ fontSize: 13 }}>
      of {n}
    </span>
  )
}

function RoundNudge({ focus }: { focus: RoundFocus }) {
  const { data: profile } = useProfile()
  // Wait for the profile before fetching drills — otherwise the query fires
  // once with skillLevel undefined, then refetches when the profile resolves.
  const { data: drills } = useDrills(
    { category: focus.category, skillLevel: profile?.skill_level ?? undefined },
    { enabled: !!profile },
  )
  const picks = selectNudgeDrills(drills ?? [], profile?.facilities ?? [])

  return (
    <div>
      <p className="font-serif italic text-caddie-ink" style={{ fontSize: 22, lineHeight: 1.3, fontWeight: 500 }}>
        {roundFocusHeadline(focus)}
      </p>
      {picks.length > 0 && (
        <>
          <p className="text-caddie-ink" style={{ fontSize: 14, marginTop: 8, marginBottom: 12 }}>
            {picks.length === 1 ? 'One drill' : `${picks.length === 2 ? 'Two' : picks.length} drills`} for your
            next range session:
          </p>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {/* No per-drill detail route exists; keys link to the drill library. */}
            {picks.map((drill) => (
              <Link
                key={drill.id}
                to="/practice/drills"
                className="key"
                style={{ justifyContent: 'space-between', fontWeight: 400, fontSize: 15, padding: '0 14px' }}
              >
                <span>
                  {drill.name}
                  {drill.duration_min ? (
                    <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                      {'  ·  '}
                      {drill.duration_min} min
                    </span>
                  ) : null}
                </span>
                <span aria-hidden style={{ fontSize: 17 }}>›</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
