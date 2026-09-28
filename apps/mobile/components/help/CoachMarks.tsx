import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { BackHandler, Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAuth } from '../../hooks/useAuth'
import { markSeenFlags, seenFlags } from '../../lib/seenFlags'
import { TYPE } from '../../lib/typography'
import { HardShadow, Key, KeyText } from '../paper/Paper'
import { FONT_CAP, P, R } from '../paper/tokens'

// Coach marks (#900): a step-through spotlight over the round screens. Each
// control wraps itself in <CoachTarget id>, a screen lists the steps for its
// current state, and <CoachOverlay> dims everything but one target at a time
// with a paper note beside it. The same overlay is the first-time tutorial
// (unseen steps only, opened on its own) and the header "?" (every step).

export interface CoachStep {
  id: string
  title: string
  body: string
}
type Rect = { x: number; y: number; w: number; h: number }
type Measure = () => Promise<Rect | null>

const Ctx = createContext<Map<string, Measure> | null>(null)

export function CoachProvider({ children }: { children: ReactNode }) {
  const registry = useRef(new Map<string, Measure>()).current
  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>
}

/** Wraps a control so the overlay can find it on screen. */
export function CoachTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const registry = useContext(Ctx)
  const ref = useRef<View>(null)
  useEffect(() => {
    if (!registry) return
    const measure: Measure = () =>
      new Promise((resolve) => {
        const v = ref.current
        if (!v) return resolve(null)
        v.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null))
      })
    registry.set(id, measure)
    return () => {
      if (registry.get(id) === measure) registry.delete(id)
    }
  }, [registry, id])
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  )
}

const SEEN_KEY = (id: string) => `oga.coach-v1.${id}`

/** Steps of `steps` this account hasn't been shown yet (see lib/seenFlags). */
export async function unseenSteps(userId: string, steps: CoachStep[]): Promise<CoachStep[]> {
  const seen = await seenFlags(userId, steps.map((s) => SEEN_KEY(s.id)))
  return steps.filter((_, i) => !seen[i])
}

const PAD = 6
const NOTE_W = 300

/**
 * Full-screen spotlight. Mount it last inside the screen's root (absolute,
 * over everything). Steps whose target isn't on screen are skipped.
 */
export function CoachOverlay({ steps, onClose }: { steps: CoachStep[] | null; onClose: () => void }) {
  const registry = useContext(Ctx)
  const { user } = useAuth()
  const { width: W, height: H } = useWindowDimensions()
  const rootRef = useRef<View>(null)
  const [shown, setShown] = useState<{ step: CoachStep; rect: Rect }[] | null>(null)
  const [i, setI] = useState(0)

  // Measure every target once per open (the dock and wheel move between
  // states), relative to this overlay's own window origin.
  useEffect(() => {
    if (!steps || !registry) return setShown(null)
    let live = true
    void (async () => {
      const origin = await new Promise<{ x: number; y: number }>((res) =>
        rootRef.current ? rootRef.current.measureInWindow((x, y) => res({ x, y })) : res({ x: 0, y: 0 }),
      )
      const out: { step: CoachStep; rect: Rect }[] = []
      for (const step of steps) {
        const r = await registry.get(step.id)?.()
        if (r) out.push({ step, rect: { ...r, x: r.x - origin.x, y: r.y - origin.y } })
      }
      if (!live) return
      if (!out.length) return onClose()
      setI(0)
      setShown(out)
    })()
    return () => {
      live = false
    }
  }, [steps, registry])

  const close = useCallback(() => {
    if (shown && user) void markSeenFlags(user.id, shown.map((s) => SEEN_KEY(s.step.id)))
    setShown(null)
    onClose()
  }, [shown, onClose, user])

  // Android Back closes the tips (newest listener runs first, so the
  // screen's own "Leave round?" handler doesn't see it).
  useEffect(() => {
    if (!steps) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => sub.remove()
  }, [steps, close])

  if (!steps) return null
  const cur = shown?.[i]
  const next = () => (shown && i < shown.length - 1 ? setI(i + 1) : close())
  // The root renders as soon as it's open so it can be measured; the scrim
  // waits for the first measurement.
  return (
    <View ref={rootRef} collapsable={false} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {cur && shown && (
        <>
          <Pressable accessibilityLabel="Next tip" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={next}>
            <Svg width={W} height={H}>
              <Path
                fillRule="evenodd"
                fill="rgba(28,33,28,0.62)"
                d={`M0 0H${W}V${H}H0Z M${cur.rect.x - PAD} ${cur.rect.y - PAD}h${cur.rect.w + 2 * PAD}v${cur.rect.h + 2 * PAD}h${-(cur.rect.w + 2 * PAD)}Z`}
              />
            </Svg>
          </Pressable>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: cur.rect.x - PAD,
              top: cur.rect.y - PAD,
              width: cur.rect.w + 2 * PAD,
              height: cur.rect.h + 2 * PAD,
              borderWidth: 2,
              borderColor: P.raised,
              borderRadius: R,
            }}
          />
          <Note
            step={cur.step}
            rect={cur.rect}
            W={W}
            H={H}
            index={i}
            count={shown.length}
            onBack={() => setI(i - 1)}
            onNext={next}
            onSkip={close}
          />
        </>
      )}
    </View>
  )
}

