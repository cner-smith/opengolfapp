import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  clipGreenGrid,
  decodeGreenGrid,
  decodePolyline,
  greenContours,
  greenHachures,
  greenPlaneTilt,
  greenShape,
  greenSlopeField,
  playerOutlineSurvey,
  type GeoPoint,
  type GreenContours,
  type GreenGrid,
  type GreenShape,
  type Hachure,
  type PlaneTilt,
  type SlopeField,
} from '@oga/core'
import { byteaBytes, getGreenGrid, getGreenOutlines, getMyGreenOutlines, type Database } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'

const NOTE_SUSPECT = 'The slope survey may not match this green.'

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
  /** The green_maps hole id (a loop hole's front-nine hole): where a redraw is saved. */
  greenId: string
  /** The outline shown: the player's own when they drew one (#1504), else ours. */
  outline: GeoPoint[]
  /** Our outline, drawn dashed under a redraw. */
  ours: GeoPoint[]
  /** The player drew `outline` themselves. */
  mine: boolean
  /** When the survey was flown (YYYY-MM-DD), for the redraw panel. */
  flownOn: string | null
  /** Where the outline came from, for the source line. */
  outlineSource: string
  /** 'none' = no height grid for this green (or one flagged as suspect); 'error' = it didn't load. Both: Plain only. */
  lidar: 'loading' | 'none' | 'error' | 'ready'
  gridSource: string | null
  /** Set when the survey exists but was hidden as suspect; replaces "no survey" (matches mobile). */
  gridNote: string | null
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
  // The player's own outlines (#1504, private): theirs replaces ours for them.
  const mineQ = useQuery({
    queryKey: ['my-green-outlines', ids],
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await getMyGreenOutlines(supabase, ids)
      if (error) throw error
      return data ?? []
    },
  })
  const hole = holes.find((h) => h.id === holeId)
  const row = hole ? outlines.data?.find((r) => r.hole_id === greenIdOf(hole)) : undefined
  const mineRow = row ? mineQ.data?.find((r) => r.hole_id === row.hole_id) : undefined
  // Our hide rules judged our outline; a player's is judged on its own below.
  const wantGrid = row != null && row.grid_source != null && (mineRow != null || !row.grid_flagged)
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

  const ours = useMemo(() => ringOf(row?.outline), [row?.outline])
  const mine = useMemo(() => ringOf(mineRow?.outline), [mineRow?.outline])
  const outline = mine ?? ours
  const flagged = row?.grid_flagged ?? false
  const flagReason = row?.grid_flag_reason ?? null

  const { survey, note } = useMemo<{ survey: GreenSurvey | null; note: string | null }>(() => {
    const d = grid.data
    if (!wantGrid || !outline || !d?.grid || d.grid_lng0 == null || d.grid_lat0 == null) return { survey: null, note: null }
    try {
      const full = decodeGreenGrid(byteaBytes(d.grid))
      // A player's outline is judged afresh (#1504); padded grids run past the green, so cut to the outline (#1502).
      const cut = mine ? playerOutlineSurvey(full, d.grid_lng0, d.grid_lat0, mine, flagged, flagReason) : null
      if (cut && 'hidden' in cut)
        return { survey: null, note: cut.hidden === 'not_reached' ? 'The slope survey doesn’t reach all of your outline.' : NOTE_SUSPECT }
      const g = cut ? cut.grid : clipGreenGrid(full, d.grid_lng0, d.grid_lat0, outline)
      const tilt = cut ? cut.tilt : greenPlaneTilt(g)
      const field = greenSlopeField(g)
      return {
        survey: {
          lng0: d.grid_lng0,
          lat0: d.grid_lat0,
          g,
          field,
          hachures: greenHachures(g, field),
          tilt,
          contours: greenContours(g),
          shape: greenShape(g),
        },
        note: null,
      }
    } catch (e) {
      // A grid that won't decode shows as Plain, like a green with no survey.
      console.error('[green grid]', e)
      return { survey: null, note: null }
    }
  }, [wantGrid, grid.data, outline, mine, flagged, flagReason])

  const lidar: GreenData['lidar'] = !wantGrid ? 'none' : survey ? 'ready' : grid.isPending ? 'loading' : grid.isError ? 'error' : 'none'
  // Stable while nothing changes: the map overlay repaints on a new object.
  const green = useMemo<GreenData | null>(
    () =>
      row && outline && ours
        ? {
            greenId: row.hole_id,
            outline,
            ours,
            mine: mine != null,
            flownOn: row.grid_flown_on,
            outlineSource: mine ? 'player' : row.outline_source,
            lidar,
            gridSource: row.grid_source,
            gridNote: note ?? (flagged && !mine ? NOTE_SUSPECT : null),
            survey,
          }
        : null,
    [row?.hole_id, row?.outline_source, row?.grid_source, row?.grid_flown_on, flagged, outline, ours, mine, lidar, survey, note],
  )
  return { courseHasGreens: (outlines.data?.length ?? 0) > 0, green }
}

function ringOf(polyline: string | undefined): GeoPoint[] | null {
  if (!polyline) return null
  try {
    const pts = decodePolyline(polyline)
    return pts.length >= 3 ? pts : null
  } catch {
    return null
  }
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
