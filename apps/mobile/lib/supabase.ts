import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createOgaClient } from '@oga/supabase'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env missing: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createOgaClient({
  url,
  anonKey,
  storage: AsyncStorage,
  detectSessionInUrl: false,
})
