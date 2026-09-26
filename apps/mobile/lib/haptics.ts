import { Platform } from 'react-native'

// Haptics (#611 JUICE-SPEC §1). Fire-and-forget — never awaited, never
// blocking: every haptic is redundant with something on screen.
//
// expo-haptics is a native module the 1.5.0 store binaries don't have, so
// it's required lazily: on those binaries the require throws and every call
// is a no-op (the JS still ships by OTA).
//
// Android uses performAndroidHapticsAsync (the device's tuned primitives and
// the system haptic setting), never impactAsync & co — those are 40–60 ms
// Vibrator buzzes. Newer constants reject on older OS versions, so each
// semantic lists fallbacks and the ones that failed are remembered.
export type Haptic = 'tick' | 'press' | 'toggleOn' | 'toggleOff' | 'grab' | 'confirm' | 'penalty' | 'success'

type HapticsModule = typeof import('expo-haptics')
let mod: HapticsModule | null | undefined
function haptics(): HapticsModule | null {
  if (mod === undefined) {
    try {
      mod = require('expo-haptics') as HapticsModule
    } catch {
      mod = null
    }
  }
  return mod
}

type AndroidKey = keyof HapticsModule['AndroidHaptics']
const ANDROID: Record<Haptic, AndroidKey[]> = {
  tick: ['Segment_Frequent_Tick', 'Clock_Tick'],
  press: ['Virtual_Key'],
  toggleOn: ['Toggle_On', 'Clock_Tick'],
  toggleOff: ['Toggle_Off', 'Clock_Tick'],
  grab: ['Drag_Start', 'Clock_Tick'],
  confirm: ['Confirm', 'Virtual_Key'],
  penalty: ['Reject', 'Long_Press'],
  success: ['Confirm', 'Virtual_Key'],
}
const unsupported = new Set<AndroidKey>()

async function android(H: HapticsModule, keys: AndroidKey[]) {
  for (const k of keys) {
    if (unsupported.has(k)) continue
    try {
      await H.performAndroidHapticsAsync(H.AndroidHaptics[k])
      return
    } catch (e) {
      // Only a constant this OS lacks is skipped for good; any other failure
      // just falls through to the next one this time.
      // expo-haptics: ERR_HAPTIC_TYPE_NOT_SUPPORTED (HapticsRecord.kt).
      if ((e as { code?: string })?.code === 'ERR_HAPTIC_TYPE_NOT_SUPPORTED') unsupported.add(k)
    }
  }
}

function ios(H: HapticsModule, h: Haptic): Promise<void> {
  switch (h) {
    case 'tick':
    case 'toggleOff':
      return H.selectionAsync()
    case 'press':
    case 'toggleOn':
      return H.impactAsync(H.ImpactFeedbackStyle.Light)
    case 'grab':
      return H.impactAsync(H.ImpactFeedbackStyle.Soft)
    case 'confirm':
      return H.impactAsync(H.ImpactFeedbackStyle.Medium)
    case 'penalty':
      return H.notificationAsync(H.NotificationFeedbackType.Warning)
    case 'success':
      return H.notificationAsync(H.NotificationFeedbackType.Success)
  }
}

// Rate limits: ticks at most 1 per 35 ms; everything else 1 per 150 ms, except
// a moment's own haptic (confirm / success / penalty / toggle) always lands —
// it replaces the press-in haptic a tap fires just before it.
const STRONG = new Set<Haptic>(['confirm', 'success', 'penalty', 'toggleOn', 'toggleOff'])
let lastTick = 0
let lastOther = 0

export function haptic(h: Haptic): void {
  const now = Date.now()
  if (h === 'tick') {
    if (now - lastTick < 35) return
    lastTick = now
  } else {
    if (now - lastOther < 150 && !STRONG.has(h)) return
    lastOther = now
  }
  const H = haptics()
  if (!H) return
  const p = Platform.OS === 'android' ? android(H, ANDROID[h]) : ios(H, h)
  p.catch(() => {})
}
