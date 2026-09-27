import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo'

// The one sound in the app (#611 §15): the ball-in-cup rattle on a made putt.
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

type Player = { volume: number; seekTo: (s: number) => Promise<void>; play: () => void }
let iosPlayer: Player | null | undefined

function cupPlayerIos(): Player | null {
  if (iosPlayer === undefined) {
    try {
      const A = require('expo-audio') as typeof import('expo-audio')
      void A.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
      const p = A.createAudioPlayer(require('../assets/sounds/cup.m4a'))
      p.volume = VOLUME
      iosPlayer = p
    } catch {
      iosPlayer = null
    }
  }
  return iosPlayer
}

export async function playCup(): Promise<void> {
  if (!(await getSoundsOn())) return
  try {
    if (Platform.OS === 'android') {
      requireOptionalNativeModule<{ playCup: (v: number) => boolean }>('OgaFeedback')?.playCup(VOLUME)
      return
    }
    const p = cupPlayerIos()
    if (!p) return
    await p.seekTo(0)
    p.play()
  } catch {
    // Never let a sound break the putt flow.
  }
}