function Note(p: {
  step: CoachStep
  rect: Rect
  W: number
  H: number
  index: number
  count: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const [h, setH] = useState(0)
  const w = Math.min(NOTE_W, p.W - 32)
  const left = Math.max(16, Math.min(p.W - 16 - w, p.rect.x + p.rect.w / 2 - w / 2))
  // Below the target when it sits in the top half, above it otherwise.
  const below = p.rect.y + p.rect.h / 2 < p.H / 2
  const top = below ? p.rect.y + p.rect.h + PAD + 14 : p.rect.y - PAD - 14 - h
  const last = p.index === p.count - 1
  return (
    <HardShadow dx={3} dy={3} style={{ position: 'absolute', left, top, width: w, opacity: h ? 1 : 0 }}>
      <View
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={{ backgroundColor: P.raised, borderWidth: 1, borderColor: P.ink, borderRadius: R, padding: 14 }}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 19, lineHeight: 24, color: P.ink }]}>
          {p.step.title}
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 14, lineHeight: 20, color: P.ink, marginTop: 4 }]}>
          {p.step.body}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 12, color: P.inkDim, flex: 1 }]}>
            {p.index + 1} of {p.count}
          </Text>
          {!last && (
            <Pressable accessibilityRole="button" accessibilityLabel="Skip tips" onPress={p.onSkip} hitSlop={8}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.inkDim, marginRight: 4 }]}>
                Skip
              </Text>
            </Pressable>
          )}
          {p.index > 0 && (
            <Key accessibilityLabel="Previous tip" onPress={p.onBack} faceStyle={{ minHeight: 36, paddingHorizontal: 12 }}>
              <KeyText size={13}>Back</KeyText>
            </Key>
          )}
          <Key accessibilityLabel={last ? 'Done' : 'Next tip'} tone="primary" onPress={p.onNext} faceStyle={{ minHeight: 36, paddingHorizontal: 14 }}>
            <KeyText tone="primary" bold size={13}>
              {last ? 'Done' : 'Next'}
            </KeyText>
          </Key>
        </View>
      </View>
    </HardShadow>
  )
}

/**
 * Tutorial + help for one screen. `steps` is what the screen shows right now
 * (null while something else is up — a sheet, a dialog). Each time it changes,
 * any steps the player hasn't seen open on their own after a beat; `openHelp`
 * shows all of them.
 */
export function useCoach(steps: CoachStep[] | null) {
  const [open, setOpen] = useState<CoachStep[] | null>(null)
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!steps || !userId) return
    let live = true
    const t = setTimeout(() => {
      void unseenSteps(userId, steps).then((u) => live && u.length && setOpen((cur) => cur ?? u))
    }, 700)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [steps, userId])
  return {
    steps: open,
    openHelp: () => steps && setOpen(steps),
    close: () => setOpen(null),
  }
}
