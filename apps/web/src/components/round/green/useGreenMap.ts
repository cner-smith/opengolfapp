import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  decodeGreenGrid,
  decodePolyline,
  greenContours,
  greenHachures,
  greenPlaneTilt,
  greenShape,
  greenSlopeField,
  GREEN_CELL_M,
  type GeoPoint,
  type GreenContours,
  type GreenGrid,
  type GreenShape,
  type Hachure,
  type PlaneTilt,
  type SlopeField,
} from '@oga/core'
import { byteaBytes, getGreenGrid, getGreenOutlines, type Database } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']

export type GreenViewMode = 'plain' | 'height' | 'slope'

export interface GreenSurvey {
  lng0: number
  lat0: number
  g: GreenGrid
  field: SlopeField
  hachures: Hachure[]
  tilt: PlaneTilt | null
  contours: GreenContours
  shape: GreenShape | null
}

export interface GreenData {
  outline: GeoPoint[]
  /** Where the outline came from, for the source line. */
  outlineSource: string
  /** 'none' = no height grid for this green (or one flagged as suspect): Plain only. */
  lidar: 'loading' | 'none' | 'ready'
  gridSource: string | null
  survey: GreenSurvey | null
}

/**
 * The round's greens (#1380). Outlines come per course; the active hole's
 * height grid is read when it's shown. `courseHasGreens` is false when the
 * course has no green_maps rows at all, so callers keep today's layout.
 */
export function useGreenMap(holes: HoleRow[], holeId: string | undefined) {
  // A back-nine loop hole (0066) reads its front-nine hole's row.
  const greenIdOf = (h: HoleRow) => h.loop_of ?? h.id
  const ids = useMemo(
    () => [...new Set(holes.filter((h) => !h.id.startsWith('synthetic')).map(greenIdOf))].sort(),
    [holes],
  )
  const outlines = useQuery({
    queryKey: ['green-outlines', ids],
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await getGreenOutlines(supabase, ids)
      if (error) throw error
      return data ?? []
    },
  })
  const hole = holes.find((h) => h.id === holeId)
  const row = hole ? outlines.data?.find((r) => r.hole_id === greenIdOf(hole)) : undefined
  const wantGrid = row != null && row.grid_source != null && !row.grid_flagged
  const grid = useQuery({
    queryKey: ['green-grid', row?.hole_id],
    enabled: wantGrid,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await getGreenGrid(supabase, row!.hole_id)
      if (error) throw error
      return data
    },
  })

  const outline = useMemo(() => {
    if (!row) return null
    try {
      const pts = decodePolyline(row.outline)
      return pts.length >= 3 ? pts : null
    } catch {
      return null
    }
  }, [row?.outline])

  const survey = useMemo<GreenSurvey | null>(() => {
    const d = grid.data
    if (!wantGrid || !d?.grid || d.grid_lng0 == null || d.grid_lat0 == null) return null
    try {
      const g = decodeGreenGrid(byteaBytes(d.grid))
      const field = greenSlopeField(g)
      return {
        lng0: d.grid_lng0,
        lat0: d.grid_lat0,
        g,
        field,
        hachures: greenHachures(g, field),
        tilt: greenPlaneTilt(g),
        contours: greenContours(g),
        shape: greenShape(g),
      }
    } catch (e) {
      // A grid that won't decode shows as Plain, like a green with no survey.
      console.error('[green grid]', e)
      return null
    }
  }, [wantGrid, grid.data])

  const lidar = !wantGrid ? 'none' : survey ? 'ready' : grid.isPending ? 'loading' : 'none'
  // Stable while nothing changes: the map overlay repaints on a new object.
  const green = useMemo<GreenData | null>(
    () =>
      row && outline
        ? { outline, outlineSource: row.outline_source, lidar, gridSource: row.grid_source, survey }
        : null,
    [row?.outline_source, row?.grid_source, outline, lidar, survey],
  )
  return { courseHasGreens: (outlines.data?.length ?? 0) > 0, green }
}

// Soft green viridis (owner pick, #1379 round 5, palette v2): flat at a soft
// fairway green, steep at navy; 0–5%, lightness monotonic for every vision.
export const SLOPE_STOPS = ['#EAF2DC', '#a2da37', '#44bf70', '#1e9c89', '#287d8e', '#32648e', '#1C2F52']
export const SLOPE_FULL_PCT = 5
// The research height ramp (green-lidar v2): navy low to pale yellow high.
export const HEIGHT_STOPS = ['#16325c', '#1f6f99', '#3fa79a', '#a9d48b', '#f4ee9c', '#fffbe8']
/** The collar (outer 1 m) is drawn faded. */
const COLLAR_ALPHA = 0.45

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

function ramp(stops: string[], t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  const a = rgb(stops[i]!)
  const b = rgb(stops[i + 1]!)
  const f = x - i
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/** One pixel per cell, north up; transparent outside the outline. */
export function paintGreen(canvas: HTMLCanvasElement, s: GreenSurvey, mode: 'height' | 'slope'): void {
  const { width: W, height: H, mask, heightsMm } = s.g
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(W, H)
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j < W * H; j++) {
    if (!mask[j] || s.field.collar[j]) continue
    lo = Math.min(lo, heightsMm[j]!)
    hi = Math.max(hi, heightsMm[j]!)
  }
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue
    const slope = s.field.slopePct[j]!
    const [r, g, b] =
      mode === 'slope'
        ? ramp(SLOPE_STOPS, Number.isFinite(slope) ? slope / SLOPE_FULL_PCT : 0)
        : ramp(HEIGHT_STOPS, hi > lo ? (heightsMm[j]! - lo) / (hi - lo) : 0.5)
    img.data[4 * j] = r
    img.data[4 * j + 1] = g
    img.data[4 * j + 2] = b
    img.data[4 * j + 3] = 255 * (s.field.collar[j] ? COLLAR_ALPHA : 1)
  }
  ctx.putImageData(img, 0, 0)
}

/** The image's corners in grid metres (east, south): cell edges, half a cell out from the centres. */
export function gridCorners(g: GreenGrid): [number, number][] {
  const h = GREEN_CELL_M / 2
  const e = g.width * GREEN_CELL_M - h
  const s = g.height * GREEN_CELL_M - h
  return [[-h, -h], [e, -h], [e, s], [-h, s]]
}

/** H2 tapered hachure: wide at the uphill end, sharp downhill; grid metres (east, south). */
export function hachureTriangle(h: Hachure): [number, number][] {
  const d = (h.downhillDeg * Math.PI) / 180
  const ux = Math.sin(d)
  const uy = -Math.cos(d)
  const w = 0.22
  const bx = h.eastM - (ux * h.lengthM) / 2
  const by = h.southM - (uy * h.lengthM) / 2
  return [
    [bx - uy * w, by + ux * w],
    [bx + uy * w, by - ux * w],
    [h.eastM + (ux * h.lengthM) / 2, h.southM + (uy * h.lengthM) / 2],
  ]
}
