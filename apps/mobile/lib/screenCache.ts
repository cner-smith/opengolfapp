// In-memory stale-while-revalidate store for screen data (#599). Screens
// seed their state from here to render instantly on revisit; every consumer
// is a stack screen whose fetch effect re-runs on mount (or focus), so the
// network refetch always races behind and replaces the cached render —
// staleness is bounded by one fetch latency. No TTL, no persistence: the
// store lives for the JS session only.
//
// clearScreenCache() is the only invalidation: called on round delete,
// round finalize, and sign-out — the mutations where even a one-fetch
// stale flash is wrong (ghost deleted round, cross-account leak).
// ponytail: coarse full-clear; per-key invalidation only if this thrashes.
const store = new Map<string, unknown>()

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined
}

export function setCached(key: string, value: unknown): void {
  store.set(key, value)
}

export function clearScreenCache(): void {
  store.clear()
}
