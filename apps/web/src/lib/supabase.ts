import { createOgaClient } from '@oga/supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createOgaClient({
  url: url ?? '',
  anonKey: anonKey ?? '',
})
