// Words and approach-relative measures for a green (#1378). Measurements
// only, never advice.
import { median } from '../shot-patterns'
import type { DistanceUnit } from '../types'
import { FEET_TO_CM, FEET_TO_METERS } from '../units'
import { checkGreenGrid, GREEN_CELL_M, type GreenGrid } from './codec'
import type { SlopeField } from './slope'

export type SteepnessTerm = 'Flat' | 'Gentle' | 'Moderate' | 'Steep' | 'Severe'

/** Flat < 1 · Gentle 1–2 · Moderate 2–3 · Steep 3–4 · Severe ≥ 4 (%). */
export function steepnessTerm(slopePct: number): SteepnessTerm {
  // A fitted 2% comes out as 1.9999999…; it should still read Moderate.
  const pct = slopePct + 1e-9
  if (pct < 1) return 'Flat'
  if (pct < 2) return 'Gentle'
  if (pct < 3) return 'Moderate'
  if (pct < 4) return 'Steep'
  return 'Severe'
}

// Ends of the green as the player sees them, by bearing relative to the
// approach: 0 = straight on (the back), 180 = toward the player (the front).
const ENDS = ['back', 'back right', 'right', 'front right', 'front', 'front left', 'left', 'back left']

export function endAt(relDeg: number): string {
  return ENDS[Math.floor((((relDeg % 360) + 360 + 22.5) % 360) / 45)]!
}

/**
 * "Back to front", "Back left to front right": the high end, then the low end,
 * relative to the player's approach bearing. "Level" wherever the steepness
 * reads Flat (under 1%); the hachures keep the lower 0.8% noise floor.
 */
export function bothEndsWords(downhillDeg: number, tiltPct: number, approachDeg: number): string {
  if (steepnessTerm(tiltPct) === 'Flat') return 'Level'
  const rel = downhillDeg - approachDeg
  const s = `${endAt(rel + 180)} to ${endAt(rel)}`
  return s[0]!.toUpperCase() + s.slice(1)
}

export interface FalseFront {
  /** Whole metres in from the front edge. */
  depthM: number
  /** Median fall back toward the player, 1–4 m in from the front edge. */
  pct: number
}

/** A height on the green (a tier step, a crown's fall): whole inches or whole centimetres. */
export function greenHeightWords(cm: number, unit: DistanceUnit): string {
  return unit === 'meters' ? `${Math.round(cm)} cm` : `${Math.round((cm / FEET_TO_CM) * 12)} in`
}

/** "First 13 ft fall back at 6.7%" (imperial), "First 4 m fall back at 6.7%" (metric). */
export function falseFrontWords(ff: FalseFront, unit: DistanceUnit): string {
  const depth = unit === 'meters' ? `${ff.depthM} m` : `${Math.round(ff.depthM / FEET_TO_METERS)} ft`
  return `First ${depth} fall back at ${ff.pct.toFixed(1)}%`
}
const FALSE_FRONT_PCT = 3.5
const FALSE_FRONT_OVER_REST = 1.5

/**
 * The research rule (v2): the median fall back toward the player 1–4 m in
 * from the front edge (the collar skipped) is ≥ 3.5% and ≥ 1.5 points steeper
 * than the rest of the green (≥ 6 m in, ≥ 3 m from the back). Depth counts the
 * 1 m bands from the edge that stay ≥ max(3%, rest + 1%). Distances run along
 * the approach line; only the middle 60% of the green's width is read.
 */
export function falseFront(g: GreenGrid, field: SlopeField, approachDeg: number): FalseFront | null {
  checkGreenGrid(g)
  const { width: W, height: H, mask } = g
  const n = W * H
  if (field.gradN.length !== n) throw new Error('Slope field does not match the grid')
  const b = (approachDeg * Math.PI) / 180
  const fx = Math.sin(b)
  const fy = Math.cos(b)

  const u = new Float64Array(n)
  const v = new Float64Array(n)
  const edges = new Map<number, { front: number; back: number }>()
  let vMin = Infinity
  let vMax = -Infinity
  for (let j = 0; j < n; j++) {
    if (!mask[j]) continue
    const x = (j % W) * GREEN_CELL_M
    const y = -Math.floor(j / W) * GREEN_CELL_M
    u[j] = x * fx + y * fy
    v[j] = x * fy - y * fx
    vMin = Math.min(vMin, v[j]!)
    vMax = Math.max(vMax, v[j]!)
    const key = Math.round(v[j]! / GREEN_CELL_M)
    const e = edges.get(key)
    if (!e) edges.set(key, { front: u[j]!, back: u[j]! })
    else {
      e.front = Math.min(e.front, u[j]!)
      e.back = Math.max(e.back, u[j]!)
    }
  }

  const margin = 0.2 * (vMax - vMin)
  const front: number[] = []
  const rest: number[] = []
  const bands: number[][] = []
  for (let j = 0; j < n; j++) {
    if (!mask[j] || field.collar[j] || v[j]! < vMin + margin || v[j]! > vMax - margin) continue
    const e = edges.get(Math.round(v[j]! / GREEN_CELL_M))!
    const d = u[j]! - e.front + GREEN_CELL_M / 2
    const toBack = e.back + GREEN_CELL_M / 2 - u[j]!
    const fall = 100 * (field.gradE[j]! * fx + field.gradN[j]! * fy)
    if (!Number.isFinite(fall)) continue
    if (d >= 1 && d < 4) front.push(fall)
    if (d >= 6 && toBack >= 3) rest.push(fall)
    if (d >= 1) (bands[Math.floor(d)] ??= []).push(fall)
  }

  const f = median(front)
  const r = median(rest)
  if (f === null || r === null || f < FALSE_FRONT_PCT || f < r + FALSE_FRONT_OVER_REST) return null
  const floor = Math.max(3, r + 1)
  let k = 1
  while ((median(bands[k] ?? []) ?? -Infinity) >= floor) k++
  return { depthM: k, pct: f }
}
