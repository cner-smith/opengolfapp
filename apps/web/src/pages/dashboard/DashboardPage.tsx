import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { barScale, formatSG, isPartialRound, parseLocalDate, partialRoundLabel, sgBreakdown, sgFinding } from '@oga/core'
import { useRecentSG } from '../../hooks/useRounds'
import { useProfile } from '../../hooks/useProfile'
import { PencilUnderline } from '../../components/layout/MobileTabBar'
import { ResumeRoundBanner, useActiveRound } from './ResumeRound'
import './dashboard.css'

// Lazy-load recharts off the dashboard's first-paint chunk. Without this
// the recharts vendor bundle (~150KB gzip) ships alongside the index
// chunk on every authenticated cold start. Suspense fallback matches
// the chart's container height so layout doesn't shift on hydration.
const SGTrendChart = lazy(() =>
  import('./components/SGTrendChart').then((m) => ({ default: m.SGTrendChart })),
)

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off the tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around the green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

const POS = '#1F3D2C'
const NEG = '#A33A2A'

export function DashboardPage() {
  const profile = useProfile()
  const sg = useRecentSG(40)
  const active = useActiveRound()
  const activeRound = active.data ?? null
  const rounds = sg.data ?? []

  const firstName = profile.data?.username?.split(/\s+/)[0] ?? null
  const handicap = profile.data?.handicap_index

  // All five reductions over the rounds array share the same dependency
  // (`rounds`) and run on every render — wrap once so unrelated parent
  // re-renders don't recompute SG averages, trend coords, and avg score
  // from scratch. Hook stays above the early returns to keep call order
  // stable across renders.
  const stats = useMemo(() => {
    // Rounds ended early stay out of the per-round numbers (#911).
    // The newest 20 whole rounds out of 40, as mobile Home does (#1222).
    const whole = rounds.filter((r) => !isPartialRound(r.hole_scores)).slice(0, 20)
    const sg = sgBreakdown(whole)
    const avgs = SG_KEYS.map((c) => ({ ...c, value: sg.breakdown.find((b) => b.key === c.key)?.value ?? 0 }))
    const maxAbs = barScale(sg.maxAbs)
    const trendData = [...whole].reverse().map((r) => ({
      date: parseLocalDate(r.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sg: r.sg_total ?? 0,
    }))
    // total_score 0 = the past-round logger's "no score yet" sentinel (#910).
    const scored = whole.filter((r) => (r.total_score ?? 0) > 0)
    const avgScore = scored.length > 0 ? scored.reduce((s, r) => s + (r.total_score ?? 0), 0) / scored.length : 0
    const totalSG = avgs.reduce((s, a) => s + a.value, 0)
    const sortedDesc = [...avgs].sort((a, b) => b.value - a.value)
    return {
      wholeCount: whole.length,
      avgs,
      maxAbs,
      trendData,
      avgScore,
      totalSG,
      weakest: sortedDesc[sortedDesc.length - 1]!,
      strongest: sortedDesc[0]!,
    }
  }, [rounds])

  if (sg.isLoading) return <DashboardSkeleton />

  const { wholeCount, avgs, maxAbs, trendData, avgScore, totalSG, weakest, strongest } = stats
  // Masthead and SG caption both count whole rounds, as mobile does (SHL-18).
  const subtitle = [
    wholeCount === 0 ? 'No full rounds yet' : `Last ${wholeCount} round${wholeCount === 1 ? '' : 's'}`,
    handicap != null ? `Handicap ${handicap}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const recent = rounds.filter((r) => r.id !== activeRound?.id).slice(0, 5)

  return (
    <div
      className="flex flex-col lg:grid lg:items-start"
      style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', columnGap: 'clamp(40px, 5vw, 64px)' }}
    >
      {/* Story column on lg; on phone both columns dissolve (`contents`) and
          the blocks take mobile Home's order. */}
      <div className="contents lg:flex lg:flex-col">
        <Block order={1} i={0}>
          <Masthead greeting={firstName} subtitle={subtitle} />
        </Block>
        <Block order={2} i={1}>
          {wholeCount > 0 ? (
            <Lede text={sgFinding(weakest, strongest, 'every part')} />
          ) : (
            <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginBottom: 24, maxWidth: 520 }}>
              {rounds.length === 0
                ? 'Log a round to start tracking your strokes gained.'
                : 'Finish a full round to see your strokes gained.'}
            </p>
          )}
        </Block>
        <Block order={5} i={3}>
          {wholeCount === 0 ? (
            <EmptyState hasRounds={rounds.length > 0} />
          ) : (
            <section style={{ marginBottom: 36 }}>
              <SectionHead i={3} title="Strokes gained" caption={`Per round, last ${wholeCount} round${wholeCount === 1 ? '' : 's'}.`} />
              <div className="flex flex-col" style={{ gap: 16 }}>
                {avgs.map((a, d) => (
                  <SGBar key={a.key} label={a.label} value={a.value} max={maxAbs} d={d} />
                ))}
              </div>
              <h3
                className="font-serif text-caddie-ink"
                style={{ fontSize: 18, fontStyle: 'italic', fontWeight: 500, marginTop: 34, marginBottom: 6 }}
              >
                Round by round
              </h3>
              <div style={{ height: 210 }}>
                <Suspense fallback={<div className="dash-skel" style={{ height: '100%' }} />}>
                  <SGTrendChart data={trendData} />
                </Suspense>
              </div>
              <div className="text-caddie-ink-mute" style={{ fontSize: 12, marginTop: 6 }}>
                Strokes gained each round, oldest to newest.
              </div>
            </section>
          )}
        </Block>
      </div>

      <div className="contents lg:flex lg:flex-col" style={{ paddingTop: 10 }}>
        <Block order={3} i={2}>
          {activeRound ? <ResumeRoundBanner round={activeRound} /> : <StartLiveRound />}
          <Link
            to="/rounds/new?mode=past"
            className="flex items-center justify-center text-caddie-accent hover:underline underline-offset-4"
            style={{ minHeight: 44, fontSize: 15, fontWeight: 700, marginBottom: 18 }}
          >
            + Log past round
          </Link>
        </Block>
        {wholeCount > 0 && (
          <Block order={4} i={2}>
            <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 34 }}>
              <StatTile label="Average score" value={avgScore} format={(v) => (v > 0 ? v.toFixed(1) : '—')} />
              <StatTile
                label="Strokes gained"
                value={totalSG}
                format={formatSG}
                color={totalSG > 0 ? POS : totalSG < 0 ? NEG : '#1C211C'}
              />
            </div>
          </Block>
        )}
        {recent.length > 0 && (
          <Block order={6} i={4}>
            <section style={{ marginBottom: 28 }}>
              <SectionHead
                i={4}
                title="Recent rounds"
                action={
                  <Link
                    to="/rounds"
                    className="text-caddie-ink-dim hover:text-caddie-ink underline underline-offset-4"
                    style={{ fontSize: 13 }}
                  >
                    See all
                  </Link>
                }
              />
              <ul style={{ marginTop: -6 }}>
                {recent.map((r, idx) => (
                  <li key={r.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #D9D2BF' }}>
                    <Link
                      to={`/rounds/${r.id}`}
                      className="dash-row flex items-center justify-between"
                      style={{ padding: '12px 10px', margin: '0 -10px', borderRadius: 3, gap: 12 }}
                    >
                      <div className="min-w-0">
                        <div className="font-serif text-caddie-ink truncate" style={{ fontSize: 16, fontWeight: 500 }}>
                          {r.courses?.name ?? 'Round'}
                        </div>
                        <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 2 }}>
                          {formatPlayed(r.played_at)}
                          {partialRoundLabel(r.hole_scores)}
                        </div>
                      </div>
                      <div className="dash-row-score flex items-baseline shrink-0" style={{ gap: 12 }}>
                        <span className="font-serif tabular text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500 }}>
                          {r.total_score || '—'}
                        </span>
                        <SGValue value={r.sg_total} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Block>
        )}
      </div>
    </div>
  )
}

// One entrance-animated block. `order` = its place in the phone column.
function Block({ order, i, children }: { order: number; i: number; children: ReactNode }) {
  return (
    <div className="dash-rise lg:!order-none" style={{ order, '--i': i } as CSSProperties}>
      {children}
    </div>
  )
}

function Masthead({ greeting, subtitle }: { greeting: string | null; subtitle: string }) {
  const now = new Date()
  const hour = now.getHours()
  const hello = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}`
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="text-caddie-ink-mute" style={{ fontSize: 13, marginBottom: 6 }}>
        {today}
      </div>
      <h1
        className="font-serif text-caddie-ink text-[32px] lg:text-[46px]"
        style={{ fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 1.05 }}
      >
        {greeting ? `${hello}, ${greeting}.` : `${hello}.`}
      </h1>
      <div className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 10 }}>
        {subtitle}
      </div>
    </div>
  )
}

