import AsyncStorage from '@react-native-async-storage/async-storage'

// Aim-view camera tilt (#899), a device-local display preference: a flat
// yardage-book page (0°, default) or a flyover from behind the ball (60°).
// It doesn't touch stats, so no profile column.
export type AimTilt = 0 | 60

const KEY = 'oga.aim-tilt-v1'

export async function getAimTilt(): Promise<AimTilt> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '60' ? 60 : 0
  } catch {
    return 0
  }
}

export async function setAimTilt(tilt: AimTilt): Promise<void> {
  try { await AsyncStorage.setItem(KEY, String(tilt)) } catch { /* noop */ }
}
