import type {
  ClubAccuracyEntry,
  CostlyLieEntry,
  MissTendencyEntry,
  ScoringDistributionSlice,
  SlopeImpact,
} from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { Insufficient } from './Section'

export function ScoringDistributionBar({
  slices,
  total,
}: {
  slices: ScoringDistributionSlice[]
  total: number
}) {
  if (total === 0) {
    return <Insufficient note="Need scored holes to plot the distribution." />
  }
  const visible = slices.filter((s) => s.count > 0)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 56,
          border: '1px solid #D9D2BF',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        {visible.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${s.count} (${s.pct.toFixed(1)}%)`}
            style={{
              width: `${s.pct}%`,
              background: s.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              color: '#F2EEE5',
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.pct >= 8 ? `${s.pct.toFixed(0)}%` : ''}
          </div>
        ))}
      </div>
      <div
        className="flex flex-wrap"
        style={{ gap: 18, fontSize: 12, color: '#5C6356' }}
      >
        {slices.map((s) => (
          <div
            key={s.key}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }}
            />
            <span>
              {s.label}{' '}
              <span className="font-mono tabular text-caddie-ink-mute">
                {s.count} · {s.pct.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MissTendencyList({ entries }: { entries: MissTendencyEntry[] }) {
  if (entries.length === 0)
    return <Insufficient note="Need shot results logged to detect a tendency." />
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.map((e) => (
        <div
          key={e.result}
          className="flex items-baseline justify-between"
          style={{
            borderBottom: '1px solid #D9D2BF',
            padding: '14px 0',
          }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {e.result.replace(/_/g, ' ')}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.count} shots
            </span>
            <span
              className="font-serif tabular text-caddie-ink"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {e.pct.toFixed(0)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function CostlyLiesList({ entries }: { entries: CostlyLieEntry[] }) {
  if (entries.length === 0)
    return <Insufficient note="Need at least 5 shots per lie type with results." />
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.slice(0, 5).map((e) => (
        <div
          key={e.lie}
          className="flex items-baseline justify-between"
          style={{
            borderBottom: '1px solid #D9D2BF',
            padding: '14px 0',
          }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {e.lie.replace(/_/g, ' ')}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.shots} shots
            </span>
            <span
              className="font-serif tabular"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
                color: e.avgQuality < 0 ? '#A33A2A' : '#5C6356',
              }}
            >
              {e.avgQuality.toFixed(2)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function ClubAccuracyList({ entries }: { entries: ClubAccuracyEntry[] }) {
  if (entries.length === 0)
    return (
      <Insufficient note="Need shots with start, aim, and end coords (≥3 per club)." />
    )
  const top = entries.slice(0, 5)
  const bottom = entries.slice(-5).reverse()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
      <div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginBottom: 10,
          }}
        >
          Most accurate
        </div>
        <ClubRows entries={top} />
      </div>
      <div>
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            marginBottom: 10,
          }}
        >
          Least accurate
        </div>
        <ClubRows entries={bottom} />
      </div>
    </div>
  )
}

function ClubRows({ entries }: { entries: ClubAccuracyEntry[] }) {
  const { toDisplay } = useUnits()
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {entries.map((e) => (
        <div
          key={e.club}
          className="flex items-baseline justify-between"
          style={{ borderBottom: '1px solid #D9D2BF', padding: '12px 0' }}
        >
          <span
            className="font-serif text-caddie-ink"
            style={{
              fontSize: 17,
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            {e.club}
          </span>
          <span className="flex items-baseline" style={{ gap: 14 }}>
            <span
              className="font-mono uppercase tabular text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              {e.shots} shots
            </span>
            <span
              className="font-serif tabular text-caddie-ink"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {toDisplay(e.avgLateralYards, 1)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function SlopeImpactBlock({ impact }: { impact: SlopeImpact }) {
  if (impact.forward.length === 0 && impact.side.length === 0) {
    return (
      <Insufficient note="Need shots logged with a forward or side slope (≥3 each) to score impact." />
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
      <SlopeAxisBlock title="Forward" entries={impact.forward} />
      <SlopeAxisBlock title="Side" entries={impact.side} />
    </div>
  )
}

function SlopeAxisBlock({
  title,
  entries,
}: {
  title: string
  entries: SlopeImpact['forward'] | SlopeImpact['side']
}) {
  return (
    <div>
      <div
        className="font-mono uppercase text-caddie-ink-mute"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {entries.length === 0 ? (
        <Insufficient note={`Need ≥3 ${title.toLowerCase()}-slope shots.`} />
      ) : (
        <div style={{ borderTop: '1px solid #D9D2BF' }}>
          {entries.map((e) => (
            <div
              key={e.slope}
              className="flex items-baseline justify-between"
              style={{ borderBottom: '1px solid #D9D2BF', padding: '12px 0' }}
            >
              <span
                className="font-serif text-caddie-ink"
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              >
                {e.slope.replace('_', ' ')}
              </span>
              <span className="flex items-baseline" style={{ gap: 14 }}>
                <span
                  className="font-mono uppercase tabular text-caddie-ink-mute"
                  style={{ fontSize: 10, letterSpacing: '0.14em' }}
                >
                  {e.shots} shots
                </span>
                <span
                  className="font-serif tabular"
                  style={{
                    fontSize: 22,
                    fontStyle: 'italic',
                    fontWeight: 500,
                    color: e.avgQuality < 0 ? '#A33A2A' : '#5C6356',
                  }}
                >
                  {e.avgQuality.toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
