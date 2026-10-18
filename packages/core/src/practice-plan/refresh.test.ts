import { describe, expect, it } from 'vitest'
import { shouldPromptPlanRefresh } from './refresh'

describe('shouldPromptPlanRefresh', () => {
  it('prompts after the 2nd round when the plan was a starter (built on 0 rounds)', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 0, roundsNow: 2 })).toBe(true)
  })

  it('prompts after the 3rd round when the plan was built on 2 rounds', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 2, roundsNow: 3 })).toBe(true)
  })

  it('treats a plan with no recorded round count as a starter', () => {
    expect(shouldPromptPlanRefresh({ planRounds: null, roundsNow: 2 })).toBe(true)
  })

  it('does not prompt after only 1 round', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 0, roundsNow: 1 })).toBe(false)
  })

  it('clears once a plan is built on the current rounds', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 2, roundsNow: 2 })).toBe(false)
    expect(shouldPromptPlanRefresh({ planRounds: 3, roundsNow: 3 })).toBe(false)
  })

  it('does not prompt from round 4 on (the normal weekly refresh takes over)', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 0, roundsNow: 4 })).toBe(false)
    expect(shouldPromptPlanRefresh({ planRounds: 3, roundsNow: 5 })).toBe(false)
  })

  it('does not prompt when the plan saw more rounds than exist now (rounds deleted)', () => {
    expect(shouldPromptPlanRefresh({ planRounds: 4, roundsNow: 3 })).toBe(false)
  })
})