// The coach's line, the screen's hero. When a part of the game costs strokes,
// the pencil underlines that figure, drawn in after the page settles.
function Lede({ text }: { text: string }) {
  const m = /^(.*? costs you )(\d+(?:\.\d+)? strokes a round)(.*)$/.exec(text)
  return (
    <p
      className="font-serif text-caddie-ink text-[20px] lg:text-[31px] lg:[text-wrap:balance]"
      style={{ fontStyle: 'italic', fontWeight: 500, lineHeight: 1.28, letterSpacing: '-0.012em', maxWidth: 660, marginBottom: 26 }}
    >
      {m ? (
        <>
          {m[1]}
          <span className="relative whitespace-nowrap">
            {m[2]}
            <span className="dash-pencil absolute left-0 right-0" style={{ bottom: '-0.2em', height: '0.32em', lineHeight: 0 }}>
              <PencilUnderline width="100%" height="100%" />
            </span>
          </span>
          {m[3]}
        </>
      ) : (
        text
      )}
    </p>
  )
}

function SectionHead({ title, caption, action, i }: { title: string; caption?: string; action?: ReactNode; i: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="dash-rule" style={{ '--i': i } as CSSProperties} />
      <div className="flex items-baseline justify-between" style={{ paddingTop: 12 }}>
        <h2 className="font-serif text-caddie-ink text-[22px] lg:text-[24px]" style={{ fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2 }}>
          {title}
        </h2>
        {action}
      </div>
      {caption && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 4 }}>
          {caption}
        </div>
      )}
    </div>
  )
}

