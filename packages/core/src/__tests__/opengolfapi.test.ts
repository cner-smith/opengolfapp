import { afterEach, expect, it, vi } from 'vitest'
import { searchOpenGolfApi } from '../opengolfapi'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('gives up with no results when the directory never answers', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  const search = searchOpenGolfApi('westwood')
  await vi.advanceTimersByTimeAsync(3000)
  await expect(search).resolves.toEqual([])
})
