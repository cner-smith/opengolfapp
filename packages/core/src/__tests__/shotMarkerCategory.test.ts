import { describe, it, expect } from 'vitest'
import { getShotMarkerCategory } from '../sg-calculator'

describe('getShotMarkerCategory', () => {
  it('renders any tee-lie shot as a tee marker, even on a par 3', () => {
    expect(getShotMarkerCategory({ lieType: 'tee', distanceToTarget: 160 }, 3, 1)).toBe('tee')
  })

  it('maps a green lie to a putt marker', () => {
    expect(getShotMarkerCategory({ lieType: 'green', distanceToTarget: 5 }, 4, 3)).toBe('putt')
  })

  it('maps a near-green shot (≤ 30 yd) to around-green', () => {
    expect(getShotMarkerCategory({ lieType: 'fringe', distanceToTarget: 20 }, 4, 3)).toBe('around-green')
  })

  it('maps a par-4 first shot off a non-tee lie to a tee marker (off_tee)', () => {
    expect(getShotMarkerCategory({ lieType: 'fairway', distanceToTarget: 400 }, 4, 1)).toBe('tee')
  })

  it('maps a mid-range non-tee shot to an approach marker', () => {
    expect(getShotMarkerCategory({ lieType: 'fairway', distanceToTarget: 150 }, 4, 2)).toBe('approach')
  })
})
