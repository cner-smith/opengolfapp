import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { gridCorners, gridPointGeo, greenFrame, greenMiddle, hachureTriangle, type GeoPoint, type PinSheet } from '@oga/core'
import { FONT } from '../../../lib/typography'
import { P } from '../../paper/tokens'
import { FlagSvg } from '../markers/FlagMarker'
import type { PreparedGreen } from './greenData'

// The green drawn for the mini key and the green view (#1381, design locked on
// #1379): Plain fill, the Slope or Height picture, marks, contours, the flag
// and the pin-sheet bars, turned so the player's line runs up the screen.

export type GreenMode = 'plain' | 'height' | 'slope'

/** Plain's fill: a pale turf the outline reads on. */
const PLAIN = '#E3E8D6'
const PACE_M = 0.9144
/** The flag's pin point in its 38×48 box. */
const FLAG_X = 9 / 38
const FLAG_Y = 42 / 48

// The native path parser rejects long float tails (see FlagMarker).
const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Core's turned frame (#1380) as screen metres: x right, y down the screen (toward the player). */
export interface ScreenFrame {
  to: (p: GeoPoint) => [number, number]
  from: (xy: [number, number]) => GeoPoint
  /** Screen direction of a compass bearing. */
  dir: (deg: number) => [number, number]
  /** The outline's box in the frame. */
  box: { x0: number; y0: number; x1: number; y1: number }
  ring: [number, number][]
}

export function screenFrame(ring: GeoPoint[], approachDeg: number): ScreenFrame {
  const f = greenFrame(greenMiddle(ring), approachDeg)
  const to = (p: GeoPoint): [number, number] => {
    const q = f.toLocal(p)
    return [q.x, -q.y]
  }
  const dir = (deg: number): [number, number] => {
    const a = ((deg - approachDeg) * Math.PI) / 180
    return [Math.sin(a), -Math.cos(a)]
  }
  const pts = ring.map(to)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  return {
    to,
    from: ([x, y]) => f.toGeo(x, -y),
    dir,
    ring: pts,
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
  }
}

export interface GreenLayout {
  /** px per metre */
  s: number
  /** viewBox origin, metres */
  vx: number
  vy: number
}

/** Fits the outline's box into `w`×`h` by both axes, at `fit` of each. */
export function fitGreen(frame: ScreenFrame, w: number, h: number, fit: number): GreenLayout {
  const { x0, x1, y0, y1 } = frame.box
  const s = Math.min((w * fit) / Math.max(x1 - x0, 1), (h * fit) / Math.max(y1 - y0, 1))
  return { s, vx: (x0 + x1) / 2 - w / (2 * s), vy: (y0 + y1) / 2 - h / (2 * s) }
}

