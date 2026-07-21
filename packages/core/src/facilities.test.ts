import { describe, expect, it, vi } from 'vitest'
import { resolveFacilityResults } from './facilities'

interface Course {
  id: string
  facility_id?: string | null
}
interface Facility {
  id: string
  name: string
}

describe('resolveFacilityResults', () => {
  it('returns all rows as standalone and never calls the fetcher when no unit has a facility_id', async () => {
    const localRows: Course[] = [{ id: 'c1' }, { id: 'c2', facility_id: null }]
    const fetcher = vi.fn(async () => [] as Facility[])

    const { standalone, facilities } = await resolveFacilityResults(
      localRows,
      [],
      fetcher,
    )

    expect(standalone).toEqual(localRows)
    expect(facilities).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetches + merges a unit whose facility is not in facilitiesByName', async () => {
    const localRows: Course[] = [{ id: 'c1', facility_id: 'f1' }]
    const f1: Facility = { id: 'f1', name: 'Lake Hefner Golf Club' }
    const fetcher = vi.fn(async (ids: string[]) => {
      expect(ids).toEqual(['f1'])
      return [f1]
    })

    const { standalone, facilities } = await resolveFacilityResults(
      localRows,
      [],
      fetcher,
    )

    expect(standalone).toEqual([])
    expect(facilities).toEqual([f1])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('dedupes a facility that appears in both facilitiesByName and the fetched-by-unit set', async () => {
    const localRows: Course[] = [{ id: 'c1', facility_id: 'f1' }]
    const f1: Facility = { id: 'f1', name: 'Lake Hefner Golf Club' }
    const fetcher = vi.fn(async () => [f1])

    const { facilities } = await resolveFacilityResults(localRows, [f1], fetcher)

    expect(facilities).toEqual([f1])
  })

  it('returns empty standalone + facilities for empty input', async () => {
    const fetcher = vi.fn(async () => [] as Facility[])

    const { standalone, facilities } = await resolveFacilityResults(
      [],
      [],
      fetcher,
    )

    expect(standalone).toEqual([])
    expect(facilities).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })
})
