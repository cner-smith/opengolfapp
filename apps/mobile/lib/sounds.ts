import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'

// The one sound in the app (#611 §15): the ball-in-cup rattle on a made putt.
// Clip: "Minigolf putt, right into the hole!" by pfranzen, Freesound #512505,
// CC0 1.0 — cut to the drop and rattles (the putter strike and roll removed),
// 1.3 s, peak −16 dBFS. The same file is res/raw/oga_cup.m4a in the Android module.
// A device-local preference (Profile → Sounds), on by default. Silent mode
// wins on both platforms: iOS plays in the ambient category (the silent
// switch mutes it), Android plays only when the ringer mode is NORMAL
// (modules/oga-feedback). Neither pauses the player's music.
//
// Both paths are native modules the 1.5.0 store binaries don't have; there
// they no-op, so this still ships by OTA.
const KEY = 'oga.sounds-v1'
const VOLUME = 0.5

export async function getSoundsOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== '0'
  } catch {
    return true
  }
}

export async function setSoundsOn(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* noop */
  }
}

type Player = { volume: number; play: () => void; remove: () => void }
let iosPlayer: Player | null = null
let iosModeSet = false

// A fresh player per putt instead of seekTo(0) on one: expo-audio 1.1.1's
// seekTo can crash natively on iOS (EXC_BAD_ACCESS in its continuation,
// expo/expo#43034), which no try/catch catches. The clip is 12 KB.
function newCupPlayerIos(): Player | null {
  try {
    const A = require('expo-audio') as typeof import('expo-audio')
    if (!iosModeSet) {
      iosModeSet = true
      void A.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
    }
    iosPlayer?.remove()
    const p = A.createAudioPlayer(require('../assets/sounds/cup.m4a'))
    p.volume = VOLUME
    iosPlayer = p
    return p
  } catch {
    return null
  }
}

export async function playCup(): Promise<void> {
  if (!(await getSoundsOn())) return
  try {
    if (Platform.OS === 'android') {
      requireOptionalNativeModule<{ playCup: (v: number) => boolean }>('OgaFeedback')?.playCup(VOLUME)
      return
    }
    newCupPlayerIos()?.play()
  } catch {
    // Never let a sound break the putt flow.
  }
}
