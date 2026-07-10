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
// Coarse full-clear on purpose; add per-key invalidation only if the
// full clear demonstrably thrashes.
//
// Deliberately app-local rather than @oga/core: the safety of serving
// cached data hinges on every consumer being a mobile stack screen that
// re-fetches on mount/focus (the always-revalidate above). Web's screens
// don't share that lifecycle contract, so lifting the Map alone would
// export the mechanism without the invariant that makes it safe.
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
