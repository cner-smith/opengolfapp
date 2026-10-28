import { useEffect, useRef, useState } from 'react'
import { formatSG, formatBandLabel, type ApproachBandStat, type RecoveryRateStat } from '@oga/core'
import { useUnits } from '../../../hooks/useUnits'
import { fmtPct } from '../format'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Counts a figure to its value (from 0 on mount, from the old value when the
// window changes), so the tile's number lands rather than swapping.
function useCountUp(target: number | null, delay = 0, duration = 600): number | null {
  const [shown, setShown] = useState<number | null>(target == null || reducedMotion() ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null || reducedMotion()) {
      setShown(target)
      return
    }
    const start = from.current
    let raf = 0
    let t0 = 0
    const ease = (t: number) => 1 - Math.pow(1 - t, 4)
    const tick = (now: number) => {
      if (!t0) t0 = now + delay
      const t = Math.min(1, Math.max(0, (now - t0) / duration))
      const v = start + (target - start) * ease(t)
      from.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, duration])
  return shown
}

const sgTone = (v: number | null) =>
  v == null || Math.abs(v) < 0.005 ? '#5C6356' : v > 0 ? '#1F3D2C' : '#A33A2A'

// SG headline tile: the category's key, the figure counting in, then a small
// diverging bar on the shared scale so the four compare at a glance.
export function SgTile({
  label,
  color,
  dash = '0',
  value,
  scale = 2,
  index = 0,
}: {
  label: string
  color: string
  dash?: string
  value: number | null
  scale?: number
  index?: number
}) {
  const shown = useCountUp(value, index * 60)
  const half = value == null ? 0 : Math.min(1, Math.abs(value) / scale) * 50
  return (
    <div className="paper-tile st-rise" style={{ padding: '16px 18px 18px', animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
        <svg width="16" height="8" aria-hidden style={{ flexShrink: 0 }}>
          <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} />
        </svg>
        <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div
        className="font-serif tabular"
        style={{ fontSize: 'clamp(30px, 2.9vw, 42px)', fontStyle: 'italic', fontWeight: 500, color: sgTone(value), lineHeight: 1.05 }}
      >
        {shown == null ? '—' : formatSG(shown)}
      </div>
      <div aria-hidden style={{ position: 'relative', height: 8, marginTop: 14 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 1, background: '#D9D2BF' }} />
        <div style={{ position: 'absolute', left: '50%', top: -1, height: 10, width: 1, background: '#1C211C' }} />
        {value != null && half > 0 && (
          <div
            className="st-grow"
            style={{
              position: 'absolute',
              top: 1,
              height: 7,
              background: value >= 0 ? '#1C211C' : '#A33A2A',
              left: value >= 0 ? '50%' : `${50 - half}%`,
              width: `${half}%`,
              transformOrigin: value >= 0 ? 'left' : 'right',
              animationDelay: `${120 + index * 60}ms`,
            }}
          />
        )}
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle?: string
}) {
  return (
    <div className="paper-tile" style={{ padding: '16px 18px' }}>
      <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>
        {label}
      </div>
      <div className="font-serif tabular text-caddie-ink" style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.05 }}>
        {value}
      </div>
      {subtle && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.3 }}>
          {subtle}
        </div>
      )}
    </div>
  )
}

// One divided row: sentence-case label left, serif number right (DESIGN.md
// Stat tile: tiles for the headline numbers, this for the rest).
export function StatRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}
    >
      <div>
        <div className="text-caddie-ink" style={{ fontSize: 15 }}>{label}</div>
        {note && <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 2 }}>{note}</div>}
      </div>
      <div className="font-serif tabular text-caddie-ink" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

// Approach band as a diverging bar (DESIGN.md): zero sits where the data
// needs it (the right edge when every band loses strokes), the bar grows
// out of it and the value rides the bar's end in the bar's colour.
export function ApproachBandRow({
  band,
  lo,
  hi,
  index = 0,
}: {
  band: ApproachBandStat
  lo: number
  hi: number
  index?: number
}) {
  const { unit, toDisplay } = useUnits()
  const v = band.avgSg
  const span = hi - lo
  const pct = (x: number) => ((x - lo) / span) * 100
  const zero = pct(0)
  const end = v == null ? zero : pct(v)
  const left = Math.min(zero, end)
  const width = Math.abs(end - zero)
  const valueOnLeft = v != null && v < 0
  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: 'clamp(84px, 20vw, 150px) minmax(0, 1fr)',
        gap: 18,
        padding: '12px 0',
        borderBottom: '1px solid #E4DCC8',
      }}
    >
      <div>
        <div className="text-caddie-ink" style={{ fontSize: 15 }}>{formatBandLabel(band, unit, toDisplay)}</div>
        <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
          {band.shots > 0 ? `${band.shots} shot${band.shots === 1 ? '' : 's'}` : 'No shots yet'}
        </div>
      </div>
      <div style={{ position: 'relative', height: 30, margin: '0 clamp(50px, 5vw, 64px)' }}>
        <div style={{ position: 'absolute', left: `${zero}%`, top: -12, bottom: -12, width: 1, background: '#1C211C' }} />
        {v != null && (
          <>
            <div
              className="st-grow"
              style={{
                position: 'absolute',
                top: 9,
                height: 12,
                background: sgTone(v),
                left: `${left}%`,
                width: `${width}%`,
                transformOrigin: v >= 0 ? 'left' : 'right',
                animationDelay: `${index * 40}ms`,
              }}
            />
            <div
              className="font-serif tabular st-rise"
              style={{
                position: 'absolute',
                top: 0,
                fontSize: 21,
                fontStyle: 'italic',
                fontWeight: 500,
                lineHeight: '30px',
                color: sgTone(v),
                whiteSpace: 'nowrap',
                animationDelay: `${200 + index * 40}ms`,
                ...(valueOnLeft
                  ? { right: `calc(${100 - left}% + 10px)` }
                  : { left: `calc(${left + width}% + 10px)` }),
              }}
            >
              {formatSG(v)}
            </div>
          </>
        )}
        {v == null && (
          <div className="text-caddie-ink-mute" style={{ position: 'absolute', left: `calc(${zero}% + 10px)`, top: 6, fontSize: 13 }}>
            —
          </div>
        )}
      </div>
    </div>
  )
}

export function RecoveryStat({ stat }: { stat: RecoveryRateStat }) {
  const pct = stat.recoveryPct
  return (
    <div className="paper-tile" style={{ padding: '16px 18px', maxWidth: 560 }}>
      <div className="flex items-baseline" style={{ gap: 16 }}>
        <span
          className="font-serif tabular text-caddie-ink"
          style={{ fontSize: 40, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.05 }}
        >
          {fmtPct(pct)}
        </span>
        <span className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, fontStyle: 'italic' }}>
          {stat.totalRoughShots > 0
            ? `of ${stat.totalRoughShots} shot${stat.totalRoughShots === 1 ? '' : 's'} from the rough found the fairway or green next`
            : 'Needs shots logged from the rough'}
        </span>
      </div>
      {pct != null && (
        <div aria-hidden style={{ height: 6, background: '#EBE5D6', marginTop: 14 }}>
          <div className="st-grow" style={{ height: 6, width: `${pct}%`, background: '#1C211C', transformOrigin: 'left' }} />
        </div>
      )}
    </div>
  )
}
