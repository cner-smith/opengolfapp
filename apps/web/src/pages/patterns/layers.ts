import {
  SHOT_CONTACT_LABELS,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  type ShotContact,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'

// What the chart can show (direction D, "Layers"). Mock only; web and mobile
// keep identical copies (pages/patterns/layers.ts, components/patterns/layers.ts).

export type Layer = 'rings' | 'average' | 'shots' | 'flights'
export type ColourBy = 'none' | 'shape' | 'start' | 'contact'
export interface ShotAxes {
  shape: ShotShape | null
  startLine: ShotStartLine | null
  contact: ShotContact | null
}
export interface Category {
  key: string
  label: string
  color: string
}

export const DEFAULT_LAYERS: Record<Layer, boolean> = { rings: true, average: true, shots: true, flights: true }
export const COLOUR_BY: { value: ColourBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'shape', label: 'Shape' },
  { value: 'start', label: 'Start line' },
  { value: 'contact', label: 'Contact' },
]
export const NOT_RECORDED = 'none'
export const UNRECORDED_INK = '#8A8B7E'

// Diverging by where the ball goes on screen: forest for left, warm for
// right, ink grey in the middle. A left-hander's keys are mirrored, so a
// left-hander's slice (curves left) takes the forest end.
const DIVERGE5 = ['#1F5A3A', '#5FA077', '#4A4D45', '#D08A4E', '#A33A2A']
const DIVERGE3 = ['#2F6E48', '#4A4D45', '#C27A44']
const CONTACT: Record<ShotContact, string> = {
  solid: '#4A4D45',
  fat: '#8A5A2B',
  thin: '#D08A4E',
  topped: '#A33A2A',
  shank: '#5B2B22',
}
const SHAPES: ShotShape[] = ['hook', 'draw', 'straight', 'fade', 'slice']
const STARTS: ShotStartLine[] = ['pull', 'on_line', 'push']

/** Categories in screen order (left to right), without "not recorded". */
export function categoriesFor(by: ColourBy, leftHanded: boolean): Category[] {
  if (by === 'shape') {
    const order = leftHanded ? [...SHAPES].reverse() : SHAPES
    return order.map((s, i) => ({ key: s, label: SHOT_SHAPE_LABELS[s], color: DIVERGE5[i]! }))
  }
  if (by === 'start') {
    const order = leftHanded ? [...STARTS].reverse() : STARTS
    return order.map((s, i) => ({ key: s, label: SHOT_START_LINE_LABELS[s], color: DIVERGE3[i]! }))
  }
  if (by === 'contact') {
    return (Object.keys(CONTACT) as ShotContact[]).map((c) => ({ key: c, label: SHOT_CONTACT_LABELS[c], color: CONTACT[c] }))
  }
  return []
}

export function categoryOf(axes: ShotAxes | undefined, by: ColourBy): string {
  if (!axes || by === 'none') return NOT_RECORDED
  const v = by === 'shape' ? axes.shape : by === 'start' ? axes.startLine : axes.contact
  return v ?? NOT_RECORDED
}

const INVARIANT = new Set(['straight', 'on_line', 'solid', 'fat', 'thin', 'topped'])
/** "3 draws", "2 straight", "5 pushes". */
export function countWord(key: string, label: string, n: number) {
  const w = label.toLowerCase()
  if (n === 1 || INVARIANT.has(key)) return `${n} ${w}`
  return `${n} ${w.endsWith('sh') ? `${w}es` : `${w}s`}`
}

/** "Shape recorded on 7 of 13: 3 draws, 2 straight, 2 slices" + the commonest. */
export function recordedSummary(
  by: Exclude<ColourBy, 'none'>,
  ids: string[],
  axes: Record<string, ShotAxes>,
) {
  const cats = categoriesFor(by, false)
  const counts = new Map<string, number>()
  for (const id of ids) {
    const k = categoryOf(axes[id], by)
    if (k !== NOT_RECORDED) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const recorded = [...counts.values()].reduce((a, b) => a + b, 0)
  const ranked = cats.filter((c) => counts.has(c.key)).sort((a, b) => counts.get(b.key)! - counts.get(a.key)!)
  const top = ranked[0]
  const tie = ranked.length > 1 && counts.get(ranked[1]!.key) === counts.get(top!.key)
  const noun = by === 'shape' ? 'Shape' : by === 'start' ? 'Start line' : 'Contact'
  return {
    recorded,
    value: !top ? '—' : tie ? 'Mixed' : top.label,
    note:
      recorded === 0
        ? `Not recorded on any of these ${ids.length} shots yet`
        : `${noun} recorded on ${recorded} of ${ids.length}: ${ranked.map((c) => countWord(c.key, c.label, counts.get(c.key)!)).join(', ')}`,
  }
}
