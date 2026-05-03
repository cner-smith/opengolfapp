import { useCallback, useEffect, useState } from 'react'
import {
  deleteUserClub,
  getAllUserClubs,
  getUserBag,
  seedDefaultBag,
  updateClubOrder,
  upsertUserClub,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { DEFAULT_BAG } from '@oga/core'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type UserClub = Database['public']['Tables']['user_clubs']['Row']
type UserClubInsert = Database['public']['Tables']['user_clubs']['Insert']

// Module-level cache. Bag changes rarely; refetching on every shot is
// wasteful. TTL is 5 minutes — long enough that a typical round won't
// trigger a refetch, short enough that an edit on /bag shows up before
// the next round.
const TTL_MS = 5 * 60 * 1000
type CacheEntry = { fetchedAt: number; clubs: UserClub[] } | undefined
const cache = new Map<string, CacheEntry>()
type Subscriber = () => void
const subscribers = new Map<string, Set<Subscriber>>()

function emit(userId: string) {
  subscribers.get(userId)?.forEach((fn) => fn())
}

function setCache(userId: string, clubs: UserClub[]) {
  cache.set(userId, { fetchedAt: Date.now(), clubs })
  emit(userId)
}

function readCache(userId: string): UserClub[] | null {
  const entry = cache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) return null
  return entry.clubs
}

async function fetchAndCache(userId: string, includeBenched: boolean) {
  const { data, error } = includeBenched
    ? await getAllUserClubs(supabase, userId)
    : await getUserBag(supabase, userId)
  if (error) throw error
  const rows = (data ?? []) as UserClub[]
  setCache(userId, rows)
  return rows
}

interface UseBagOpts {
  includeBenched?: boolean
  /** Auto-seed the default bag if the fetched bag is empty. Only the
   *  shot-logger consumers should pass false — the bag-management
   *  screen also passes true so a brand-new user lands on a populated
   *  list. */
  seedIfEmpty?: boolean
}

interface UseBagResult {
  bag: UserClub[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useUserBag(opts: UseBagOpts = {}): UseBagResult {
  const { user } = useAuth()
  const userId = user?.id
  const [bag, setBag] = useState<UserClub[]>(() =>
    userId ? readCache(userId) ?? [] : [],
  )
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!userId) return false
    return readCache(userId) === null
  })
  const [error, setError] = useState<Error | null>(null)

  const includeBenched = !!opts.includeBenched
  const seedIfEmpty = !!opts.seedIfEmpty

  // Subscribe to cache changes for this user so all hook instances see
  // the same data after a mutation.
  useEffect(() => {
    if (!userId) return
    if (!subscribers.has(userId)) subscribers.set(userId, new Set())
    const subs = subscribers.get(userId)!
    const onChange = () => {
      const cached = readCache(userId) ?? []
      setBag(includeBenched ? cached : cached.filter((c) => c.in_bag))
    }
    subs.add(onChange)
    return () => {
      subs.delete(onChange)
    }
  }, [userId, includeBenched])

  const refetch = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    try {
      let rows = await fetchAndCache(userId, /* includeBenched= */ true)
      if (seedIfEmpty && rows.length === 0) {
        rows = await seedDefaultBag(supabase, userId, DEFAULT_BAG)
        setCache(userId, rows)
      }
      setBag(includeBenched ? rows : rows.filter((c) => c.in_bag))
    } catch (e) {
      setError(e as Error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, includeBenched, seedIfEmpty])

  // Initial load — only fetch if the cache is cold or stale.
  useEffect(() => {
    if (!userId) {
      setBag([])
      setIsLoading(false)
      return
    }
    const cached = readCache(userId)
    if (cached) {
      setBag(includeBenched ? cached : cached.filter((c) => c.in_bag))
      setIsLoading(false)
      // If we'd auto-seed and the cache has rows, no need to refetch.
      if (!seedIfEmpty || cached.length > 0) return
    }
    refetch()
  }, [userId, includeBenched, seedIfEmpty, refetch])

  return { bag, isLoading, error, refetch }
}

export async function upsertClub(
  userId: string,
  patch: Omit<UserClubInsert, 'user_id'>,
): Promise<void> {
  const { error } = await upsertUserClub(supabase, { ...patch, user_id: userId })
  if (error) throw error
  // Refetch full list so cache reflects insert/update + any reordering.
  await fetchAndCache(userId, /* includeBenched= */ true)
}

export async function deleteClub(userId: string, clubId: string): Promise<void> {
  const { error } = await deleteUserClub(supabase, clubId, userId)
  if (error) throw error
  await fetchAndCache(userId, true)
}

export async function reorderClubs(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  await updateClubOrder(supabase, userId, orderedIds)
  await fetchAndCache(userId, true)
}

export async function resetBag(userId: string): Promise<UserClub[]> {
  const { error } = await supabase
    .from('user_clubs')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
  const rows = await seedDefaultBag(supabase, userId, DEFAULT_BAG)
  setCache(userId, rows)
  return rows
}

