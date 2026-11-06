import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  bothEndsWords,
  falseFront,
  falseFrontWords,
  greenFrame,
  greenHeightWords,
  greenMiddle,
  gridCorners,
  gridPointGeo,
  hachureTriangle,
  pinSheet,
  shapePhrase,
  steepnessTerm,
  YARDS_TO_METERS,
  type DistanceUnit,
  type GeoPoint,
  type PinSheet,
} from '@oga/core'
import { Rocker } from '../../ui/Rocker'
import { P } from '../map/PaperChrome'
import { FLAG_OFFSET, makeFlagMarker } from '../map/markerFactories'
import {
  HEIGHT_STOPS,
  paintGreen,
  SLOPE_FULL_PCT,
  SLOPE_STOPS,
  type GreenData,
  type GreenViewMode,
} from './useGreenMap'

// The green view (#1379 design, #1380): the green on paper, turned to the
// player's line, Plain | Height | Slope, pin-sheet bars in the margin, the
// app's flag. Measurements only, never advice. The desktop scorecard panel
// and the phone-width sheet both render this.

const serif: CSSProperties = { fontFamily: 'var(--caddie-serif)', fontStyle: 'italic', fontWeight: 500 }
const sans: CSSProperties = { fontFamily: 'var(--caddie-sans)' }
const PLAIN = '#E3E8D6'
/** 1 pace = 1 yd (#1379); a personal stride waits for #1387. */
const PACE_M = YARDS_TO_METERS

const VIEWS = [
  { value: 'plain', label: 'Plain' },
  { value: 'height', label: 'Height' },
  { value: 'slope', label: 'Slope' },
] as const

export interface GreenViewProps {
  /** Null: the hole has no green outline. */
  green: GreenData | null
  holeNumber: number
  pin: GeoPoint | null
  /** Compass bearing the player travels toward the green. */
  approachDeg: number
  unit: DistanceUnit
  view: GreenViewMode
  onView: (v: GreenViewMode) => void
  paceLines: boolean
  onPaceLines: (on: boolean) => void
  /** Saves the round's pin, as the map's flag drag does. */
  onMovePin: (p: GeoPoint) => void
  /** The map's pin placement mode (tap where the cup is). */
  onSetPinOnMap: () => void
  /** True while the flag is held, so the map can set its other green effects aside too (#1385). */
  onHold?: (held: boolean) => void
  size: number
}

export function GreenView(p: GreenViewProps) {
  const [dragPin, setDragPin] = useState<GeoPoint | null>(null)
  const held = dragPin != null
  const { onHold } = p
  useEffect(() => {
    if (!held) return
    onHold?.(true)
    // Released, or the view closed mid-drag.
    return () => onHold?.(false)
  }, [held, onHold])
  if (!p.green) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ ...serif, fontSize: 19 }}>No green outline for this hole.</div>
        <div style={{ ...sans, fontSize: 13.5, lineHeight: 1.45, color: P.inkDim }}>
          There&rsquo;s no green to draw, so set the pin straight on the map: tap where the cup is.
        </div>
        <button type="button" className="key key-primary" onClick={p.onSetPinOnMap} style={{ justifySelf: 'start' }}>
          Set pin on the map <span style={{ ...serif, marginLeft: 6 }}>&rarr;</span>
        </button>
      </div>
    )
  }
  const green = p.green
  const pin = dragPin ?? p.pin
  const sheet = pin ? pinSheet(green.outline, pin, p.approachDeg, PACE_M) : null
  const mode: GreenViewMode = green.lidar === 'ready' ? p.view : 'plain'
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ReadLine green={green} approachDeg={p.approachDeg} unit={p.unit} />
      <Rocker
        label="Green view"
        className="rocker-tight"
        options={VIEWS.map((v) => ({ ...v, disabled: v.value !== 'plain' && green.lidar !== 'ready' }))}
        value={mode}
        onChange={p.onView}
      />
      <div style={{ justifySelf: 'center' }}>
        <GreenDrawing
          green={green}
          mode={mode}
          holeNumber={p.holeNumber}
          pin={pin}
          sheet={sheet}
          held={held}
          approachDeg={p.approachDeg}
          size={p.size}
          onDrag={setDragPin}
          onCancel={() => setDragPin(null)}
          onDrop={(q) => {
            setDragPin(null)
            p.onMovePin(q)
          }}
        />
      </div>
      {sheet ? (
        <div data-testid="green-pin-sheet" style={{ ...serif, fontSize: 17 }}>
          Pin {Math.round(sheet.onPaces)} paces on &middot; {Math.round(sheet.sidePaces)} from the {sheet.side} edge
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="key" onClick={p.onSetPinOnMap}>
            Set pin
          </button>
          <span style={{ ...sans, fontSize: 13, color: P.inkDim }}>
            {p.pin ? 'The pin is off the green.' : 'No pin for this hole yet.'}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...sans, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={p.paceLines} onChange={(e) => p.onPaceLines(e.target.checked)} />
          Pace lines on the map
        </label>
        {mode !== 'plain' && <Legend green={green} mode={mode} unit={p.unit} />}
      </div>
      <div style={{ ...sans, fontSize: 11.5, lineHeight: 1.45, color: P.inkDim }}>
        {p.pin && sheet ? 'Drag the flag to set this round’s pin. ' : ''}
        {p.unit === 'meters' ? '1 pace ≈ 0.9 m' : '1 pace = 1 yd'}
        {green.lidar === 'ready' && green.gridSource?.startsWith('3dep') ? ' · USGS 3DEP lidar' : ''}
        {green.outlineSource === 'osm' ? ' · OSM outline' : ''}
      </div>
    </div>
  )
}

