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
      storage: opts.storage,
      autoRefreshToken: opts.autoRefreshToken ?? true,
      persistSession: opts.persistSession ?? true,
      detectSessionInUrl: opts.detectSessionInUrl ?? true,
    },
  })
}
