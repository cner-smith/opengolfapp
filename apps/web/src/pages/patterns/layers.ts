import { SHOT_CONTACTS, categoriesFor, type ColourBy } from '@oga/core'

// What the chart can show, and how a group of shots is marked. Each group has
// a colour AND a glyph, so no group is told apart by colour alone: the glyph
// points the way the ball went on screen (left or right), a filled glyph is the
// strong version (hook, slice) and an open one the mild (draw, fade).

export type Layer = 'shots' | 'rings' | 'average' | 'flights'
export type Glyph =
  | 'dot'
  | 'left'
  | 'left-open'
  | 'right'
  | 'right-open'
  | 'tick-below'
  | 'tick-above'
  | 'cross'
  | 'square'
  | 'unrecorded'

export interface Category {
  key: string
  label: string
  color: string
  glyph: Glyph
}

export const DEFAULT_LAYERS: Record<Layer, boolean> = { shots: true, rings: true, average: true, flights: true }
export const COLOUR_BY: { value: ColourBy; label: string; short: string }[] = [
  { value: 'none', label: 'None', short: 'None' },
  { value: 'shape', label: 'Shape', short: 'Shape' },
  { value: 'start', label: 'Start line', short: 'Start' },
  { value: 'contact', label: 'Contact', short: 'Contact' },
]
export const INK = '#1C211C'
export const UNRECORDED_INK = '#8A8B7E'

// Left = the forest family, right = rust, the middle = ink. Every colour is at
// least 4.5:1 on the paper (#FBF8F1).
const LEFT_STRONG = '#1F5A3A'
const LEFT_MILD = '#2F6E48'
const RIGHT_MILD = '#9A4F24'
const RIGHT_STRONG = '#7A2A1E'
const SHAPE_STYLE: { color: string; glyph: Glyph }[] = [
  { color: LEFT_STRONG, glyph: 'left' },
  { color: LEFT_MILD, glyph: 'left-open' },
  { color: INK, glyph: 'dot' },
  { color: RIGHT_MILD, glyph: 'right-open' },
  { color: RIGHT_STRONG, glyph: 'right' },
]
const START_STYLE: { color: string; glyph: Glyph }[] = [
  { color: LEFT_MILD, glyph: 'left' },
  { color: INK, glyph: 'dot' },
  { color: RIGHT_MILD, glyph: 'right' },
]
// Contact is told by its glyph; colour only separates a clean strike from a miss.
const CONTACT_STYLE: Record<(typeof SHOT_CONTACTS)[number], { color: string; glyph: Glyph }> = {
  solid: { color: INK, glyph: 'dot' },
  fat: { color: '#8A5A2B', glyph: 'tick-below' },
  thin: { color: '#8A5A2B', glyph: 'tick-above' },
  topped: { color: '#A33A2A', glyph: 'cross' },
  shank: { color: '#5B2B22', glyph: 'square' },
}

/** Core's groups in screen order (categoriesFor), each with its colour and
 *  glyph: shape and start line by screen position, contact by value. */
export function styledCategories(by: ColourBy, leftHanded: boolean): Category[] {
  return categoriesFor(by, leftHanded).map((c, i) => ({
    ...c,
    ...(by === 'shape' ? SHAPE_STYLE[i]! : by === 'start' ? START_STYLE[i]! : CONTACT_STYLE[c.key as (typeof SHOT_CONTACTS)[number]]),
  }))
}