function StartLiveRound() {
  return (
    <div style={{ marginBottom: 2 }}>
      <Link to="/rounds/new?mode=live" className="key key-primary w-full" style={{ minHeight: 54, fontSize: 16, fontWeight: 700 }}>
        Start live round
      </Link>
      <div className="text-caddie-ink-dim text-center" style={{ fontSize: 12, marginTop: 9 }}>
        Track shots in real time with GPS
      </div>
    </div>
  )
}

// Counts up from 0 once per session (SHL-05); static under reduced motion.
function useCountUp(target: number, ms = 600): number {
  const [skip] = useState(() => {
    try {
      return (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        sessionStorage.getItem('oga-dash-counted') === '1'
      )
    } catch {
      return true
    }
  })
  const [v, setV] = useState(skip ? target : 0)
  useEffect(() => {
    if (skip) {
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now() + 240
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms))
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        try {
          sessionStorage.setItem('oga-dash-counted', '1')
        } catch {
          /* private mode: count again next time */
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, skip])
  return v
}

function StatTile({
  label,
  value,
  format,
  color = '#1C211C',
}: {
  label: string
  value: number
  format: (v: number) => string
  color?: string
}) {
  const shown = useCountUp(value)
  return (
    <div className="paper-tile" style={{ padding: '14px 16px 16px' }}>
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{ fontSize: 32, fontStyle: 'italic', fontWeight: 500, color, lineHeight: 1.05, letterSpacing: '-0.02em' }}
        role="img"
        aria-label={format(value)}
      >
        {format(shown)}
      </div>
    </div>
  )
}

