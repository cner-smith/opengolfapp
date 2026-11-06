import { useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import {
  decodeGreenGrid,
  decodePolyline,
  greenContours,
  greenHachures,
  greenPlaneTilt,
  greenShape,
  greenSlopeField,
  type GeoPoint,
  type GreenContours,
  type GreenGrid,
  type GreenShape,
  type Hachure,
  type PlaneTilt,
  type SlopeField,
} from '@oga/core'
import { byteaBytes, getGreenGrid, getGreenOutlines } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { logDiag } from '../../../lib/db'
import { isNetworkFailure, offlineKeys, readCache, writeCache } from '../../../lib/offlineCache'

// The round's greens (#1381): the outlines at once, then each height grid
// read, decoded and worked into slope, marks, contours and pictures, one
// green per idle slot from the hole the player is on, so each is ready before
// the player gets there (owner, #1381). Outlines and grids are cached for the
// round's course, so a cold start without signal still has them.

export interface GreenLidar {
  grid: GreenGrid
  field: SlopeField
  /** Cell (0,0)'s centre. */
  lng0: number
  lat0: number
  tilt: PlaneTilt | null
  shape: GreenShape | null
  hachures: Hachure[]
  contours: GreenContours
  slopeUri: string
  heightUri: string
}

export interface PreparedGreen {
  ring: GeoPoint[]
  outlineSource: string
  gridSource: string | null
  /** Why there's no read; the view says so in its place. */
  gridNote: string | null
  /** 'pending' until the idle pass reaches it; 'none' with no usable grid. */
  lidar: GreenLidar | 'pending' | 'none'
}

/** A 100 m square at 0.5 m; the biggest greens are under a quarter of that. */
const MAX_CELLS = 40_000

type OutlineRow = { hole_id: string; outline: string; outline_source: string; grid_source: string | null; grid_flagged: boolean }
type GridRow = { grid: string | null; grid_lng0: number | null; grid_lat0: number | null }
type Cached = { courseId: string; outlines: OutlineRow[]; grids: Record<string, GridRow> }

async function loadCourse(courseId: string, holeIds: string[], key: string | null, offline: boolean): Promise<Cached> {
  const saved = key ? await readCache<Cached>(key) : null
  const mine = saved?.courseId === courseId ? saved : null
  if (offline && mine) return mine
  const { data, error } = await getGreenOutlines(supabase, holeIds)
  if (error) {
    if (mine && isNetworkFailure(error)) return mine
    logDiag('green_outlines_failed', { msg: error.message.slice(0, 120) })
    return { courseId, outlines: [], grids: {} }
  }
  // One course at a time: the round's. Grids already read for it stay.
  const out = { courseId, outlines: data, grids: mine?.grids ?? {} }
  if (key) void writeCache(key, out)
  return out
}

async function loadGrid(holeId: string, c: Cached, key: string | null): Promise<GridRow | null> {
  if (c.grids[holeId]) return c.grids[holeId]
  const { data, error } = await getGreenGrid(supabase, holeId)
  if (error || !data) {
    if (error) logDiag('green_grid_read_failed', { hole: holeId, msg: error.message.slice(0, 120) })
    return null
  }
  c.grids[holeId] = data
  if (key) void writeCache(key, c)
  return data
}

function outlineOf(row: OutlineRow): GeoPoint[] | null {
  try {
    const ring = decodePolyline(row.outline)
    return ring.length >= 4 ? ring : null
  } catch {
    return null
  }
}

function prepareLidar(holeId: string, row: GridRow): GreenLidar | 'none' {
  if (!row.grid || row.grid_lng0 == null || row.grid_lat0 == null) return 'none'
  try {
    const bytes = byteaBytes(row.grid)
    // Header bytes 2–5 are the grid's width and height. A green is a few
    // thousand cells; refuse a big one before decoding allocates for it.
    if (bytes.length < 6 || (bytes[2]! | (bytes[3]! << 8)) * (bytes[4]! | (bytes[5]! << 8)) > MAX_CELLS) return 'none'
    const grid = decodeGreenGrid(bytes)
    const field = greenSlopeField(grid)
    return {
      grid,
      field,
      lng0: row.grid_lng0,
      lat0: row.grid_lat0,
      tilt: greenPlaneTilt(grid),
      shape: greenShape(grid),
      hachures: greenHachures(grid, field),
      contours: greenContours(grid),
      slopeUri: writePng(`${holeId}-slope.png`, raster(grid, field, 'slope')),
      heightUri: writePng(`${holeId}-height.png`, raster(grid, field, 'height')),
    }
  } catch (err) {
    logDiag('green_grid_failed', { hole: holeId, msg: (err as Error).message.slice(0, 120) })
    return 'none'
  }
}

/**
 * Greens by green_maps hole id. A loop hole reads its front-nine hole's
 * (holes.loop_of), which is in `holes` too. `firstHoleNumber` orders the idle pass.
 */
export function useGreenMaps(
  courseId: string | undefined,
  holes: { id: string; number: number }[],
  firstHoleNumber: number,
  userId: string | undefined,
  offline: boolean,
): { loaded: boolean; greens: ReadonlyMap<string, PreparedGreen> } {
  const [greens, setGreens] = useState<ReadonlyMap<string, PreparedGreen>>(new Map())
  const [loaded, setLoaded] = useState(false)
  // Read when the course loads: the idle pass starts where the player is then.
  const live = useRef({ holes, firstHoleNumber, offline })
  live.current = { holes, firstHoleNumber, offline }
  const holeKey = holes.map((h) => h.id).join(',')

  useEffect(() => {
    if (!courseId || !holeKey) return
    let cancelled = false
    setLoaded(false)
    const { holes: hs, firstHoleNumber: first, offline: off } = live.current
    const key = userId ? offlineKeys.greenMaps(userId) : null
    void loadCourse(courseId, hs.map((h) => h.id), key, off).then((c) => {
      if (cancelled) return
      const start = new Map<string, PreparedGreen>()
      for (const row of c.outlines) {
        const ring = outlineOf(row)
        if (!ring) continue
        const usable = row.grid_source != null && !row.grid_flagged
        start.set(row.hole_id, {
          ring,
          outlineSource: row.outline_source,
          gridSource: row.grid_source,
          gridNote: row.grid_flagged ? 'The slope survey may not match this green' : null,
          lidar: usable ? 'pending' : 'none',
        })
      }
      setGreens(start)
      setLoaded(true)
      prunePngs(new Set(start.keys()))

      const n = Math.max(1, hs.length)
      const numberOf = new Map(hs.map((h) => [h.id, h.number]))
      const away = (id: string) => ((((numberOf.get(id) ?? n) - first) % n) + n) % n
      const queue = [...start.keys()].filter((id) => start.get(id)!.lidar === 'pending').sort((a, b) => away(a) - away(b))
      const settle = (id: string, lidar: PreparedGreen['lidar'], note?: string) =>
        setGreens((cur) => {
          const g = cur.get(id)
          if (!g) return cur
          const m = new Map(cur)
          m.set(id, { ...g, lidar, gridNote: note ?? g.gridNote })
          return m
        })
      const next = async () => {
        const id = queue.shift()
        if (!id || cancelled) return
        const row = await loadGrid(id, c, key)
        if (cancelled) return
        if (!row) {
          settle(id, 'none', 'Height and slope load with signal')
          return void setTimeout(next, 16)
        }
        InteractionManager.runAfterInteractions(() => {
          if (cancelled) return
          settle(id, prepareLidar(id, row))
          // Let a frame through between greens.
          setTimeout(next, 16)
        })
      }
      void next()
    })
    return () => {
      cancelled = true
    }
  }, [courseId, userId, holeKey])

  return { loaded, greens }
}

// ---------- pictures ----------
// Soft green viridis (#1379 round 5): flat is a soft fairway green, 5% and
// steeper is navy. Height: the research ramp, navy low to pale yellow high,
// stretched over each green's own relief.
const SLOPE_STOPS = ['#EAF2DC', '#a2da37', '#44bf70', '#1e9c89', '#287d8e', '#32648e', '#1C2F52']
const SLOPE_FULL_PCT = 5
const HEIGHT_STOPS = ['#16325c', '#1f6f99', '#3fa79a', '#a9d48b', '#f4ee9c', '#fffbe8']
/** The collar (outer 1 m) is drawn faded. */
const COLLAR_ALPHA = 0.45
/** Pixels per 0.5 m cell; the map and the view smooth the rest. */
const UP = 3

function lut(stops: string[]): Uint8Array {
  const rgb = stops.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const out = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1)
    const k = Math.min(rgb.length - 2, Math.floor(t))
    const f = t - k
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[k]![c]! * (1 - f) + rgb[k + 1]![c]! * f)
  }
  return out
}
const SLOPE_LUT = lut(SLOPE_STOPS)
const HEIGHT_LUT = lut(HEIGHT_STOPS)

