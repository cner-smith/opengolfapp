import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

// Haptics (#611 JUICE-SPEC §1). Fire-and-forget — never awaited, never
// blocking: every haptic is redundant with something on screen.
//
// expo-haptics is a native module the 1.5.0 store binaries don't have. Its JS
// loads it with requireOptionalNativeModule (src/ExpoHaptics.ts), so the
// require itself succeeds there; every call then rejects (UnavailabilityError
// or a TypeError on the null module), caught below — a no-op, so the JS still
// ships by OTA.
//
// Android uses the performHapticsAsync primitives (the device's tuned
// View.performHapticFeedback and the system haptic setting), never impactAsync
// & co — those are 40–60 ms Vibrator buzzes. Newer constants reject on older OS
// versions, so each semantic lists fallbacks and the ones that failed are
// remembered.
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

// expo-haptics 15.0.8's performAndroidHapticsAsync calls the native
// performHapticsAsync WITHOUT awaiting or returning it (src/Haptics.ts:59-64),
// so its rejection never reaches a caller (and is logged as unhandled). The
// native function is called directly to get that promise.
// HapticType.toHapticFeedbackType (android/.../HapticsRecord.kt) rejects when
// the HapticFeedbackConstants field is missing on this OS version or not
// accessible — fixed for the device, so that constant is skipped for good.
// Both of its exceptions extend the legacy expo.modules.core.errors.
// CodedException and arrive with its default code (below); any other native
// throw becomes UnexpectedException → ERR_UNEXPECTED (expo-modules-core
// kotlin/exception/CodedException.kt toCodedException), which only falls
// through to the next constant this time.
const NOT_SUPPORTED = 'ERR_UNSPECIFIED_ANDROID_EXCEPTION'
type NativeHaptics = { performHapticsAsync: (type: string) => Promise<void> }

async function android(H: HapticsModule, keys: AndroidKey[]) {
  const N = requireOptionalNativeModule<NativeHaptics>('ExpoHaptics')
  if (!N) return
  for (const k of keys) {
    if (unsupported.has(k)) continue
    try {
      await N.performHapticsAsync(H.AndroidHaptics[k])
      return
    } catch (e) {
      if ((e as { code?: string })?.code === NOT_SUPPORTED) unsupported.add(k)
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