function ReadLine({ green, approachDeg, unit }: { green: GreenData; approachDeg: number; unit: DistanceUnit }) {
  const [pct, setPct] = useState(false)
  const s = green.survey
  if (green.lidar !== 'ready' || !s || !s.tilt) {
    const [head, sub] =
      green.lidar === 'loading'
        ? ['Loading the slope survey…', 'The outline is ready; slope follows.']
        : green.lidar === 'error'
          ? ['Outline only', 'The slope survey didn’t load. Check your connection and reopen the hole.']
          : ['Outline only', 'No slope survey covers this green yet.']
    return (
      <div>
        <div style={{ ...serif, fontSize: 18, lineHeight: 1.25 }}>{head}</div>
        <div style={{ ...sans, fontSize: 13, color: P.inkDim }}>{sub}</div>
      </div>
    )
  }
  const ff = falseFront(s.g, s.field, approachDeg)
  const second = ff
    ? `False front · ${falseFrontWords(ff, unit)}`
    : s.shape && s.shape.kind !== 'planar'
      ? shapePhrase(s.shape, approachDeg, unit)
      : 'No false front'
  return (
    <div>
      <div style={{ ...serif, fontSize: 18, lineHeight: 1.25 }}>
        {bothEndsWords(s.tilt.downhillDeg, s.tilt.tiltPct, approachDeg)} &middot;{' '}
        <button
          type="button"
          onClick={() => setPct((v) => !v)}
          title="Show the word or the %"
          style={{
            ...serif,
            fontSize: 18,
            background: 'none',
            border: 'none',
            padding: 0,
            color: P.ink,
            textDecoration: 'underline dotted',
            textUnderlineOffset: 4,
            cursor: 'pointer',
          }}
        >
          {pct ? `${s.tilt.tiltPct.toFixed(1)}%` : steepnessTerm(s.tilt.tiltPct)}
        </button>
      </div>
      <div style={{ ...sans, fontSize: 13, color: P.inkDim }}>{second}</div>
    </div>
  )
}