/** RGBA, UP pixels per cell, covering the cells' outer edges; bilinear over the inside cells only. */
function raster(g: GreenGrid, field: SlopeField, kind: 'slope' | 'height'): { w: number; h: number; rgba: Uint8Array } {
  const { width: W, height: H, mask, heightsMm } = g
  const value = new Float64Array(W * H)
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue
    lo = Math.min(lo, heightsMm[j]!)
    hi = Math.max(hi, heightsMm[j]!)
  }
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue
    value[j] =
      kind === 'slope'
        ? Math.min(1, (field.slopePct[j]! || 0) / SLOPE_FULL_PCT)
        : hi > lo
          ? (heightsMm[j]! - lo) / (hi - lo)
          : 0.5
  }
  const table = kind === 'slope' ? SLOPE_LUT : HEIGHT_LUT
  const w = W * UP
  const h = H * UP
  const rgba = new Uint8Array(w * h * 4)
  for (let py = 0; py < h; py++) {
    const gy = (py + 0.5) / UP - 0.5
    const r0 = Math.max(0, Math.min(H - 1, Math.floor(gy)))
    const r1 = Math.min(H - 1, r0 + 1)
    const fy = Math.max(0, Math.min(1, gy - r0))
    for (let px = 0; px < w; px++) {
      const gx = (px + 0.5) / UP - 0.5
      const c0 = Math.max(0, Math.min(W - 1, Math.floor(gx)))
      const c1 = Math.min(W - 1, c0 + 1)
      const fx = Math.max(0, Math.min(1, gx - c0))
      let ws = 0
      let vs = 0
      let as = 0
      const add = (j: number, wt: number) => {
        if (!mask[j]) return
        ws += wt
        vs += wt * value[j]!
        as += wt * (field.collar[j] ? COLLAR_ALPHA : 1)
      }
      add(r0 * W + c0, (1 - fx) * (1 - fy))
      add(r0 * W + c1, fx * (1 - fy))
      add(r1 * W + c0, (1 - fx) * fy)
      add(r1 * W + c1, fx * fy)
      if (ws <= 0) continue
      const i = Math.round((vs / ws) * 255) * 3
      const o = (py * w + px) * 4
      rgba[o] = table[i]!
      rgba[o + 1] = table[i + 1]!
      rgba[o + 2] = table[i + 2]!
      rgba[o + 3] = Math.round(as * 255)
    }
  }
  return { w, h, rgba }
}

