import { describe, expect, it } from 'vitest'
import { generateMaySendToAi, isAiWrittenPlan, shouldPromptPlanRefresh } from './refresh'

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

describe('generateMaySendToAi', () => {
  it('says so from the 5th round with strokes gained', () => {
    expect(generateMaySendToAi(5)).toBe(true)
    expect(generateMaySendToAi(12)).toBe(true)
  })

  it('stays quiet below 5 rounds, where the plan is built without AI', () => {
    expect(generateMaySendToAi(0)).toBe(false)
    expect(generateMaySendToAi(4)).toBe(false)
  })

  it('says so while the round count is unknown', () => {
    expect(generateMaySendToAi(null)).toBe(true)
    expect(generateMaySendToAi(undefined)).toBe(true)
  })
})

describe('isAiWrittenPlan', () => {
  it('is true when Claude’s draft was stored, first time or after a repair', () => {
    expect(isAiWrittenPlan({ status: 'ok', model: 'm', attempts: [], request_id: null })).toBe(true)
    expect(isAiWrittenPlan({ status: 'repaired', model: 'm', attempts: [], request_id: null })).toBe(true)
  })

  it('is false for a plan built without AI', () => {
    expect(isAiWrittenPlan({ status: 'baseline', reason: 'insufficient_rounds' })).toBe(false)
    expect(isAiWrittenPlan({ status: 'error', model: 'm', error_type: 'x', request_id: null, message: 'x' })).toBe(false)
  })

  it('is false for plans with no record of how they were built', () => {
    expect(isAiWrittenPlan(null)).toBe(false)
    expect(isAiWrittenPlan(undefined)).toBe(false)
    expect(isAiWrittenPlan('ok')).toBe(false)
    expect(isAiWrittenPlan([])).toBe(false)
  })
})