export function GreenDrawing({
  green,
  frame,
  layout,
  width,
  height,
  mode,
  pin,
  sheet,
  holeNumber,
  flagHeight,
  mini = false,
  dashed = false,
  rails = false,
}: {
  green: PreparedGreen
  frame: ScreenFrame
  layout: GreenLayout
  width: number
  height: number
  mode: GreenMode
  pin: GeoPoint | null
  sheet: PinSheet | null
  holeNumber: number
  flagHeight: number
  mini?: boolean
  /** The grid is still being read. */
  dashed?: boolean
  /** The flag is held: draw the rails to the edges (#1385). */
  rails?: boolean
}) {
  const { s, vx, vy } = layout
  const u = 1 / s
  const lidar = typeof green.lidar === 'object' ? green.lidar : null
  const shown = lidar ? mode : 'plain'
  const outline = useMemo(() => `M${frame.ring.map(([x, y]) => `${r3(x)} ${r3(y)}`).join(' L')} Z`, [frame])

  const marks = useMemo(() => {
    if (!lidar || mini || shown !== 'slope') return null
    return lidar.hachures
      .map((m) => {
        const w = hachureTriangle(m).map(([e, so]) => frame.to(gridPointGeo(lidar.lng0, lidar.lat0, e, so)))
        return `M${w.map(([x, y]) => `${r3(x)} ${r3(y)}`).join(' L')} Z`
      })
      .join(' ')
  }, [lidar, frame, shown, mini])

  const contours = useMemo(() => {
    if (!lidar || mini || shown !== 'height') return null
    const to = (e: number, so: number) => frame.to(gridPointGeo(lidar.lng0, lidar.lat0, e, so)).map(r3).join(' ')
    return lidar.contours.levels
      .flatMap((l) => l.segments.map(([e1, s1, e2, s2]) => `M${to(e1, s1)} L${to(e2, s2)}`))
      .join(' ')
  }, [lidar, frame, shown, mini])

  // The picture's north-west corner (the cells' outer edge), turned with the frame.
  const picture = useMemo(() => {
    if (!lidar || shown === 'plain') return null
    const [w, so] = gridCorners(lidar.grid.width, lidar.grid.height)[0]!
    const nw = frame.to(gridPointGeo(lidar.lng0, lidar.lat0, w, so))
    const [dx, dy] = frame.dir(0)
    const turn = (Math.atan2(dx, -dy) * 180) / Math.PI
    return {
      transform: `translate(${r3(nw[0])} ${r3(nw[1])}) rotate(${r3(turn)})`,
      w: gridCorners(lidar.grid.width, lidar.grid.height)[2]![0] - w,
      h: gridCorners(lidar.grid.width, lidar.grid.height)[2]![1] - so,
      uri: shown === 'slope' ? lidar.slopeUri : lidar.heightUri,
    }
  }, [lidar, frame, shown])

  const pinXY = pin ? frame.to(pin) : null
  const flagPx = pinXY ? [(pinXY[0] - vx) * s, (pinXY[1] - vy) * s] : null

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`${r3(vx)} ${r3(vy)} ${r3(width / s)} ${r3(height / s)}`}>
        <Path d={outline} fill={PLAIN} />
        {/* Not clipped to the outline: react-native-svg drops an Image inside a
            clipPath on Android. The picture is transparent off the green anyway. */}
        {picture && (
          <G transform={picture.transform}>
            <SvgImage href={picture.uri} x={0} y={0} width={picture.w} height={picture.h} preserveAspectRatio="none" />
          </G>
        )}
        {contours && <Path d={contours} fill="none" stroke={P.ink} strokeOpacity={0.35} strokeWidth={u} />}
        {marks && <Path d={marks} fill={P.raised} stroke="rgba(28,33,28,.65)" strokeWidth={u} strokeLinejoin="round" />}
        <Path
          d={outline}
          fill="none"
          stroke={P.ink}
          strokeWidth={(mini ? 1 : 1.5) * u}
          strokeLinejoin="round"
          strokeDasharray={dashed ? `${r3(4 * u)} ${r3(3 * u)}` : undefined}
        />
        {lidar && !mini && shown === 'height' &&
          (['low', 'high'] as const).map((k) => {
            const at = lidar.contours[k]
            if (!at) return null
            const [x, y] = frame.to(gridPointGeo(lidar.lng0, lidar.lat0, at.eastM, at.southM))
            const w = (k === 'low' ? 32 : 38) * u
            return (
              <G key={k}>
                <Rect x={x - w / 2} y={y - 8 * u} width={w} height={15 * u} rx={2 * u} fill={P.raised} stroke={P.ink} strokeWidth={u} />
                <SvgText x={x} y={y + 4 * u} textAnchor="middle" fontSize={11 * u} fill={P.ink} fontFamily={FONT.serifItalic}>
                  {k}
                </SvgText>
              </G>
            )
          })}
        {!mini && pinXY && sheet && <MarginBars frame={frame} pin={pinXY} sheet={sheet} u={u} />}
        {rails && !mini && pinXY && sheet && <Rails pin={pinXY} sheet={sheet} u={u} />}
      </Svg>
      {flagPx && (
        <FlagSvg
          tone={sheet || !mini ? 'strong' : 'dim'}
          hole={holeNumber}
          k={0.8}
          height={flagHeight}
          style={{
            position: 'absolute',
            left: flagPx[0]! - FLAG_X * ((38 * flagHeight) / 48),
            top: flagPx[1]! - FLAG_Y * flagHeight,
          }}
        />
      )}
    </View>
  )
}

