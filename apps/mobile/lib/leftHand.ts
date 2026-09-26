import AsyncStorage from '@react-native-async-storage/async-storage'

// Left-handed layout (#611 §12), a device-local display preference like
// lib/aimTilt: mirrors the live-round stacks, bottom row and map tags.
const KEY = 'oga.left-hand-v1'

export async function getLeftHand(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1'
  } catch {
    return false
  }
}

export async function setLeftHand(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(KEY, on ? '1' : '0') } catch { /* noop */ }
}