// In documents, not the cache: Android empties the cache dir when storage
// runs low, mid-round, and the map and view would lose their pictures.
// Pruned to the round's course instead (prunePngs).
const pngDir = () => new Directory(Paths.document, 'green-maps')

function prunePngs(keepHoleIds: Set<string>) {
  try {
    const dir = pngDir()
    if (!dir.exists) return
    for (const f of dir.list()) if (!keepHoleIds.has(f.name.slice(0, 36))) f.delete()
  } catch {
    /* a stale picture only costs disk */
  }
}

/** Rewritten each round: the grid may have changed since the last. */
function writePng(name: string, { w, h, rgba }: { w: number; h: number; rgba: Uint8Array }): string {
  const dir = pngDir()
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  const file = new File(dir, name)
  file.create({ overwrite: true })
  file.write(png(w, h, rgba))
  return file.uri
}

// A PNG with stored (uncompressed) deflate blocks: a green is ~200×200 px, so
// ~160 KB on disk, and nothing to bundle.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function png(w: number, h: number, rgba: Uint8Array): Uint8Array {
  const rowLen = w * 4 + 1
  const raw = new Uint8Array(rowLen * h)
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * rowLen + 1)
  const blocks = Math.max(1, Math.ceil(raw.length / 65535))
  const zlen = 2 + raw.length + blocks * 5 + 4
  const out = new Uint8Array(8 + 25 + 12 + zlen + 12)
  const view = new DataView(out.buffer)
  out.set([137, 80, 78, 71, 13, 10, 26, 10])
  let p = 8
  const chunk = (type: string, len: number, fill: (at: number) => void) => {
    view.setUint32(p, len)
    for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i)
    fill(p + 8)
    let c = 0xffffffff
    for (let i = p + 4; i < p + 8 + len; i++) c = CRC[(c ^ out[i]!) & 255]! ^ (c >>> 8)
    view.setUint32(p + 8 + len, (c ^ 0xffffffff) >>> 0)
    p += 12 + len
  }
  chunk('IHDR', 13, (at) => {
    view.setUint32(at, w)
    view.setUint32(at + 4, h)
    out.set([8, 6, 0, 0, 0], at + 8)
  })
  chunk('IDAT', zlen, (at) => {
    out[at] = 0x78
    out[at + 1] = 0x01
    let q = at + 2
    for (let b = 0; b < blocks; b++) {
      const len = Math.min(65535, raw.length - b * 65535)
      out[q] = b === blocks - 1 ? 1 : 0
      view.setUint16(q + 1, len, true)
      view.setUint16(q + 3, ~len & 0xffff, true)
      out.set(raw.subarray(b * 65535, b * 65535 + len), q + 5)
      q += 5 + len
    }
    let a = 1
    let s = 0
    for (let i = 0; i < raw.length; i++) {
      a = (a + raw[i]!) % 65521
      s = (s + a) % 65521
    }
    view.setUint32(q, ((s << 16) | a) >>> 0)
  })
  chunk('IEND', 0, () => undefined)
  return out
}