function SGBar({ label, value, max, d }: { label: string; value: number; max: number; d: number }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 50
  const isPositive = value > 0
  const color = value > 0 ? POS : value < 0 ? NEG : '#8A8B7E'
  return (
    <div className="flex items-center" style={{ gap: 14, '--d': d } as CSSProperties}>
      <div className="text-caddie-ink" style={{ width: 128, fontSize: 14, flexShrink: 0 }}>
        {label}
      </div>
      <div className="relative flex-1" style={{ height: 10 }}>
        <div className="absolute inset-x-0" style={{ top: '50%', height: 1, backgroundColor: '#D9D2BF' }} />
        <div className="absolute" style={{ left: '50%', top: -2, bottom: -2, width: 1, backgroundColor: '#9F9580' }} />
        <div
          className="dash-bar absolute"
          style={{
            left: isPositive ? '50%' : `${50 - pct}%`,
            top: 1,
            bottom: 1,
            width: `${pct}%`,
            backgroundColor: color,
            transformOrigin: isPositive ? 'left center' : 'right center',
          }}
        />
      </div>
      <div
        className="dash-bar-value font-serif tabular text-right"
        style={{ width: 58, fontSize: 18, fontStyle: 'italic', fontWeight: 500, color }}
      >
        {formatSG(value)}
      </div>
    </div>
  )
}

function SGValue({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="text-caddie-ink-mute font-serif" style={{ fontSize: 15, width: 46, textAlign: 'right' }}>
        —
      </span>
    )
  const color = value > 0 ? POS : value < 0 ? NEG : '#5C6356'
  return (
    <span
      className="font-serif tabular"
      style={{ color, fontSize: 15, fontStyle: 'italic', fontWeight: 500, width: 46, textAlign: 'right' }}
    >
      {formatSG(value)}
    </span>
  )
}

function EmptyState({ hasRounds }: { hasRounds: boolean }) {
  return (
    <div className="paper-tile" style={{ padding: '24px 22px', marginBottom: 28 }}>
      <div className="font-serif text-caddie-ink" style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500 }}>
        {hasRounds ? 'No full rounds yet.' : 'No rounds logged yet.'}
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 8, maxWidth: 420, lineHeight: 1.45 }}>
        {hasRounds
          ? 'Finish a full round to see your strokes gained.'
          : 'Log your first round, or bring your history from another app, to start tracking strokes gained.'}
      </div>
      {!hasRounds && (
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 18 }}>
          <Link to="/rounds/new" className="key key-primary">
            Log a round <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
          </Link>
          <Link to="/rounds/import" className="key">
            Import your history
          </Link>
        </div>
      )}
    </div>
  )
}

// Paper skeleton in the final layout instead of a bare "Loading…" (SHL-20).
function DashboardSkeleton() {
  return (
    <div
      className="flex flex-col lg:grid"
      style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', columnGap: 'clamp(40px, 5vw, 64px)', gap: 18 }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex flex-col" style={{ gap: 14 }}>
        <div className="dash-skel" style={{ height: 14, width: 140 }} />
        <div className="dash-skel" style={{ height: 42, width: '70%' }} />
        <div className="dash-skel" style={{ height: 16, width: 220 }} />
        <div className="dash-skel" style={{ height: 30, width: '90%', marginTop: 12 }} />
      </div>
      <div className="flex flex-col" style={{ gap: 14 }}>
        <div className="dash-skel" style={{ height: 54 }} />
        <div className="grid grid-cols-2" style={{ gap: 12 }}>
          <div className="dash-skel" style={{ height: 84 }} />
          <div className="dash-skel" style={{ height: 84 }} />
        </div>
      </div>
    </div>
  )
}

export function formatPlayed(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
