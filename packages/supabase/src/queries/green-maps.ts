import type { OgaSupabaseClient } from '../client'

// green_maps (0067). Outlines are small and come per course; the height grid
// (≤ 16 KB) is read for one hole at a time when its green is shown.

/** The course's green outlines; `grid_source` says whether a height grid exists. */
export function getGreenOutlines(client: OgaSupabaseClient, holeIds: string[]) {
  return client
    .from('green_maps')
    .select('hole_id, outline, outline_source, grid_source, grid_flagged')
    .in('hole_id', holeIds)
}

export function getGreenGrid(client: OgaSupabaseClient, holeId: string) {
  return client
    .from('green_maps')
    .select('grid, grid_lng0, grid_lat0')
    .eq('hole_id', holeId)
    .maybeSingle()
}

/** green_maps.grid's CHECK (octet_length(grid) <= 16384). */
const MAX_GRID_BYTES = 16_384

/** PostgREST returns a bytea as "\x" + hex digits. */
export function byteaBytes(s: string): Uint8Array {
  if (!s.startsWith('\\x')) throw new Error('Not a hex bytea')
  const hex = s.slice(2)
  if (hex.length % 2) throw new Error('A hex bytea has an odd digit count')
  if (hex.length / 2 > MAX_GRID_BYTES) throw new Error(`A grid over ${MAX_GRID_BYTES} bytes`)
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error('A hex bytea has a non-hex digit')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16)
  return out
}
