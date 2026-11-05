import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  clubChangeCallouts,
  clubHistory,
  formatClubLabel,
  YARDS_TO_METERS,
  type ClubDistanceStat,
  type ClubHistoryPeriod,
  type ClubHistoryRow,
  type DistanceUnit,
} from '@oga/core'
import { getClubHistoryShots } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { useUnits } from '../../../hooks/useUnits'
import { Rocker } from '../../../components/ui/Rocker'
import { Insufficient, Section } from '../components/Section'

type Period = 'month' | 'rounds'
const PERIODS = [
  { value: 'month' as const, label: 'By month' },
  { value: 'rounds' as const, label: 'By 10 rounds' },
]
// The axis holds a year of months (or twelve windows); the oldest drop off.
const MAX_PERIODS = 12

const INK = '#1C211C'
const DIM = '#5C6356'
const MUTE = '#8A8B7E'
const LINE = '#D9D2BF'
const STRONG = '#9F9580'
const SURFACE = '#FBF8F1'
const SURFACE_2 = '#EBE5D6'
const ACCENT = '#1F3D2C'
const SANS = 'Epilogue, system-ui, sans-serif'
const SERIF = 'Fraunces, Georgia, serif'

const clubName = (club: string) =>
  formatClubLabel({ club_type: club }).replace(/^[a-z]{3,}/, (w) => w.charAt(0).toUpperCase() + w.slice(1))

