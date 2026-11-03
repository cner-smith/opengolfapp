import { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { P } from '../paper/tokens'
import { ROLL, buildRollPaths } from '@oga/core'

// A ball rolls along a pencil line until the answer is in. Then a cup slides
// into frame and it either drops or horseshoes out. One clock on the UI thread
// reads the pre-computed tables, so nothing here depends on the JS thread.
const { ballR: BALL_R, k: K, cos: COS } = ROLL
const W = 330
const H = 216
const D = BALL_R * 2
const PATHS = buildRollPaths()
const { lip, hole, cup, holeDy, coverFrom, coverTo } = PATHS
const LIP = { n: lip.n, x: lip.x, y: lip.y, dx: lip.dx, dz: lip.dz, drop: lip.drop, scroll: lip.scroll }
const HOLE = { n: hole.n, x: hole.x, y: hole.y, dx: hole.dx, dz: hole.dz, drop: hole.drop, scroll: hole.scroll }
const LINE_Y = lip.y[0]!
const START_X = lip.x[0]!
const REST_X = lip.x[lip.n - 1]!
const REST_Y = lip.y[lip.n - 1]!
// Fully behind the near lip: from here the ball simply isn't drawn.
const GONE_Y = cup.y + cup.r * K + BALL_R * (1 + COS) + 1
const TILE = 44
const SHADOW_RX = BALL_R * 0.9
const BUMP_EVERY = 520
const BUMP_LEN = 74
const RX = cup.r
const RY = cup.r * K
// The pencil line stops this far short of the rim, so it can't merge with the
// dark far wall.
const LINE_GAP = 5
// The near half of a ground ellipse, y at x. Null past its ends.
const below = (x: number, rx: number, ry: number) => {
  const u = (x - cup.x) / rx
  return u * u <= 1 ? cup.y + ry * Math.sqrt(1 - u * u) : null
}
const span = (n: number, from: number, to: number) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n)
const COVER_L = cup.x - RX - 8
const COVER_R = cup.x + RX + 8
const COVER_B = GONE_Y + 3
// Even round the rim, where a straight x step would facet the steep ends.
const coverXs = [COVER_L, ...span(90, Math.PI, 0).map((t) => cup.x + RX * Math.cos(t)), COVER_R]
// Paper over the ball, cut to the near rim. Past the rim's ends it stays below
// the pencil line and its ticks, which run up to the hole on both sides.
const COVER = `M${coverXs.map((x) => `${x} ${below(x, RX, RY) ?? cup.y + 13}`).join(' L')} L${COVER_R} ${COVER_B} L${COVER_L} ${COVER_B} Z`
// The rim's own curve moved by a depth: the far shade below the far rim, the
// near shade above the near rim. Both stay inside the one ellipse.
const shade = (depth: number, near: boolean) => {
  const rim = span(90, Math.PI, near ? 0 : 2 * Math.PI).map((t) => [cup.x + RX * Math.cos(t), cup.y + RY * Math.sin(t)] as const)
  const inner = [...rim].reverse().map(([x, y]) => [x, cup.y + (y - cup.y) * Math.max(0, 1 - depth / RY)] as const)
  return `M${[...rim, ...inner].map(([x, y]) => `${x} ${y}`).join(' L')} Z`
}
const FAR_SHADE = shade(5, false)
const NEAR_SHADE = shade(1.6, true)
// Dimples on the unit sphere: rotated each frame, so the roll is the real one.
const DIMPLES = [
  [0.0, 1.0, 0.0], [0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0],
  [0.58, 0.58, 0.58], [-0.58, 0.58, 0.58], [0.58, -0.58, 0.58], [-0.58, -0.58, 0.58],
  [0.58, 0.58, -0.58], [-0.58, 0.58, -0.58], [0.58, -0.58, -0.58], [-0.58, -0.58, -0.58],
] as const


type Quat = [number, number, number, number]

// A grass tick under the line. Near the hole it fades away, so none is left
// at the rim for the cover to hide or reveal.
function Tick({ i, line, cupOff, shown }: { i: number; line: SharedValue<number>; cupOff: SharedValue<number>; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const x = i * TILE + 6.5 - TILE * 2 - (line.value % TILE)
    const away = Math.abs(x - cup.x - cupOff.value) - RX - 12
    return { opacity: 1 - shown.value * (1 - Math.max(0, Math.min(1, away / 14))) }
  })
  return (
    <Animated.View
      collapsable={false}
      style={[{ position: 'absolute', left: i * TILE + 6, top: 7, width: 1.2, height: 5, backgroundColor: P.lineStrong, transform: [{ rotate: '37deg' }] }, style]}
    />
  )
}

