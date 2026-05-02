import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createOgaClient } from '@oga/supabase'

// expo-secure-store is backed by Android Keystore / iOS Keychain. Both
// have a per-key payload limit (Android: 2048 bytes; iOS keychain is
// looser). Supabase session JSON typically exceeds 2 KB once the access
// token + refresh token + user metadata are all in there, which triggers
// a "value larger than 2048 bytes" warning on Android and on some
// devices fails outright.
//
// The adapter chunks long values across `${key}_0`, `${key}_1`, …
// keys with a sentinel `${key}_chunks` recording the count, and
// reassembles on read. Values under the chunk size still write to the
// raw key for back-compat with sessions stored before this fix.
const CHUNK_SIZE = 1800

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`)
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10)
      if (!Number.isFinite(chunkCount) || chunkCount <= 0) return null
      const chunks: string[] = []
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`)
        if (chunk == null) return null
        chunks.push(chunk)
      }
      return chunks.join('')
    }
    return SecureStore.getItemAsync(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length > CHUNK_SIZE) {
      const chunks: string[] = []
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE))
      }
      // Clear any previous unchunked write at this key so getItem
      // doesn't see stale data from the back-compat fast-path branch.
      await SecureStore.deleteItemAsync(key).catch(() => undefined)
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length))
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_${i}`, chunks[i] ?? '')
      }
    } else {
      // Clear any chunks from a previous larger write so the next read
      // doesn't reassemble stale fragments.
      const prevCountRaw = await SecureStore.getItemAsync(`${key}_chunks`)
      if (prevCountRaw) {
        const prev = parseInt(prevCountRaw, 10)
        if (Number.isFinite(prev)) {
          for (let i = 0; i < prev; i++) {
            await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => undefined)
          }
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => undefined)
      }
      await SecureStore.setItemAsync(key, value)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`)
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10)
      if (Number.isFinite(chunkCount)) {
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => undefined)
        }
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => undefined)
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined)
  },
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env missing: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createOgaClient({
  url,
  anonKey,
  storage: SecureStoreAdapter,
  detectSessionInUrl: false,
})
