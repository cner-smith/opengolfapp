import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export type OgaSupabaseClient = SupabaseClient<Database>

export interface CreateClientOptions {
  url: string
  anonKey: string
  storage?: {
    getItem: (key: string) => Promise<string | null> | string | null
    setItem: (key: string, value: string) => Promise<void> | void
    removeItem: (key: string) => Promise<void> | void
  }
  autoRefreshToken?: boolean
  persistSession?: boolean
  detectSessionInUrl?: boolean
}

export function createOgaClient(opts: CreateClientOptions): OgaSupabaseClient {
  if (!opts.url) throw new Error('Missing Supabase URL')
  if (!opts.anonKey) throw new Error('Missing Supabase anon key')
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: {
      // Only forward storage when the caller actually provided one. Passing
      // storage: undefined explicitly disables supabase-js's browser fallback
      // to window.localStorage, leaving the session in memory only — sign-in
      // appears to work but every reload (or remount) loses the user.
      ...(opts.storage ? { storage: opts.storage } : {}),
      autoRefreshToken: opts.autoRefreshToken ?? true,
      persistSession: opts.persistSession ?? true,
      detectSessionInUrl: opts.detectSessionInUrl ?? true,
    },
  })
}