function Legend({ green, mode, unit }: { green: GreenData; mode: 'height' | 'slope'; unit: DistanceUnit }) {
  const relief = green.survey?.contours.reliefCm ?? 0
  return (
    <span style={{ ...sans, fontSize: 11, color: P.inkDim, display: 'flex', alignItems: 'center', gap: 6 }}>
      {mode === 'height' ? 'Low' : 'Flat'}
      <span
        style={{
          width: 90,
          height: 6,
          border: `1px solid ${P.ink}`,
          background: `linear-gradient(90deg, ${(mode === 'height' ? HEIGHT_STOPS : SLOPE_STOPS).join(',')})`,
        }}
      />
      {mode === 'height' ? `+${greenHeightWords(relief, unit)}` : `${SLOPE_FULL_PCT}%+`}
    </span>
  )
}

function GreenDrawing({
  green,
  mode,
  holeNumber,
  pin,
  sheet,
  held,
  approachDeg,
  size,
  onDrag,
  onDrop,
  onCancel,
}: {
  green: GreenData
  mode: GreenViewMode
  holeNumber: number
  pin: GeoPoint | null
  sheet: PinSheet | null
  /** The flag is held: everything but the outline, the pin, the rails and the bars is set aside (#1385). */
  held: boolean
  approachDeg: number
  size: number
  onDrag: (p: GeoPoint) => void
  onDrop: (p: GeoPoint) => void
  onCancel: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  // Pointer moves can outrun the screen: the pin (and its paces) move at most once a frame.
  const pending = useRef<GeoPoint | null>(null)
  const frameReq = useRef(0)
  const endDrag = () => {
    dragging.current = false
    cancelAnimationFrame(frameReq.current)
    frameReq.current = 0
  }
  const { outline, survey } = green
  // The frame turns on the green's middle, so dragging the pin never turns the drawing.
  const frame = useMemo(() => greenFrame(greenMiddle(outline), approachDeg), [outline, approachDeg])
  // SVG units are metres: x right, y down the page (toward the player).
  const svg = (q: GeoPoint): [number, number] => {
    const l = frame.toLocal(q)
    return [l.x, -l.y]
  }
  const ring = outline.map(svg)
  const xs = ring.map((q) => q[0])
  const ys = ring.map((q) => q[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const span = Math.max(maxX - minX, maxY - minY) * 1.38
  const vbx = (minX + maxX) / 2 - span / 2 - span * 0.04
  const vby = (minY + maxY) / 2 - span / 2 + span * 0.01
  const u = span / 100
  const pts = ring.map((q) => q.join(',')).join(' ')
  const clipId = `green-clip-${holeNumber}-${size}`

  const image = useMemo(() => {
    if (!survey || mode === 'plain') return null
    const canvas = document.createElement('canvas')
    paintGreen(canvas, survey, mode)
    return canvas.toDataURL()
  }, [survey, mode])
  const origin = survey ? svg({ lat: survey.lat0, lng: survey.lng0 }) : [0, 0]
  const gridGroup = `translate(${origin[0]} ${origin[1]}) rotate(${-approachDeg})`

  // Memoised so a drag frame re-renders the pin, not every mark.
  const effects = useMemo(() => {
    if (!survey) return null
    const [c0, , c2] = gridCorners(survey.g.width, survey.g.height)
    const [x0, y0] = c0!
    const [x2, y2] = c2!
    return (
      <>
        {survey && mode !== 'plain' && (
          <g clipPath={`url(#${clipId})`}>
            <g transform={gridGroup}>
              {image && (
                <image
                  href={image}
                  x={x0}
                  y={y0}
                  width={x2 - x0}
                  height={y2 - y0}
                  preserveAspectRatio="none"
                />
              )}
              {mode === 'height' &&
                survey.contours.levels.map((l) => (
                  <path
                    key={l.mm}
                    d={l.segments.map(([a, b, c, d]) => `M${a},${b}L${c},${d}`).join('')}
                    fill="none"
                    stroke={P.ink}
                    strokeOpacity={0.35}
                    strokeWidth={0.2 * u}
                    strokeLinecap="round"
                  />
                ))}
              {mode === 'slope' &&
                survey.hachures.map((h, i) => (
                  <polygon
                    key={i}
                    points={hachureTriangle(h).map((q) => q.join(',')).join(' ')}
                    fill={P.raised}
                    stroke="rgba(28,33,28,.65)"
                    strokeWidth={0.18 * u}
                    strokeLinejoin="round"
                  />
                ))}
            </g>
          </g>
        )}
        {survey &&
          mode === 'height' &&
          (['low', 'high'] as const).map((k) => {
            const at = survey.contours[k]
            if (!at) return null
            const [x, y] = svg(gridPointGeo(survey.lng0, survey.lat0, at.eastM, at.southM))
            return (
              <text
                key={k}
                x={x}
                y={y + 1.2 * u}
                textAnchor="middle"
                style={{ ...serif, fontSize: 3.6 * u }}
                fill={P.ink}
                stroke={P.raised}
                strokeWidth={0.6 * u}
                paintOrder="stroke"
              >
                {k}
              </text>
            )
          })}
      </>
    )
    // svg() reads only frame.
  }, [survey, mode, image, clipId, gridGroup, u, frame])

  const pinXY = pin ? svg(pin) : null
  const barX = minX - 7 * u
  const barY = minY - 7 * u
  const flagHtml = useMemo(() => makeFlagMarker({ hole: holeNumber, strong: true }).content.innerHTML, [holeNumber])
  const flagScale = size < 260 ? 0.75 : 0.9

  const toGeo = (e: PointerEvent): GeoPoint | null => {
    const s = svgRef.current
    const m = s?.getScreenCTM()
    if (!s || !m) return null
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return frame.toGeo(q.x, -q.y)
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, userSelect: 'none' }} data-testid="green-drawing">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`${vbx} ${vby} ${span} ${span}`}
        style={{ display: 'block', background: P.raised, touchAction: 'none' }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          pending.current = toGeo(e)
          if (frameReq.current) return
          frameReq.current = requestAnimationFrame(() => {
            frameReq.current = 0
            if (pending.current) onDrag(pending.current)
          })
        }}
        onPointerCancel={() => {
          // A cancelled drag (touch interrupted, capture lost) saves nothing.
          if (!dragging.current) return
          endDrag()
          onCancel()
        }}
        onLostPointerCapture={() => {
          if (!dragging.current) return
          endDrag()
          onCancel()
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return
          endDrag()
          const q = toGeo(e)
          if (q) onDrop(q)
          else onCancel()
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points={pts} />
          </clipPath>
        </defs>
        <polygon points={pts} fill={PLAIN} />
        {/* Hidden, not unmounted, while the flag is held: release brings it back with no repaint. */}
        <g display={held ? 'none' : undefined}>{effects}</g>
        <polygon
          points={pts}
          fill="none"
          stroke={P.ink}
          strokeWidth={0.35 * u}
          strokeLinejoin="round"
          strokeDasharray={green.lidar === 'loading' ? `${1.6 * u} ${1.2 * u}` : undefined}
        />
        {sheet && pinXY && (
          <PinSheetBars sheet={sheet} pin={pinXY} barX={barX} barY={barY} u={u} />
        )}
        {held && sheet && pinXY && <Rails sheet={sheet} pin={pinXY} u={u} />}
        {/* You play from the bottom. */}
        <path
          d={`M${(minX + maxX) / 2},${maxY + 6 * u} l${-1.8 * u},${2.8 * u} M${(minX + maxX) / 2},${maxY + 6 * u} l${1.8 * u},${2.8 * u} M${(minX + maxX) / 2},${maxY + 6 * u} v${6 * u}`}
          stroke={P.inkDim}
          strokeWidth={0.3 * u}
          fill="none"
        />
        {pinXY && (
          <circle
            cx={pinXY[0]}
            cy={pinXY[1]}
            r={4 * u}
            fill="transparent"
            style={{ cursor: 'grab' }}
            data-testid="green-pin-handle"
            onPointerDown={(e) => {
              dragging.current = true
              svgRef.current?.setPointerCapture(e.pointerId)
              // Held from the press: the other effects step aside before the first move.
              if (pin) onDrag(pin)
            }}
          />
        )}
      </svg>
      {pinXY && (
        // The app's G4 flag, the same glyph as the map's.
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: ((pinXY[0] - vbx) / span) * size + FLAG_OFFSET[0],
            top: ((pinXY[1] - vby) / span) * size + FLAG_OFFSET[1],
            pointerEvents: 'none',
            transform: `scale(${flagScale})`,
            transformOrigin: `${-FLAG_OFFSET[0]}px ${-FLAG_OFFSET[1]}px`,
          }}
          dangerouslySetInnerHTML={{ __html: flagHtml }}
        />
      )}
    </div>
  )
}