function Dimple({ q, v }: { q: SharedValue<Quat>; v: readonly [number, number, number] }) {
  const style = useAnimatedStyle(() => {
    const [w, a, b, c] = q.value
    const [x, y, z] = v
    // Quaternion rotate, then the camera's tilt.
    const tx = 2 * (b * z - c * y)
    const ty = 2 * (c * x - a * z)
    const tz = 2 * (a * y - b * x)
    const rx = x + w * tx + (b * tz - c * ty)
    const ry = y + w * ty + (c * tx - a * tz)
    const rz = z + w * tz + (a * ty - b * tx)
    const sy = ry * COS - rz * K
    const depth = rz * COS + ry * K
    const size = 0.55 + 0.45 * depth
    return {
      opacity: depth > 0.06 ? Math.min(1, depth * 3.5) : 0,
      transform: [
        { translateX: rx * (BALL_R - 3) },
        { translateY: -sy * (BALL_R - 3) },
        { scale: size },
      ],
    }
  })
  return (
    <Animated.View
      collapsable={false}
      style={[{ position: 'absolute', left: BALL_R - 2, top: BALL_R - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: P.lineStrong }, style]}
    />
  )
}

export function SlowStartArt({
  noSignal,
  connected,
  reduced,
  onRest,
}: {
  noSignal: boolean
  /** Rolls on for a hole-in, if it's known before the cup starts. */
  connected: boolean
  reduced: boolean
  onRest: () => void
}) {
  const answer = useSharedValue(0) // 0 waiting, 1 lip-out, 2 hole-in
  const mode = useSharedValue(0) // 0 rolling, 1 on a table, 2 finished
  const clock = useSharedValue(0)
  const speed = useSharedValue(230)
  const dist = useSharedValue(0)
  const tableTime = useSharedValue(0)
  const locked = useSharedValue(0)
  const cupDy = useSharedValue(0)
  const q = useSharedValue<Quat>([1, 0, 0, 0])
  const bx = useSharedValue(reduced ? REST_X : START_X)
  const by = useSharedValue(reduced ? REST_Y : LINE_Y)
  const hop = useSharedValue(0)
  const drop = useSharedValue(0)
  const lineOff = useSharedValue(0)
  const cupOff = useSharedValue(reduced ? 0 : lip.scroll[0]!)

  useEffect(() => {
    answer.value = connected ? 2 : noSignal ? 1 : 0
    if (reduced && (noSignal || connected)) {
      onRest()
    }
  }, [connected, noSignal, reduced, answer, onRest])

  useFrameCallback((frame) => {
    'worklet'
    if (reduced || mode.value === 2) return
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 34) / 1000
    clock.value += dt
    let mx = 0
    let mz = 0
    if (mode.value === 0) {
      const t = clock.value
      const lively = 236 + 58 * Math.sin(t * 2.1) + 26 * Math.sin(t * 5.3 + 1)
      const target = answer.value ? ROLL.vStart : lively
      speed.value += (target - speed.value) * Math.min(1, dt * (answer.value ? 5 : 3))
      const step = speed.value * dt
      dist.value += step
      mx = step
      lineOff.value += step
      const u = (dist.value % BUMP_EVERY) / BUMP_LEN
      const big = Math.floor(dist.value / BUMP_EVERY) % 2 === 0 ? 15 : 9
      hop.value = u < 1 ? big * Math.sin(Math.PI * u) : 0
      if (answer.value && u >= 1 && Math.abs(speed.value - ROLL.vStart) < 3) {
        // Decided here for good: the cup goes to that outcome's spot, and a
        // later answer can't change the run.
        locked.value = answer.value
        cupDy.value = answer.value === 2 ? holeDy : 0
        mode.value = 1
        tableTime.value = 0
      }
    } else {
      tableTime.value += dt
      const at = tableTime.value / ROLL.dt
      const pick = locked.value === 2
      const T = pick ? HOLE : LIP
      const i = Math.min(T.n - 2, Math.floor(at))
      const f = Math.min(1, at - i)
      const nx = T.x[i]! + (T.x[i + 1]! - T.x[i]!) * f
      const ny = T.y[i]! + (T.y[i + 1]! - T.y[i]!) * f
      const nd = T.drop[i]! + (T.drop[i + 1]! - T.drop[i]!) * f
      const ns = T.scroll[i]! + (T.scroll[i + 1]! - T.scroll[i]!) * f
      lineOff.value += cupOff.value - ns
      const rate = dt / ROLL.dt
      mx = T.dx[i + 1]! * rate
      mz = T.dz[i + 1]! * rate
      bx.value = nx
      by.value = ny
      drop.value = nd
      cupOff.value = ns
      if (at >= T.n - 1) {
        mode.value = 2
        runOnJS(onRest)()
      }
    }
    const len = Math.hypot(mx, mz)
    if (len > 1e-4) {
      const half = len / BALL_R / 2
      const s = Math.sin(half) / len
      // Axis = up x travel, in (right, up, towards the viewer).
      const ax = -mz * s
      const cz = -mx * s
      const dw = Math.cos(half)
      const [w, a, b, c] = q.value
      const nw = dw * w - ax * a - cz * c
      const na = dw * a + ax * w + 0 * c - cz * b
      const nb = dw * b + cz * a - ax * c
      const nc = dw * c + ax * b + cz * w
      const norm = Math.hypot(nw, na, nb, nc)
      q.value = [nw / norm, na / norm, nb / norm, nc / norm]
    }
  })

  const ball = useAnimatedStyle(() => {
    const land = hop.value > 0 && hop.value < 2.2 ? (2.2 - hop.value) / 2.2 : 0
    const sy = 1 - 0.1 * land
    const sx = 1 + 0.1 * land
    return {
      opacity: by.value > GONE_Y + cupDy.value ? 0 : 1,
      transform: [
        { translateX: bx.value - BALL_R },
        { translateY: by.value - hop.value * COS - BALL_R * COS - BALL_R + (D * (1 - sy)) / 2 },
        { scaleX: sx },
        { scaleY: sy },
      ],
    }
  })
  // On the ground, round the contact point: an ellipse in the camera's tilt.
  const shadow = useAnimatedStyle(() => ({
    opacity: Math.max(0, 0.26 - 0.012 * hop.value - 0.03 * drop.value),
    transform: [
      { translateX: bx.value - SHADOW_RX },
      { translateY: by.value - SHADOW_RX },
      { scaleX: 1 - 0.012 * hop.value },
      { scaleY: K * (1 - 0.012 * hop.value) },
    ],
  }))
  // The hole-in goes behind this all the way. The lip-out climbs back over it.
  const cover = useAnimatedStyle(() => {
    const at = tableTime.value / ROLL.dt
    const climb = locked.value === 1 ? Math.max(0, Math.min(1, (coverTo - at) / (coverTo - coverFrom))) : 1
    return {
      // Fades in with the cup: the pencil ticks under it would otherwise pop.
      opacity: reduced || mode.value === 0 || by.value > GONE_Y + cupDy.value ? 0 : Math.min(1, tableTime.value / 0.28) * climb,
      transform: [{ translateX: cupOff.value }, { translateY: cupDy.value }],
    }
  })
  const cupShown = useDerivedValue(() => (reduced || mode.value === 2 ? 1 : mode.value === 0 ? 0 : Math.min(1, tableTime.value / 0.28)))
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: -(lineOff.value % TILE) }] }))
  const slide = useAnimatedStyle(() => ({
    opacity: reduced || mode.value === 2 ? 1 : mode.value === 0 ? 0 : Math.min(1, tableTime.value / 0.28),
    transform: [{ translateX: cupOff.value }, { translateY: cupDy.value }],
  }))
  return (
    <View style={{ width: W, height: H }}>
      <Animated.View collapsable={false} style={[{ position: 'absolute', left: -TILE * 2, top: LINE_Y - 4, width: W + TILE * 6 }, line]}>
        <Svg width={W + TILE * 6} height={12}>
          <Path
            d={`M0 4 ${Array.from({ length: Math.ceil(W / TILE) + 6 }, (_, i) => `Q${i * TILE + 11} ${i % 2 ? 2.4 : 5.6} ${i * TILE + 22} 4 T${(i + 1) * TILE} 4`).join(' ')}`}
            stroke={P.graphite}
            strokeWidth={1.6}
            fill="none"
          />
        </Svg>
        {Array.from({ length: Math.ceil(W / TILE) + 6 }, (_, i) => (
          <Tick key={i} i={i} line={lineOff} cupOff={cupOff} shown={cupShown} />
        ))}
      </Animated.View>

      {/* Back of the cup: paper over the pencil line near the rim, then the hole. */}
      <Animated.View collapsable={false} style={[{ position: 'absolute', left: 0, top: 0 }, slide]}>
        <Svg width={W + 240} height={H}>
          <Ellipse cx={cup.x} cy={cup.y} rx={RX + LINE_GAP} ry={RY + LINE_GAP * 0.6} fill={P.chrome} />
          <Ellipse cx={cup.x} cy={cup.y} rx={RX} ry={RY} fill={P.raised} />
          <Path d={FAR_SHADE} fill={P.graphite} />
          <Path d={NEAR_SHADE} fill={P.line} />
        </Svg>
      </Animated.View>

      <Animated.View collapsable={false} style={[{ position: 'absolute', left: 0, top: 0, width: SHADOW_RX * 2, height: SHADOW_RX * 2, borderRadius: SHADOW_RX, backgroundColor: P.ink }, shadow]} />

      <Animated.View collapsable={false} style={[{ position: 'absolute', left: 0, top: 0, width: D, height: D, borderRadius: BALL_R, backgroundColor: P.raised, borderWidth: 1.6, borderColor: P.ink, overflow: 'hidden' }, ball]}>
        {DIMPLES.map((v, i) => <Dimple key={i} q={q} v={v} />)}
      </Animated.View>

      {/* Front of the cup, over the ball, so a ball below the rim goes behind the near lip. */}
      <Animated.View pointerEvents="none" collapsable={false} style={[{ position: 'absolute', left: 0, top: 0 }, cover]}>
        <Svg width={W + 240} height={H + 40}>
          <Path d={COVER} fill={P.chrome} />
          <Path d={NEAR_SHADE} fill={P.line} />
        </Svg>
      </Animated.View>
    </View>
  )
}