// The rails (#1385): while the flag is held, dashed cream lines with an ink
// halo from the pin to the front edge along the player's line and to the
// nearer side edge, where pinSheet measured. They guide the eye; the pin goes
// only where the finger puts it.
function Rails({ pin, sheet, u }: { pin: [number, number]; sheet: PinSheet; u: number }) {
  const [px, py] = pin
  const ends: [number, number][] = [
    [px, py + sheet.onPaces * PACE_M],
    [px + (sheet.side === 'left' ? -1 : 1) * sheet.sidePaces * PACE_M, py],
  ]
  return (
    <G>
      {ends.map(([x, y], i) => (
        <G key={i}>
          <Line x1={px} y1={py} x2={x} y2={y} stroke={P.ink} strokeOpacity={0.75} strokeWidth={3.4 * u} strokeLinecap="round" />
          <Line x1={px} y1={py} x2={x} y2={y} stroke={P.raised} strokeWidth={1.6 * u} strokeDasharray={`${r3(5 * u)} ${r3(3.5 * u)}`} />
        </G>
      ))}
    </G>
  )
}

// Pin-sheet dimension bars in the margin, like a yardage book: paces on from
// the front edge (left margin) and from the nearer side edge (top margin).
function MarginBars({ frame, pin, sheet, u }: { frame: ScreenFrame; pin: [number, number]; sheet: PinSheet; u: number }) {
  const [px, py] = pin
  const yFront = py + sheet.onPaces * PACE_M
  const xEdge = px + (sheet.side === 'left' ? -1 : 1) * sheet.sidePaces * PACE_M
  const span = Math.max(frame.box.x1 - frame.box.x0, frame.box.y1 - frame.box.y0)
  const xB = frame.box.x0 - 0.1 * span
  const yB = frame.box.y0 - 0.08 * span
  const ext = { stroke: P.ink, strokeWidth: 0.8 * u, strokeOpacity: 0.7, strokeDasharray: `${r3(2.5 * u)} ${r3(2.5 * u)}` }
  const ticks = (from: number, to: number) => {
    const out: { at: number; big: boolean }[] = []
    const sign = to >= from ? 1 : -1
    for (let k = 1; k < 80 && k * PACE_M <= Math.abs(to - from) + 0.01; k++) out.push({ at: from + sign * k * PACE_M, big: k % 5 === 0 })
    return out
  }
  const label = (n: number) => String(Math.round(n))
  return (
    <G>
      <Line x1={px} y1={yFront} x2={xB - 3 * u} y2={yFront} {...ext} />
      <Line x1={px} y1={py} x2={xB - 3 * u} y2={py} {...ext} />
      <Line x1={xB} y1={yFront} x2={xB} y2={py} stroke={P.ink} strokeWidth={1.3 * u} />
      {ticks(yFront, py).map((t) => (
        <Line key={t.at} x1={xB} x2={xB + (t.big ? 7 : 3.5) * u} y1={t.at} y2={t.at} stroke={P.ink} strokeWidth={u} />
      ))}
      <Line x1={xB - 4 * u} x2={xB + 4 * u} y1={yFront} y2={yFront} stroke={P.ink} strokeWidth={1.5 * u} />
      <Line x1={xB - 4 * u} x2={xB + 4 * u} y1={py} y2={py} stroke={P.ink} strokeWidth={1.5 * u} />
      <SvgText x={xB - 6 * u} y={(yFront + py) / 2 + 5 * u} textAnchor="end" fontSize={15 * u} fill={P.ink} fontFamily={FONT.serifItalic}>
        {label(sheet.onPaces)}
      </SvgText>
      <Line x1={px} y1={py} x2={px} y2={yB - 3 * u} {...ext} />
      <Line x1={xEdge} y1={py} x2={xEdge} y2={yB - 3 * u} {...ext} />
      <Line x1={xEdge} y1={yB} x2={px} y2={yB} stroke={P.ink} strokeWidth={1.3 * u} />
      {ticks(xEdge, px).map((t) => (
        <Line key={t.at} x1={t.at} x2={t.at} y1={yB} y2={yB + (t.big ? 7 : 3.5) * u} stroke={P.ink} strokeWidth={u} />
      ))}
      <Line x1={xEdge} x2={xEdge} y1={yB - 4 * u} y2={yB + 4 * u} stroke={P.ink} strokeWidth={1.5 * u} />
      <Line x1={px} x2={px} y1={yB - 4 * u} y2={yB + 4 * u} stroke={P.ink} strokeWidth={1.5 * u} />
      <SvgText x={(px + xEdge) / 2} y={yB - 6 * u} textAnchor="middle" fontSize={15 * u} fill={P.ink} fontFamily={FONT.serifItalic}>
        {label(sheet.sidePaces)}
      </SvgText>
    </G>
  )
}
