import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import type { Session, User } from '@supabase/supabase-js'
import { createOgaClient } from '@oga/supabase'
import { logDiag } from './db'

// expo-secure-store persists AES-GCM-encrypted blobs in
// SharedPreferences on Android and Keychain on iOS. Neither has a
// hard per-value size limit on modern devices — the legacy 2048-byte
// Android Keystore constraint applies only to a pre-API-23 RSA-wrapped
// path (HybridAESEncryptor) that is dead code in expo-secure-store on
// SDK >= 23 (it throws IllegalStateException on init).
//
// The adapter still chunks long values across `${key}_0`, `${key}_1`,
// … keys with a sentinel `${key}_chunks` recording the count, and
// reassembles on read. The chunking is kept as belt-and-suspenders
// defense against any unforeseen backend constraint and to keep
// individual writes small; values under CHUNK_SIZE write directly to
// the raw key for back-compat with sessions stored before chunking
// was added.
//
// Write order: chunks first, sentinel last. The sentinel write is the
// commit point — a process kill before that leaves the next read with
// no sentinel, which falls through to the (cleared) raw-key path and
// returns null cleanly. Supabase treats null as logged-out; user signs
// in again. The previous "sentinel-first" order could leave a partial
// chunk set behind a valid sentinel, which would reassemble into a
// corrupt JWT and confuse Supabase auth (issue #345).
const CHUNK_SIZE = 1800

// Wipe any prior chunked layout (sentinel + all chunks) for the given
// key. Used before any new write to avoid mixed-version reads and to
// clean up orphans from a previous-larger write.
async function clearChunkedKeys(key: string): Promise<void> {
  const prevCountRaw = await SecureStore.getItemAsync(`${key}_chunks`)
  if (!prevCountRaw) return
  const prev = parseInt(prevCountRaw, 10)
  if (Number.isFinite(prev) && prev > 0) {
    for (let i = 0; i < prev; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => undefined)
    }
  }
  await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => undefined)
}

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
      // Clear the back-compat unchunked slot so it can't shadow the
      // new chunked write on subsequent reads.
      await SecureStore.deleteItemAsync(key).catch(() => undefined)
      // Wipe any prior chunked layout BEFORE writing the new chunks.
      // A concurrent reader between this clear and the new commit
      // sees no sentinel and falls through to the cleared raw-key
      // path — clean null read rather than a mix of old and new
      // chunk data. Also handles the previous-larger-write case
      // (orphan chunks from a shrink).
      await clearChunkedKeys(key)
      // Chunks first.
      for (const [i, chunk] of chunks.entries()) {
        await SecureStore.setItemAsync(`${key}_${i}`, chunk)
      }
      // Sentinel last — the commit point. See module-level comment.
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length))
    } else {
      // Unchunked path. Wipe any prior chunked layout, then write to
      // the raw key.
      await clearChunkedKeys(key)
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

// Every request gives up after 15 s (#1112): on a stalled network a fetch
// otherwise never settles, and the action awaiting it spins forever. Edge
// Functions get 90 s: generate-practice-plan legitimately runs past 30 s. The error
// is named AbortError so postgrest-js doesn't retry it (it retries other fetch
// failures on reads), and its message marks it for isNetworkTimeout.
const REQUEST_TIMEOUT_MS = 15_000
const FUNCTION_TIMEOUT_MS = 90_000
const NETWORK_TIMEOUT = 'No answer from the server'

async function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const outer = init?.signal
  const abort = () => controller.abort()
  if (outer?.aborted) abort()
  else outer?.addEventListener('abort', abort)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, url.includes('/functions/v1/') ? FUNCTION_TIMEOUT_MS : REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (e) {
    if (!timedOut) throw e
    logDiag('net_timeout', { path: url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] })
    throw timeoutError()
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', abort)
  }
}

/** The timeout as an error, also for an action that stops on a timed-out sync. */
export function timeoutError(): Error {
  const err = new Error(`${NETWORK_TIMEOUT} in 15 s. Check your signal and try again.`)
  err.name = 'AbortError'
  return err
}

/** True for a request that hit the 15 s timeout: a thrown error or a
 *  supabase-js `{ error }`, whose message carries ours. */
export function isNetworkTimeout(e: unknown): boolean {
  return typeof (e as { message?: unknown } | null)?.message === 'string' &&
    (e as { message: string }).message.includes(NETWORK_TIMEOUT)
}

/** What an Alert shows for a failed action: the timeout's own advice, without
 *  supabase-js's "AbortError:" prefix. */
export function userMessage(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? String(e)
  return isNetworkTimeout(e) ? msg.slice(msg.indexOf(NETWORK_TIMEOUT)) : msg
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
  // PKCE: the email-confirm redirect carries ?code= in the QUERY string,
  // which survives the mail-app → browser → oga:// handoff that strips
  // URL fragments on some iOS chains (#509 field reports — users stuck on
  // "Confirming your account…" because the implicit-flow tokens never
  // arrived in the fragment). auth-callback exchanges the code locally;
  // the code_verifier lives in this SecureStore adapter, so the exchange
  // only works on the device that signed up — which is also the Android
  // scheme-hijack hardening #509 tracked.
  flowType: 'pkce',
  fetch: timeoutFetch,
})

/** The user of the session auth-js has persisted, read without refreshing it
 *  (#1005). Offline with an expired access token, getSession() returns null
 *  because its refresh fails with a retryable network error, yet auth-js
 *  leaves the session in storage (it only calls _removeSession on a
 *  non-retryable error). The key mirrors supabase-js's default,
 *  `sb-${hostname.split('.')[0]}-auth-token`; with no userStorage configured
 *  the stored session carries its user. */
export async function readPersistedUser(): Promise<User | null> {
  try {
    const raw = await SecureStoreAdapter.getItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`)
    const stored = raw ? (JSON.parse(raw) as Partial<Session> | null) : null
    return stored?.refresh_token && typeof stored.user?.id === 'string' ? stored.user : null
  } catch {
    return null
  }
}
