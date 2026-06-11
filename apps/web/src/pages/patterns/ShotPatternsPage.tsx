import { useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import {
  CLUBS,
  LIE_TYPES,
  getAimCorrection,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type DispersionPoint,
  type DispersionStats,
} from '@oga/core'
import { useShotPatterns } from '../../hooks/useShotPatterns'
import { LieSlopeGrid } from '../../components/forms/LieSlopeGrid'
import { useUnits } from '../../hooks/useUnits'
import {
  DispersionPlot,
  pointColor,
  SVG_SIZE,
} from './components/DispersionPlot'
import { ShotPatternsShareCard } from './components/ShotPatternsShareCard'

const FLIGHT_W = 460
const FLIGHT_H = 520
const FLIGHT_VIEW_WIDTH = `min(${FLIGHT_W}px, 92vw)`

// Social share card — 1200×630 is Twitter/Facebook's preferred OG image
// size. Rendered off-screen, rasterised on Export. The plot inside is
// drawn at a fixed pixel size so the capture is viewport-independent.
const SHARE_CARD_W = 1200
const SHARE_CARD_H = 630

export function ShotPatternsPage() {
  const { unit, toDisplay } = useUnits()
  const [club, setClub] = useState<Club>('7i')
  const [lieType, setLieType] = useState<LieType | ''>('')
  const [lieSlopeForward, setLieSlopeForward] = useState<
    LieSlopeForward | undefined
  >(undefined)
  const [lieSlopeSide, setLieSlopeSide] = useState<LieSlopeSide | undefined>(
    undefined,
  )

  const { data, isLoading } = useShotPatterns({
    club,
    lieType: lieType || undefined,
    lieSlopeForward,
    lieSlopeSide,
  })

  const points = data?.points ?? []
  const stats = data?.stats ?? null

  const shareCardRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  // Off-screen share card mounts lazily on first export so it isn't laid out
  // on every club-chip re-render for users who never share.
  const [showShareCard, setShowShareCard] = useState(false)

  // Rasterise the off-screen 1200×630 share card and open the native
  // share sheet (Web Share API), falling back to a download where file
  // sharing isn't supported or the share fails for any reason other than
  // the user dismissing the sheet. Captures on click rather than ahead of
  // time: the card is heavy and the club filter changes often, so
  // pre-rasterising on every chip tap would be wasteful. The cost is that
  // the `await` before share() can expire the iOS-Safari gesture token —
  // in which case it simply degrades to the download path (same PNG).
  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      // The card is normally pre-mounted on the Export button's pointer-enter
      // / focus (below), so the ref is ready here and the iOS share gesture
      // token stays intact. Fallback: if a fast tap beat the mount, mount now
      // and wait a paint — this rare path may forfeit the token (→ download).
      if (!shareCardRef.current) {
        setShowShareCard(true)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }
      const node = shareCardRef.current
      if (!node) throw new Error('share card not ready')
      const blob = await toBlob(node, {
        width: SHARE_CARD_W,
        height: SHARE_CARD_H,
        cacheBust: true,
        backgroundColor: '#FBF8F1',
      })
      if (!blob) throw new Error('empty blob')
      const filename = `oga-${club}-pattern.png`
      const file = new File([blob], filename, { type: 'image/png' })
      if (
        typeof navigator.share === 'function' &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: 'OGA Shot Pattern' })
          return
        } catch (err) {
          // User dismissed the sheet — not an error worth surfacing.
          if ((err as Error).name === 'AbortError') return
          // Any other share failure → fall through to the download path.
        }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      // Firefox and older Safari only honour downloads from an anchor that's
      // attached to the document; a detached element silently no-ops.
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportError('Could not export the image. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Dispersion ledger
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Shot Patterns
        </h1>
        <div
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
        >
          Per-club dispersion centered on the aim point you set before each shot.
        </div>
      </div>

      <Section kicker="Club">
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {/* Putter excluded: aim-relative yards dispersion is meaningless for
              putts (mirrors the clubAccuracy putt exclusion, #574). */}
          {CLUBS.filter((c) => c !== 'putter').map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClub(c)}
              style={chipStyle(club === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: 28, marginBottom: 28 }}
      >
        <FilterSection kicker="Lie type">
          <SelectChips
            value={lieType}
            options={['', ...LIE_TYPES] as const}
            onChange={(v) => setLieType(v as LieType | '')}
            renderLabel={(v) => (v === '' ? 'any' : v.replace(/_/g, ' '))}
          />
        </FilterSection>
        <FilterSection kicker="Lie slope">
          <LieSlopeGrid
            forward={lieSlopeForward}
            side={lieSlopeSide}
            onChangeForward={setLieSlopeForward}
            onChangeSide={setLieSlopeSide}
            toggleable
          />
        </FilterSection>
      </div>

      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 14, gap: 12 }}
        >
          <div className="kicker">Pattern</div>
          {stats && (
            <div className="flex items-center" style={{ gap: 12 }}>
              {exportError && (
                <span className="text-caddie-neg" style={{ fontSize: 12 }}>
                  {exportError}
                </span>
              )}
              <button
                type="button"
                onClick={handleExport}
                onPointerEnter={() => setShowShareCard(true)}
                onFocus={() => setShowShareCard(true)}
                disabled={exporting}
                className="text-caddie-accent hover:bg-caddie-accent/10 disabled:opacity-40"
                style={{
                  background: 'transparent',
                  border: '1px solid #1F3D2C',
                  borderRadius: 2,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: '"Inconsolata", monospace',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {exporting ? 'Rendering…' : '↓ Export · 1200×630'}
              </button>
            </div>
          )}
        </div>
        <div
          className="grid grid-cols-1 md:[grid-template-columns:minmax(0,auto)_minmax(0,1fr)]"
          style={{ gap: 22 }}
        >
          <div
            className="bg-caddie-surface"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 4,
              padding: 14,
            }}
          >
            {isLoading ? (
              <div
                className="flex items-center justify-center text-caddie-ink-mute"
                style={{
                  width: SVG_SIZE,
                  maxWidth: '100%',
                  aspectRatio: '1 / 1',
                  fontSize: 13,
                }}
              >
                Loading…
              </div>
            ) : points.length === 0 ? (
              <div
                className="flex items-center justify-center text-caddie-ink-mute"
                style={{
                  width: SVG_SIZE,
                  maxWidth: '100%',
                  aspectRatio: '1 / 1',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                No shots yet for {club}
                {lieType ? ` (${lieType})` : ''}
                {lieSlopeForward ? ` (${lieSlopeForward})` : ''}
                {lieSlopeSide ? ` (${lieSlopeSide.replace('_', ' ')})` : ''}.
              </div>
            ) : (
              // Constrain the wrapper so the legend's flex-wrap row wraps
              // within the plot footprint instead of stretching the parent.
              // `maxWidth: 100%` is parent-relative (not 90vw) so the cream
              // box's own padding can't be overrun on narrow viewports.
              <div style={{ width: SVG_SIZE, maxWidth: '100%' }}>
                <DispersionPlot points={points} stats={stats} />
                <PatternLegend hasEllipses={!!stats} />
              </div>
            )}
          </div>

          <div className="flex flex-col" style={{ gap: 22 }}>
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Pattern summary
              </div>
              {stats ? (
                <dl
                  className="grid grid-cols-2"
                  style={{ gap: 18, rowGap: 18 }}
                >
                  <Stat label="Sample" value={`${stats.sampleSize} shots`} />
                  <Stat
                    label="Avg lateral"
                    value={toDisplay(stats.avgLateralOffset, 1)}
                  />
                  <Stat
                    label="Distance bias"
                    value={toDisplay(stats.avgDistanceOffset, 1)}
                  />
                  <Stat label="Shape" value={stats.shotShape} />
                  <Stat label="Dominant miss" value={stats.dominantMiss} />
                  <Stat
                    label="68% spread"
                    value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
                  />
                </dl>
              ) : (
                <p
                  className="font-serif text-caddie-ink"
                  style={{
                    fontSize: 17,
                    lineHeight: 1.55,
                    maxWidth: 480,
                  }}
                >
                  Need at least <em>five shots</em> with aim and landing
                  coordinates to compute a pattern.
                </p>
              )}
            </div>
            {stats && (
              <div
                style={{
                  borderTop: '1px solid #D9D2BF',
                  paddingTop: 18,
                }}
              >
                <div className="kicker" style={{ marginBottom: 10 }}>
                  Aim correction
                </div>
                <p
                  className="font-serif text-caddie-ink"
                  style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 480 }}
                >
                  {getAimCorrection(stats, unit)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14, marginTop: 28 }}>
        <div className="kicker" style={{ marginBottom: 6 }}>
          Ball flight
        </div>
        <div
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, marginBottom: 14, maxWidth: 560 }}
        >
          Each shot at its true carry up the range; the curve shows shape
          (draw/fade). Thick line is your average.
        </div>
        <div
          className="bg-caddie-surface"
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 4,
            padding: 14,
            display: 'inline-block',
          }}
        >
          {isLoading ? (
            <div
              className="flex items-center justify-center text-caddie-ink-mute"
              style={{ width: FLIGHT_VIEW_WIDTH, height: 360, fontSize: 13 }}
            >
              Loading…
            </div>
          ) : !points.some((p) => p.startDistanceOffsetYards != null) ? (
            <div
              className="flex items-center justify-center text-caddie-ink-mute"
              style={{
                width: FLIGHT_VIEW_WIDTH,
                height: 360,
                fontSize: 13,
                textAlign: 'center',
                padding: 20,
              }}
            >
              No shots with recorded start positions for {club} yet.
            </div>
          ) : (
            <BallFlightChart points={points} stats={stats} />
          )}
        </div>
      </div>

      {/* Off-screen render target for the 1200×630 share card. Self-
          contained inline styles so the rasteriser needs no external
          stylesheet at capture time. */}
      {showShareCard && stats && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: -99999,
            top: 0,
            pointerEvents: 'none',
          }}
        >
          <div ref={shareCardRef}>
            <ShotPatternsShareCard
              points={points}
              stats={stats}
              club={club}
              unit={unit}
              toDisplay={toDisplay}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div className="kicker">{kicker}</div>
      </div>
      {children}
    </section>
  )
}

