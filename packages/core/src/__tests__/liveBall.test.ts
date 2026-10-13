import { describe, expect, it } from 'vitest'
import { initialLiveBall, liveBall, markSpot, type LiveBallEvent, type LiveBallState } from '../live-ball'

// Positions near Whistling Straits hole 1.
const TEE = { lat: 43.849856, lng: -87.734575 }
const FAIRWAY = { lat: 43.84906, lng: -87.733 }
const DRAGGED = { lat: 43.8492, lng: -87.7332 }
const GREEN = { lat: 43.8481, lng: -87.7311 }
const fix = (p: { lat: number; lng: number }): LiveBallEvent => ({ type: 'fix', ...p, accuracy: 3 })
const run = (events: LiveBallEvent[], from: LiveBallState = initialLiveBall) => events.reduce(liveBall, from)

describe('liveBall: where Mark puts the next shot', () => {
  it('a ball placed by hand holds through GPS fixes until the shot is saved, then follows GPS', () => {
    const held = run([fix(TEE), { type: 'placed', at: DRAGGED }, fix(FAIRWAY)])
    expect(held.ball).toEqual(DRAGGED)
    expect(held.source).toBe('hand')

    const saved = run([{ type: 'shotSaved' }], held)
    expect(saved.source).toBe('gps')
    expect(saved.ball).toEqual(FAIRWAY)
  })

  it('OB puts the ball at the OB shot start and holds it; Undo hands the ball back to GPS (#1090)', () => {
    const ob = run([fix(TEE), { type: 'shotSaved' }, fix(FAIRWAY), { type: 'obSet', start: TEE }, fix(FAIRWAY)])
    expect(ob.ball).toEqual(TEE)
    expect(ob.source).toBe('replay')

    // The player walks on after undoing: the ball must follow, not stay on the OB start.
    const undone = run([{ type: 'obUndone' }], ob)
    expect(undone.source).toBe('gps')
    expect(undone.ball).toEqual(FAIRWAY)
  })

  it('just-track (Mark saves at once) follows GPS for every shot on the hole, not just the first', () => {
    const marks: Array<{ lat: number; lng: number } | null> = []
    let s = initialLiveBall
    for (const at of [TEE, FAIRWAY, GREEN]) {
      s = run([fix(at)], s)
      marks.push(s.ball)
      s = run([{ type: 'placed', at: s.ball! }, { type: 'shotSaved' }], s)
    }
    expect(marks).toEqual([TEE, FAIRWAY, GREEN])
  })

  it('"Put the ball on my GPS spot" takes a placed ball back to GPS', () => {
    const s = run([fix(TEE), { type: 'placed', at: DRAGGED }, fix(FAIRWAY), { type: 'recenter', at: FAIRWAY }])
    expect(s.source).toBe('gps')
    expect(s.ball).toEqual(FAIRWAY)
  })

  it('a new hole starts clean: the last hole\'s fix must not become the new tee shot\'s start', () => {
    const s = run([fix(GREEN), { type: 'placed', at: DRAGGED }, { type: 'holeChanged' }, { type: 'teeDefault', tee: TEE }])
    expect(s.source).toBe('gps')
    expect(markSpot(s)).toEqual(TEE)
  })

  it('the tee is only a starting default: it never replaces a ball that is already there', () => {
    expect(run([{ type: 'teeDefault', tee: TEE }]).ball).toEqual(TEE)
    expect(run([fix(FAIRWAY), { type: 'teeDefault', tee: TEE }]).ball).toEqual(FAIRWAY)
  })

  it('the ball on screen is the latest fix, so it shows exactly where Mark will save the shot (#1108)', () => {
    const s = run([fix(TEE), fix(FAIRWAY), fix(GREEN)])
    expect(s.ball).toEqual(GREEN)
    expect(markSpot(s)).toEqual(GREEN)
  })

  it('with no fix since the last saved shot, Mark has no spot: the old one is never reused (#1108)', () => {
    const s = run([fix(TEE), { type: 'shotSaved' }])
    expect(s.awaitingFix).toBe(true)
    expect(markSpot(s)).toBeNull()

    // GPS restarting after the save re-sends the spot the player is still standing on.
    expect(markSpot(run([fix(TEE)], s))).toBeNull()

    const moved = run([fix(FAIRWAY)], s)
    expect(moved.awaitingFix).toBe(false)
    expect(markSpot(moved)).toEqual(FAIRWAY)
  })

  it('after a save, a ball the player places or puts on their GPS spot is a spot Mark can use', () => {
    expect(markSpot(run([fix(TEE), { type: 'shotSaved' }, { type: 'placed', at: DRAGGED }]))).toEqual(DRAGGED)
    expect(markSpot(run([fix(TEE), { type: 'shotSaved' }, { type: 'recenter', at: FAIRWAY }]))).toEqual(FAIRWAY)
  })

  it('Mark uses the held spot when the ball was placed by hand or sits on the replay spot', () => {
    expect(markSpot(run([fix(TEE), { type: 'placed', at: DRAGGED }, fix(FAIRWAY)]))).toEqual(DRAGGED)
    expect(markSpot(run([fix(FAIRWAY), { type: 'obSet', start: TEE }, fix(GREEN)]))).toEqual(TEE)
  })

  it('recenter with no fresh fix yet snaps to the GPS position the app has', () => {
    const s = run([{ type: 'teeDefault', tee: TEE }, { type: 'placed', at: DRAGGED }, { type: 'recenter', at: FAIRWAY }])
    expect(s.source).toBe('gps')
    expect(s.ball).toEqual(FAIRWAY)
  })

  it('backing out of the aim after Mark leaves the ball following GPS', () => {
    // Mark pins the start for the aim step; Re-place / Not on the green return to placing the ball.
    const s = run([fix(TEE), { type: 'marked', at: TEE }, fix(FAIRWAY)])
    expect(s.source).toBe('gps')
    expect(markSpot(s)).toEqual(FAIRWAY)
  })

  it('Mark keeps a hand-placed ball held: the player chose that spot', () => {
    const s = run([fix(TEE), { type: 'placed', at: DRAGGED }, { type: 'marked', at: DRAGGED }, fix(FAIRWAY)])
    expect(s.source).toBe('hand')
    expect(markSpot(s)).toEqual(DRAGGED)
  })
})
