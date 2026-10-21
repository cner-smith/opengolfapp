import {
  SHOT_CONTACTS,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPES,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINES,
  SHOT_START_LINE_LABELS,
  type DispersionPoint,
} from '@oga/core'
import type { ShotExtras } from '../../hooks/useShotPatterns'

// What the chart can show, and how a group of shots is marked. Each group has
// a colour AND a glyph, so no group is told apart by colour alone: the glyph
// points the way the ball went on screen (left or right), a filled glyph is the
// strong version (hook, slice) and an open one the mild (draw, fade).

export type Layer = 'shots' | 'rings' | 'average' | 'flights'
export type ColourBy = 'none' | 'shape' | 'start' | 'contact'
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
export const NOT_RECORDED = 'none'
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

/** Categories in screen order (left to right), without "not recorded". A
 *  left-hander's keys are mirrored, so their slice (curves left) is on the left. */
export function categoriesFor(by: ColourBy, leftHanded: boolean): Category[] {
  if (by === 'shape') {
    const order = leftHanded ? [...SHOT_SHAPES].reverse() : SHOT_SHAPES
    return order.map((s, i) => ({ key: s, label: SHOT_SHAPE_LABELS[s], ...SHAPE_STYLE[i]! }))
  }
  if (by === 'start') {
    const order = leftHanded ? [...SHOT_START_LINES].reverse() : SHOT_START_LINES
    return order.map((s, i) => ({ key: s, label: SHOT_START_LINE_LABELS[s], ...START_STYLE[i]! }))
  }
  if (by === 'contact') {
    return SHOT_CONTACTS.map((c) => ({ key: c, label: SHOT_CONTACT_LABELS[c], ...CONTACT_STYLE[c] }))
  }
  return []
}

export function categoryOf(p: DispersionPoint, extras: ShotExtras | undefined, by: ColourBy): string {
  const v = by === 'shape' ? p.shape : by === 'start' ? p.startLine : by === 'contact' ? extras?.contact : null
  return v ?? NOT_RECORDED
}

const INVARIANT = new Set(['straight', 'on_line', 'solid', 'fat', 'thin', 'topped'])
/** "3 draws", "2 straight", "5 pushes". */
export function countWord(key: string, label: string, n: number) {
  const w = label.toLowerCase()
  if (n === 1 || INVARIANT.has(key)) return `${n} ${w}`
  return `${n} ${w.endsWith('sh') ? `${w}es` : `${w}s`}`
}
