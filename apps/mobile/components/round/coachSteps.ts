import type { CoachStep } from '../help/CoachMarks'

// Coach-mark copy for the round screens (#900). Ids are the CoachTarget ids
// and, per step, the device-local "seen" flag — reword freely, but a new id
// shows the step again to everyone.

const hero: CoachStep = {
  id: 'live.hero',
  title: 'Distance to the pin',
  body: 'From your ball to the flag. Next to it: how many strokes a player at your handicap usually takes from here.',
}
const holes: CoachStep = {
  id: 'live.holes',
  title: 'Holes',
  body: '‹ and › move between holes. ⋮ ends or deletes the round. ← goes home — the round waits for you.',
}
const card: CoachStep = { id: 'live.card', title: 'Scorecard', body: 'Your card so far. Tap a hole on it to jump there.' }
const pattern: CoachStep = {
  id: 'live.pattern',
  title: 'Pattern',
  body: 'Shows where your shots with the chosen club usually finish, around your aim — the ring holds about two in three.',
}
const pin: CoachStep = {
  id: 'live.pin',
  title: 'Pin',
  body: "Tap, then tap the map where today's flag is. Distances and the pattern use it.",
}
const wheel: CoachStep = {
  id: 'live.wheel',
  title: 'Club',
  body: 'Flick to change club. AUTO is the suggestion for this distance; a club you pick lasts one shot.',
}
const recenter: CoachStep = {
  id: 'live.recenter',
  title: 'Ball on GPS',
  body: 'Moves the ball back to where your phone is. Drag the ball on the map to fine-tune it.',
}
const voice: CoachStep = {
  id: 'live.voice',
  title: 'Next step',
  body: 'This line says what to do next — and asks if a shot went out of bounds.',
}

export const LIVE_PLACE_STEPS: CoachStep[] = [
  hero,
  holes,
  card,
  voice,
  {
    id: 'live.row.place',
    title: 'Mark your ball',
    body: 'Stand at your ball and tap Mark my ball. On the green switches to putting; Finish hole opens the hole review.',
  },
  recenter,
  pattern,
  pin,
  wheel,
]

export const LIVE_AIM_STEPS: CoachStep[] = [
  {
    id: 'live.row.aim',
    title: 'Aim, then hit',
    body: 'Tap or drag on the map to set where you are aiming, then Confirm aim. Skip aim if you don’t want to track it.',
  },
  {
    id: 'live.ruler',
    title: 'Aim guide',
    body: 'Tee draws the landing width, Appr a circle round your aim. Drag the ruler to size it.',
  },
  wheel,
  pattern,
  hero,
]

export const LIVE_PUTT_STEPS: CoachStep[] = [
  {
    id: 'live.row.putt',
    title: 'Putting',
    body: 'Made it holes out and opens the hole review. Missed marks the next putt from where it stopped. Not on the green goes back to a normal shot.',
  },
  hero,
  card,
]

export const PAST_STEPS: CoachStep[] = [
  { id: 'past.tabs', title: 'Card or map', body: 'The scorecard, or each hole on the map with every shot where you hit it.' },
  {
    id: 'past.hole',
    title: 'This hole',
    body: 'Distance to the pin from the selected shot, and your score — circles under par, squares over.',
  },
  {
    id: 'past.modes',
    title: 'Ball · Aim · Pin',
    body: 'Pick what a tap on the map moves: the shot, where you aimed it, or the flag.',
  },
  {
    id: 'past.footer',
    title: 'Shots',
    body: 'Add or remove shots, step through them, and edit a shot’s club, lie and result.',
  },
]
