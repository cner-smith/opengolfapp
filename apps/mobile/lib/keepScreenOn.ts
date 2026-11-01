import AsyncStorage from '@react-native-async-storage/async-storage'

// "Keep screen on" (#1121), a device-local preference like lib/sounds: the live
// round holds the screen awake and blacks it out when idle. On by default.
const KEY = 'oga.keep-screen-on-v1'

export async function getKeepScreenOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== '0'
  } catch {
    return true
  }
}

export async function setKeepScreenOn(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* noop */
  }
}