function FilterSection({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div className="kicker">{kicker}</div>
      </div>
      {children}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  }
}

function SelectChips<T extends string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  renderLabel: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={chipStyle(value === opt)}
        >
          {renderLabel(opt)}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </dt>
      <dd
        className="font-serif tabular text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          textTransform: 'capitalize',
          lineHeight: 1.1,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

const DOT_LEGEND = [
  { color: '#1C211C', label: 'Solid' },
  { color: '#A66A1F', label: 'Push / pull' },
  { color: '#A33A2A', label: 'Miss' },
  { color: '#8A8B7E', label: 'Unspecified' },
] as const

const ELLIPSE_LEGEND = [
  { fill: 'rgba(31,61,44,0.12)', dashed: false, label: '68% of shots' },
  { fill: 'rgba(31,61,44,0.06)', dashed: true, label: '95% of shots' },
] as const

function PatternLegend({ hasEllipses }: { hasEllipses: boolean }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
      {DOT_LEGEND.map((item) => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: item.color,
              flexShrink: 0,
            }}
          />
          <span className="kicker" style={{ color: '#8A8B7E' }}>{item.label}</span>
        </span>
      ))}
      {hasEllipses &&
        ELLIPSE_LEGEND.map((item) => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="14" height="10" style={{ flexShrink: 0 }}>
              <ellipse
                cx="7" cy="5" rx="6" ry="4"
                fill={item.fill}
                stroke="#1F3D2C"
                strokeWidth="1"
                strokeDasharray={item.dashed ? '3 2' : undefined}
              />
            </svg>
            <span className="kicker" style={{ color: '#8A8B7E' }}>{item.label}</span>
          </span>
        ))}
    </div>
  )
}