// One club over time (#984): typical distance, ring, miss and shape on one
// shared axis, the guarded callouts beside them and every number in a table.
export function ClubHistorySection({ clubDistances }: { clubDistances: ClubDistanceStat[] }) {
  const { user } = useAuth()
  const { unit } = useUnits()
  const mostUsed = useMemo(
    () => [...clubDistances].sort((a, b) => b.count - a.count)[0]?.club ?? null,
    [clubDistances],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const club = picked ?? mostUsed
  const [period, setPeriod] = useState<Period>('month')
  const [hot, setHot] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['club-history', user?.id, club],
    enabled: !!user && !!club,
    queryFn: async () => {
      const { data, error } = await getClubHistoryShots(supabase, user!.id, club!)
      if (error) throw error
      return (data ?? []) as unknown as ClubHistoryRow[]
    },
  })

  const periods = useMemo(
    () =>
      query.data && club
        ? clubHistory(query.data, club, { period: period === 'month' ? 'month' : { rounds: 10 } }).slice(-MAX_PERIODS)
        : [],
    [query.data, club, period],
  )
  const callouts = useMemo(() => (club ? clubChangeCallouts(periods, { club, unit }) : null), [periods, club, unit])
  useEffect(() => setHot(null), [club, period])

  if (!club) return null
  const u = (y: number) => Math.round(unit === 'meters' ? y * YARDS_TO_METERS : y)
  const unitShort = unit === 'meters' ? 'm' : 'yd'
  const windowWord = period === 'month' ? 'months' : 'windows of 10 rounds'

  return (
    <Section title="Club history">
      <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, fontStyle: 'italic', margin: '-4px 0 14px', maxWidth: 640 }}>
        Typical distance is where the ball finished. Ring = two in three of your shots, from your aim.
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 18 }}>
        <div className="flex flex-wrap" role="radiogroup" aria-label="Club" style={{ gap: 6 }}>
          {clubDistances.map((c) => (
            <button
              key={c.club}
              type="button"
              role="radio"
              aria-checked={c.club === club}
              onClick={() => setPicked(c.club)}
              className="key st-chip"
            >
              {clubName(c.club)}
            </button>
          ))}
        </div>
        <Rocker
          value={period}
          options={PERIODS}
          onChange={setPeriod}
          label="Period"
          className="sm:ml-auto sm:w-[260px] w-full"
        />
      </div>

      {query.isLoading ? (
        <div style={{ height: 300, background: SURFACE_2, opacity: 0.5 }} aria-busy="true" />
      ) : query.isError ? (
        <Insufficient note="Couldn't load this club's shots. Try again in a moment." />
      ) : periods.length === 0 ? (
        <Insufficient note={`No ${clubName(club)} shots with a start and a finish yet.`} />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={{ gap: 28, alignItems: 'start' }}>
          <div>
            <HistoryCharts periods={periods} unit={unit} hot={hot} onHot={setHot} />
            <p className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
              Shape key: <b className="text-caddie-ink">solid</b> fade · <b className="text-caddie-ink">plain</b> straight ·{' '}
              <b className="text-caddie-ink">hatched</b> draw (hook and slice fold into draw and fade). Hollow: under 8 shots.
              Hover or tap a {period === 'month' ? 'month' : 'window'} for its numbers.
            </p>
          </div>
          <div>
            {callouts && callouts.sentences.length > 0 ? (
              <>
                <p className="font-serif text-caddie-ink" style={{ fontSize: 21, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, margin: '0 0 6px' }}>
                  {callouts.sentences[0]}
                </p>
                {callouts.sentences[1] && (
                  <p className="font-serif text-caddie-ink" style={{ fontSize: 16, lineHeight: 1.4, margin: '8px 0 0' }}>
                    {callouts.sentences[1]}
                  </p>
                )}
              </>
            ) : (
              <p className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3, margin: '0 0 6px' }}>
                {callouts?.first
                  ? `No change bigger than the noise since ${callouts.first.label}.`
                  : `A change shows once two ${windowWord} have 10 or more shots.`}
              </p>
            )}
            {callouts?.first && callouts.last && (
              <p className="text-caddie-ink-dim" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
                {callouts.last.label} against {callouts.first.label}: {callouts.last.distanceShots} and{' '}
                {callouts.first.distanceShots} shots.
              </p>
            )}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, marginTop: 16 }}>
              <thead>
                <tr>
                  {[period === 'month' ? 'Month' : 'Last round', 'Shots', 'Typical', 'Ring'].map((h, i) => (
                    <th
                      key={h}
                      className="text-caddie-ink-dim"
                      style={{ fontWeight: 400, textAlign: i === 0 ? 'left' : 'right', padding: '4px 0', borderBottom: `1px solid ${INK}` }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => {
                  const color = p.thin ? MUTE : INK
                  const cell = { textAlign: 'right' as const, padding: '6px 0', borderBottom: `1px solid ${LINE}`, fontFamily: SERIF, fontSize: 14, color }
                  return (
                    <tr
                      key={p.from}
                      onMouseEnter={() => setHot(i)}
                      onMouseLeave={() => setHot(null)}
                      style={{ background: hot === i ? SURFACE_2 : undefined }}
                    >
                      <td style={{ ...cell, textAlign: 'left', fontFamily: SANS, fontSize: 12, color: p.thin ? MUTE : DIM }}>{p.label}</td>
                      <td style={cell} className="tabular">{p.distanceShots}</td>
                      <td style={cell} className="tabular">{p.typical == null ? '–' : u(p.typical)}</td>
                      <td style={{ ...cell, color: p.ringThin ? MUTE : INK }} className="tabular">
                        {p.ring ? `${u(p.ring.width)} × ${u(p.ring.depth)}` : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-caddie-ink-mute" style={{ fontSize: 11, marginTop: 6 }}>
              Typical and ring in {unitShort}; ring is width × depth.
            </p>
          </div>
        </div>
      )}
    </Section>
  )
}

// A padded axis on round numbers: at most five ticks, 5/10/20/50 apart.
function niceAxis(values: number[], minSpan: number): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = [5, 10, 20, 50, 100].find((s) => Math.max(max - min, minSpan) / s <= 4) ?? 100
  let lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (hi - lo < minSpan) hi = lo + Math.ceil(minSpan / step) * step
  if (hi === lo) hi = lo + step
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  return { lo, hi, ticks }
}

// A run of points: solid between two full periods, dashed where either is thin.
function Trace({
  pts,
  color,
  dash,
}: {
  pts: ({ x: number; y: number; thin: boolean } | null)[]
  color: string
  dash?: string
}) {
  const segs: JSX.Element[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (!a || !b) continue
    const thin = a.thin || b.thin
    segs.push(
      <line
        key={i}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={thin ? 1.5 : 2}
        strokeDasharray={thin ? '3 3' : dash}
      />,
    )
  }
  return <>{segs}</>
}

function HistoryCharts({
  periods,
  unit,
  hot,
  onHot,
}: {
  periods: ClubHistoryPeriod[]
  unit: DistanceUnit
  hot: number | null
  onHot: (i: number | null) => void
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(590)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cv = (y: number) => (unit === 'meters' ? y * YARDS_TO_METERS : y)
  const n = periods.length
  const padL = 34
  const padR = 70
  const step = n > 1 ? (w - padL - padR - 24) / (n - 1) : 0
  const x = (i: number) => (n > 1 ? padL + 12 + i * step : (padL + w - padR) / 2)
  const colW = Math.max(12, Math.min(30, (n > 1 ? step : 60) * 0.55))
  const last = periods[n - 1]!

  // Typical distance with its p16–p84 band.
  const distVals = periods.flatMap((p) => [p.typical, p.p16, p.p84].filter((v): v is number => v != null).map(cv))
  const dAxis = niceAxis(distVals.length ? distVals : [0], 20)
  const [dLo, dHi] = [dAxis.lo, dAxis.hi]
  const D_TOP = 22
  const D_H = 110
  const dy = (v: number) => D_TOP + D_H - ((cv(v) - dLo) / (dHi - dLo)) * D_H
  const dTicks = dAxis.ticks
  const band = periods.flatMap((p, i) => (p.p16 != null && p.p84 != null ? [{ i, lo: p.p16, hi: p.p84 }] : []))

  // Ring width and depth.
  const ringVals = periods.flatMap((p) => (p.ring ? [cv(p.ring.width), cv(p.ring.depth)] : []))
  const rAxis = niceAxis(ringVals.length ? ringVals : [0], 10)
  const [rLo, rHi] = [rAxis.lo, rAxis.hi]
  const R_TOP = 172
  const R_H = 90
  const ry = (v: number) => R_TOP + R_H - ((cv(v) - rLo) / (rHi - rLo)) * R_H
  const lastRing = [...periods].reverse().find((p) => p.ring)

  // Average miss in a small aim cross; one scale for every period.
  const M_Y = 320
  const missMax = Math.max(10, ...periods.flatMap((p) => (p.avgMiss ? [Math.abs(p.avgMiss.lateral), Math.abs(p.avgMiss.distance)] : [])))
  const mk = 12 / missMax

  const S_TOP = 370
  const S_H = 50
  const LABEL_Y = 440
  const H = 452

  const fmt = (v: number) => String(Math.round(cv(v)))
  const us = unit === 'meters' ? 'm' : 'yd'
  const tip = (p: ClubHistoryPeriod) =>
    `${p.label}: ${p.distanceShots} shot${p.distanceShots === 1 ? '' : 's'}` +
    (p.typical != null ? `, typical ${fmt(p.typical)} ${us}` : '') +
    (p.ring ? `, ring ${fmt(p.ring.width)} × ${fmt(p.ring.depth)} ${us}` : '') +
    (p.avgMiss ? `, average miss ${fmt(Math.abs(p.avgMiss.lateral))} ${us} ${p.avgMiss.lateral >= 0 ? 'right' : 'left'}` : '')

  const head = (y: number, text: string) => (
    <text x={0} y={y} fontFamily={SANS} fontSize={13} fill={INK}>
      {text}
    </text>
  )

  return (
    <div ref={box} style={{ width: '100%' }}>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`${periods.length} periods, ${periods[0]!.label} to ${last.label}. The table beside the charts lists every number.`}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        <defs>
          <pattern id="ch-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill={SURFACE} />
            <line x1="0" y1="0" x2="0" y2="5" stroke={INK} strokeWidth="1.6" />
          </pattern>
        </defs>

        {hot != null && <rect x={x(hot) - Math.max(colW, 18)} y={14} width={Math.max(colW, 18) * 2} height={LABEL_Y - 2} fill={SURFACE_2} opacity={0.7} />}

        {head(12, 'Typical distance')}
        {dTicks.map((t, i) => {
          const y = D_TOP + D_H - ((t - dLo) / (dHi - dLo)) * D_H
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR + 10} y2={y} stroke={i === 0 ? STRONG : LINE} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontFamily={SANS} fontSize={11} fill={DIM}>
                {t}
              </text>
            </g>
          )
        })}
        {band.length > 1 && (
          <polygon
            points={[...band.map((b) => `${x(b.i)},${dy(b.hi)}`), ...[...band].reverse().map((b) => `${x(b.i)},${dy(b.lo)}`)].join(' ')}
            fill={SURFACE_2}
          />
        )}
        <Trace pts={periods.map((p, i) => (p.typical == null ? null : { x: x(i), y: dy(p.typical), thin: p.thin }))} color={INK} />
        {periods.map((p, i) =>
          p.typical == null ? null : p.thin ? (
            <circle key={i} cx={x(i)} cy={dy(p.typical)} r={4} fill={SURFACE} stroke={INK} strokeWidth={1.5} />
          ) : (
            <circle key={i} cx={x(i)} cy={dy(p.typical)} r={i === n - 1 ? 5 : 3.5} fill={i === n - 1 ? ACCENT : INK} />
          ),
        )}
        {last.typical != null && (
          <text x={x(n - 1)} y={dy(last.typical) - 10} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontWeight={500} fontSize={17} fill={INK}>
            {fmt(last.typical)}
          </text>
        )}

        {head(160, `Ring size, ${us}`)}
        {ringVals.length === 0 ? (
          <text x={padL} y={R_TOP + R_H / 2} fontFamily={SANS} fontSize={12} fill={MUTE}>
            A ring needs 5 shots with an aim in a period.
          </text>
        ) : (
          <>
            {rAxis.ticks.map((t, i) => {
              const y = R_TOP + R_H - ((t - rLo) / (rHi - rLo)) * R_H
              return (
                <g key={t}>
                  <line x1={padL} y1={y} x2={w - padR + 10} y2={y} stroke={i === 0 ? STRONG : LINE} />
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontFamily={SANS} fontSize={11} fill={DIM}>
                    {t}
                  </text>
                </g>
              )
            })}
            <Trace pts={periods.map((p, i) => (p.ring ? { x: x(i), y: ry(p.ring.width), thin: p.ringThin } : null))} color={INK} />
            <Trace pts={periods.map((p, i) => (p.ring ? { x: x(i), y: ry(p.ring.depth), thin: p.ringThin } : null))} color={DIM} dash="6 3" />
            {periods.map((p, i) =>
              p.ring ? (
                <g key={i}>
                  <circle cx={x(i)} cy={ry(p.ring.width)} r={3.5} fill={p.ringThin ? SURFACE : INK} stroke={INK} strokeWidth={p.ringThin ? 1.5 : 0} />
                  <rect x={x(i) - 3.5} y={ry(p.ring.depth) - 3.5} width={7} height={7} fill={p.ringThin ? SURFACE : DIM} stroke={DIM} strokeWidth={p.ringThin ? 1.5 : 0} />
                </g>
              ) : null,
            )}
            {lastRing?.ring && (
              <>
                <text x={x(periods.indexOf(lastRing)) + 8} y={ry(lastRing.ring.width) + (lastRing.ring.width >= lastRing.ring.depth ? -6 : 14)} fontFamily={SERIF} fontStyle="italic" fontSize={13} fill={INK}>
                  {fmt(lastRing.ring.width)} wide
                </text>
                <text x={x(periods.indexOf(lastRing)) + 8} y={ry(lastRing.ring.depth) + (lastRing.ring.width >= lastRing.ring.depth ? 14 : -6)} fontFamily={SERIF} fontStyle="italic" fontSize={13} fill={DIM}>
                  {fmt(lastRing.ring.depth)} deep
                </text>
              </>
            )}
          </>
        )}

        {head(290, 'Average miss, from your aim')}
        {periods.map((p, i) => (
          <g key={i} transform={`translate(${x(i)},${M_Y})`}>
            <rect x={-15} y={-15} width={30} height={30} fill={SURFACE} stroke={LINE} />
            <line x1={-15} y1={0} x2={15} y2={0} stroke={LINE} />
            <line x1={0} y1={-15} x2={0} y2={15} stroke={LINE} />
            {p.avgMiss ? (
              <circle
                cx={p.avgMiss.lateral * mk}
                cy={-p.avgMiss.distance * mk}
                r={3}
                fill={p.ringThin ? SURFACE : INK}
                stroke={INK}
                strokeWidth={p.ringThin ? 1.2 : 0}
              />
            ) : (
              <text y={4} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={MUTE}>
                –
              </text>
            )}
          </g>
        ))}

        {head(360, 'Shape')}
        {periods.map((p, i) => {
          const rec = p.shape.draw + p.shape.straight + p.shape.fade
          const left = x(i) - colW / 2
          if (rec < 5) {
            return (
              <g key={i}>
                <rect x={left} y={S_TOP} width={colW} height={S_H} fill={SURFACE} stroke={STRONG} strokeDasharray="3 3" />
                <text x={x(i)} y={S_TOP + S_H / 2 + 4} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={DIM}>
                  {rec}
                </text>
              </g>
            )
          }
          const fadeH = (p.shape.fade / rec) * S_H
          const straightH = (p.shape.straight / rec) * S_H
          const drawH = S_H - fadeH - straightH
          return (
            <g key={i}>
              <rect x={left} y={S_TOP + S_H - fadeH} width={colW} height={fadeH} fill={INK} />
              <rect x={left} y={S_TOP + drawH} width={colW} height={straightH} fill={SURFACE_2} stroke={STRONG} />
              <rect x={left} y={S_TOP} width={colW} height={drawH} fill="url(#ch-hatch)" stroke={INK} strokeWidth={0.5} />
            </g>
          )
        })}

        {periods.map((p, i) => (
          <text key={i} x={x(i)} y={LABEL_Y} textAnchor="middle" fontFamily={SANS} fontSize={11} fill={p.thin ? MUTE : DIM}>
            {n > 8 && i % 2 === 1 && i !== n - 1 ? '' : p.label}
          </text>
        ))}
        {periods.map((p, i) => (
          <rect
            key={i}
            x={x(i) - (n > 1 ? step / 2 : 40)}
            y={0}
            width={n > 1 ? step : 80}
            height={H}
            fill="transparent"
            onMouseEnter={() => onHot(i)}
            onMouseLeave={() => onHot(null)}
            onClick={() => onHot(hot === i ? null : i)}
          >
            <title>{tip(p)}</title>
          </rect>
        ))}
      </svg>
      {hot != null && periods[hot] && (
        <p className="text-caddie-ink" style={{ fontSize: 13, margin: '4px 0 0' }} aria-live="polite">
          {tip(periods[hot]!)}
        </p>
      )}
    </div>
  )
}