// The rails (#1385): while the flag is held, dashed cream lines with an ink
// halo from the pin to the front edge along the player's line and to the
// nearer side edge, where pinSheet measured. They guide the eye; the pin
// goes only where the finger puts it.
function Rails({ sheet, pin, u }: { sheet: PinSheet; pin: [number, number]; u: number }) {
  const [x, y] = pin
  const ends: [number, number][] = [
    [x, y + sheet.onPaces * PACE_M],
    [x + (sheet.side === 'left' ? -1 : 1) * sheet.sidePaces * PACE_M, y],
  ]
  return (
    <g data-testid="green-pin-rails" fill="none" strokeLinecap="round">
      {ends.map(([ex, ey], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={ex} y2={ey} stroke={P.ink} strokeOpacity={0.8} strokeWidth={1.5 * u} />
          <line x1={x} y1={y} x2={ex} y2={ey} stroke={P.raised} strokeWidth={0.75 * u} strokeDasharray={`${2 * u} ${1.4 * u}`} />
        </g>
      ))}
    </g>
  )
}

// Pin-sheet dimension bars (#1379 reading 2): paces on from the front edge in
// the left margin, paces from the side edge across the top, a tick per pace.
function PinSheetBars({
  sheet,
  pin,
  barX,
  barY,
  u,
}: {
  sheet: PinSheet
  pin: [number, number]
  barX: number
  barY: number
  u: number
}) {
  const front = pin[1] + sheet.onPaces * PACE_M
  const dir = sheet.side === 'left' ? 1 : -1
  const sideX = pin[0] - dir * sheet.sidePaces * PACE_M
  const ticks = (n: number) => Array.from({ length: Math.floor(n + 1e-9) + 1 }, (_, i) => i)
  const tick = (i: number) => (i % 5 === 0 ? 1.4 : 0.7) * u
  return (
    <g>
      <g stroke={P.ink} fill="none">
        <g strokeWidth={0.18 * u} strokeDasharray={`${0.8 * u} ${0.8 * u}`} opacity={0.7}>
          <line x1={barX} x2={pin[0]} y1={front} y2={front} />
          <line x1={barX} x2={pin[0]} y1={pin[1]} y2={pin[1]} />
          <line x1={sideX} x2={sideX} y1={barY} y2={pin[1]} />
          <line x1={pin[0]} x2={pin[0]} y1={barY} y2={pin[1]} />
        </g>
        <line x1={barX} x2={barX} y1={front} y2={pin[1]} strokeWidth={0.32 * u} />
        {ticks(sheet.onPaces).map((i) => (
          <line key={i} x1={barX - tick(i)} x2={barX + tick(i)} y1={front - i * PACE_M} y2={front - i * PACE_M} strokeWidth={0.22 * u} />
        ))}
        <line x1={sideX} x2={pin[0]} y1={barY} y2={barY} strokeWidth={0.32 * u} />
        {ticks(sheet.sidePaces).map((i) => {
          const x = sideX + dir * i * PACE_M
          return <line key={i} x1={x} x2={x} y1={barY - tick(i)} y2={barY + tick(i)} strokeWidth={0.22 * u} />
        })}
      </g>
      <g style={{ ...serif, fontSize: 4.6 * u }} fill={P.ink}>
        <text x={barX - 2.4 * u} y={(front + pin[1]) / 2 + 1.6 * u} textAnchor="end">
          {Math.round(sheet.onPaces)}
        </text>
        <text x={(sideX + pin[0]) / 2} y={barY - 2.4 * u} textAnchor="middle">
          {Math.round(sheet.sidePaces)}
        </text>
      </g>
    </g>
  )
}