// Top-down ball-flight view (mockup spec). Distinct from DispersionPlot: a
// full-flight chart with the tee at the bottom and the target line up to the
// pin. Each shot is a bezier tee → aim (control) → landing, so shot shape
// reads geometrically. Within one club, carries cluster, so all shots
// normalize to a common tee at the average carry; only lateral is to-scale.
function BallFlightChart({
  points,
  stats,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
}) {
  const { toDisplay } = useUnits()

  const { avgCarry, scale, maxDist, viewCenterLat } = useMemo(() => {
    const carries = points
      .map((p) => p.startDistanceOffsetYards)
      .filter((v): v is number => v != null)
      .map((d) => -d) // start sits ~carry yards short of aim
    const carry = carries.length
      ? carries.reduce((a, b) => a + b, 0) / carries.length
      : 0
    // True distance from the tee per shot = its own carry + long/short vs aim.
    // Shots without a recorded start fall back to the average carry.
    const dists = points.map(
      (p) =>
        (p.startDistanceOffsetYards != null
          ? -p.startDistanceOffsetYards
          : carry) + p.distanceOffsetYards,
    )
    const max = Math.max(...dists, carry, 1) * 1.08
    // Re-center the horizontal view on where the shots actually go, not on the
    // aim line. A player who misses consistently to one side should see that
    // cluster centered, with the aim line (lateral 0) sitting off to the side.
    const viewCenterLat = stats ? stats.avgLateralOffset : 0
    // Half-width must hold the cluster, the 95% cone, AND the tee/aim line
    // (lateral 0) — every arc starts there, so it can never leave the frame.
    const lateralExtent =
      Math.max(
        ...points.map((p) => Math.abs(p.lateralOffsetYards - viewCenterLat)),
        stats ? stats.cone95.lateral : 0,
        Math.abs(viewCenterLat),
        8,
      ) * 1.1
    // One isotropic scale for both axes — distance and lateral shown in true
    // proportion. Vertical fits the longest shot; shrink only if lateral would
    // overflow the width.
    const s = Math.min((FLIGHT_H - 40 - 28) / max, (FLIGHT_W / 2 - 16) / lateralExtent)
    return { avgCarry: carry, scale: s, maxDist: max, viewCenterLat }
  }, [points, stats])

  const cx = FLIGHT_W / 2
  const teeY = FLIGHT_H - 40

  // Degenerate when shots start ~at the target (no meaningful carry to plot).
  if (avgCarry < 5) {
    return (
      <div
        className="flex items-center justify-center text-caddie-ink-mute"
        style={{
          width: FLIGHT_VIEW_WIDTH,
          height: 360,
          fontSize: 13,
          textAlign: 'center',
          padding: 20,
        }}
      >
        These shots don&apos;t have enough start-to-target distance to plot a
        flight path.
      </div>
    )
  }

  const x = (lateralYards: number) => cx + (lateralYards - viewCenterLat) * scale
  const y = (dist: number) => teeY - dist * scale
  // Tee origin = the aim line (lateral 0). Once the view re-centers on the
  // shot cluster this is no longer the chart center.
  const teeX = x(0)
  // Each shot's true forward distance from the tee.
  const carryOf = (p: DispersionPoint) =>
    p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgCarry

  // Driving-range yardage gridlines: finer spacing for short clubs.
  const step = maxDist <= 160 ? 25 : 50
  const gridLines: number[] = []
  for (let d = step; d <= maxDist; d += step) gridLines.push(d)

  return (
    <svg
      viewBox={`0 0 ${FLIGHT_W} ${FLIGHT_H}`}
      style={{
        width: FLIGHT_VIEW_WIDTH,
        height: `calc(${FLIGHT_VIEW_WIDTH} * ${FLIGHT_H} / ${FLIGHT_W})`,
        backgroundColor: '#F2EEE5',
        borderRadius: 2,
        display: 'block',
      }}
    >
      {/* yardage gridlines — the driving-range backdrop */}
      {gridLines.map((d) => (
        <g key={`grid-${d}`}>
          <line
            x1={0}
            y1={y(d)}
            x2={FLIGHT_W}
            y2={y(d)}
            stroke="#E4DECF"
            strokeWidth={1}
          />
          <text
            x={6}
            y={y(d) - 3}
            fontFamily="Inconsolata, monospace"
            fontSize={9}
            letterSpacing="0.1em"
            fill="#8A8B7E"
          >
            {toDisplay(d, 0)}
          </text>
        </g>
      ))}

      {/* aim line (straight-ahead from the tee) — lateral 0, not the chart center */}
      <line
        x1={teeX}
        y1={y(maxDist)}
        x2={teeX}
        y2={teeY}
        stroke="#D9D2BF"
        strokeWidth={0.8}
        strokeDasharray="3 5"
      />

      {/* individual shot flights */}
      <g fill="none">
        {points.map((p) => (
          <path
            key={`flight-${p.id}`}
            d={`M ${teeX} ${teeY} Q ${x(p.lateralOffsetYards)} ${y(carryOf(p))} ${x(p.lateralOffsetYards)} ${y(carryOf(p) + p.distanceOffsetYards)}`}
            stroke={pointColor(p.shotResult).fill}
            strokeOpacity={0.3}
            strokeWidth={1.2}
          />
        ))}
        {stats && (
          <path
            d={`M ${teeX} ${teeY} Q ${x(stats.avgLateralOffset)} ${y(avgCarry)} ${x(stats.avgLateralOffset)} ${y(avgCarry + stats.avgDistanceOffset)}`}
            stroke="#1F3D2C"
            strokeWidth={3}
            strokeOpacity={0.9}
          />
        )}
      </g>

      {/* landing dots */}
      {points.map((p) => {
        const c = pointColor(p.shotResult)
        return (
          <circle
            key={`land-${p.id}`}
            cx={x(p.lateralOffsetYards)}
            cy={y(carryOf(p) + p.distanceOffsetYards)}
            r={2.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      {/* average landing */}
      {stats && (
        <circle
          cx={x(stats.avgLateralOffset)}
          cy={y(avgCarry + stats.avgDistanceOffset)}
          r={4}
          fill="#FBF8F1"
          stroke="#1F3D2C"
          strokeWidth={2}
        />
      )}

      <circle cx={teeX} cy={teeY} r={5} fill="#FBF8F1" stroke="#1C211C" strokeWidth={2} />
      <text
        x={teeX}
        y={teeY + 18}
        fontFamily="Inconsolata, monospace"
        fontSize={9}
        letterSpacing="0.16em"
        fill="#5C6356"
        textAnchor="middle"
      >
        TEE
      </text>
    </svg>
  )
}
