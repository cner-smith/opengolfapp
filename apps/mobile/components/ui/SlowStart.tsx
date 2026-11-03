import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import NetInfo from '@react-native-community/netinfo'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { FONT_CAP, P } from '../paper/tokens'
import { TYPE } from '../../lib/typography'

// Only the slow path shows this: a normal start is done before SHOW_AFTER_MS.
// The roll always gets ROLL_MIN_MS, so "no signal" (known at once in airplane
// mode) still reads as hope, then bad news. NetInfo only picks the ball's
// ending here; auth-js alone decides the session.
const SHOW_AFTER_MS = 1000
const ROLL_MIN_MS = 2600


const SAD_LINE = "Oh no. We're so sorry."
const SAD_BODY =
  "There's no signal here, so checking your login is slow. Your round is safe on this phone and it's on its way. This can take up to a minute."

export function SlowStart({ authDone, onHold }: { authDone: boolean; onHold: (hold: boolean) => void }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [noSignal, setNoSignal] = useState(false)
  const [atRest, setAtRest] = useState(false)
  const rest = useCallback(() => setAtRest(true), [])
  const opacity = useSharedValue(0)
  const announced = useRef(false)

  useEffect(() => {
    const show = setTimeout(() => {
      setShown(true)
      onHold(true)
      opacity.value = reduced ? 1 : withTiming(1, { duration: 260 })
    }, SHOW_AFTER_MS)
    const roll = setTimeout(() => setRolled(true), SHOW_AFTER_MS + ROLL_MIN_MS)
    const unsubscribe = NetInfo.addEventListener((s) => {
      setNoSignal(s.isConnected === false || s.isInternetReachable === false)
    })
    return () => {
      clearTimeout(show)
      clearTimeout(roll)
      unsubscribe()
    }
  }, [opacity, onHold, reduced])

  const out = rolled && noSignal
  const sad = atRest && !authDone
  useEffect(() => {
    if (!sad || announced.current) return
    announced.current = true
    AccessibilityInfo.announceForAccessibility(`${SAD_LINE} ${SAD_BODY}`)
  }, [sad])
  // Answered inside the roll minimum: nobody waits on the show. After that the
  // ball gets its run to the cup, in or out, first.
  useEffect(() => {
    if (authDone && (!rolled || atRest)) onHold(false)
  }, [authDone, rolled, atRest, shown, onHold])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  if (!shown) return null
  // Required here: its paths are computed on load, and a normal start never gets this far.
  const { SlowStartArt } = require('./SlowStartArt') as typeof import('./SlowStartArt')

  return (
    <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, styles.page, style]}>
      <StatusBar style="dark" animated />
      <SlowStartArt noSignal={out} connected={rolled && authDone} reduced={reduced} onRest={rest} />
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, styles.line]}>
          {sad ? SAD_LINE : 'Checking your login.'}
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, styles.body]}>
          {sad ? SAD_BODY : 'Then we go find your round.'}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  page: { backgroundColor: P.chrome, alignItems: 'center', justifyContent: 'center', padding: 28 },
  copy: { marginTop: 22, minHeight: 150, alignItems: 'center' },
  line: { color: P.ink, fontSize: 28, textAlign: 'center' },
  body: { color: P.inkDim, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 310 },
})
