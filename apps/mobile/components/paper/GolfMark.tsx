import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated, { useReducedMotion, useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { marksDuration, marksFor, marksPath } from './pencil'

const GRAPHITE = '#353430'
// The harness draws marks at 0.86 around a 15 sp digit; the box holds a
// double-bogey outer square with its overshoot.
const SCALE = 0.86
const BOX = 52
// The score digit prints first (90 ms); the mark starts 240 ms after that.
const MARK_DELAY_MS = 330

// Scorecard golf marks around a score (#611 §10, §15): birdie circle,
// eagle-or-better two circles, bogey square, double-bogey-or-worse two
// squares — pencil-drawn, seeded by hole number so each is its own and stays
// the same across renders. Nothing at par. `animate` draws it by hand once
// (the hole just scored); otherwise it shows the finished mark. Centred on
// its parent, nudged up since Fraunces figures sit high in their line box.
export function GolfMark({ toPar, seed, animate = false }: { toPar: number; seed: number; animate?: boolean }) {
  const marks = useMemo(() => marksFor(toPar, seed), [toPar, seed])
  const final = useMemo(() => marksPath(marks, 1e9), [marks])
  const reduce = useReducedMotion()
  const [t, setT] = useState(animate && !reduce ? 0 : 1e9)
  const fade = useSharedValue(animate && reduce ? 0 : 1)
  useEffect(() => {
    if (!animate) return
    if (reduce) {
      fade.value = withTiming(1, { duration: 120 })
      return
    }
    const dur = marksDuration(marks)
    let raf = 0
    let t0 = 0
    const step = (now: number) => {
      if (!t0) t0 = now
      const lt = now - t0 - MARK_DELAY_MS
      setT(lt)
      if (lt < dur) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [animate, reduce, marks, fade])
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  if (!marks.length) return null
  const d = t >= 1e9 ? final : marksPath(marks, t)
  const half = BOX / 2
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: '50%', top: '50%', marginLeft: -half, marginTop: -half - 7 }, fadeStyle]}
    >
      <View style={{ width: BOX, height: BOX }}>
        <Svg width={BOX} height={BOX} viewBox={`${-half / SCALE} ${-half / SCALE} ${BOX / SCALE} ${BOX / SCALE}`}>
          {d ? <Path d={d} fill={GRAPHITE} opacity={0.9} /> : null}
        </Svg>
      </View>
    </Animated.View>
  )
}
