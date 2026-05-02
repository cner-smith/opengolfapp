import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createOgaClient } from '@oga/supabase'

// Supabase session (access + refresh JWTs) is stored in expo-secure-store,
// which wraps Android Keystore / iOS Keychain. Refresh tokens are long-lived;
// AsyncStorage was plaintext on disk, replayable from rooted devices, ADB
// backups, and sibling apps with FS access.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
