import type { GeoPoint } from '../shot-dispersion-geo'
import type { GreenGrid } from './codec'
import { clipGreenGrid, MIN_OUTLINE_COVERAGE, outlineCoverage } from './frame'
import { greenPlaneTilt, type PlaneTilt } from './slope'

export interface GreenLayers {
  /** The slope or height picture. */
  colour: boolean
  /** The downhill marks (Slope). */
  hachures: boolean
  /** Height contours. */
  contours: boolean
  /** The low/high tags (Height). */
  tags: boolean
  paceLines: boolean
  outline: boolean
  pin: boolean
  /** Pin to the front and side edges, while the flag is held. */
  rails: boolean
  /** The pin sheet's margin bars. */
  bars: boolean
}

/**
 * Which green layers show, on the green view or on the map (#1385). While the
 * flag is held only the outline, the pin, the rails and the bars stay, so the
 * pin reads against the edges; release gives back what the toggles say.
 * `view` is what this surface is set to; `lidar` is whether a height grid is
 * ready; `paceLines` is the pace-lines toggle.
 */
export function greenLayersVisible(i: { held: boolean; view: 'plain' | 'slope' | 'height'; lidar: boolean; paceLines: boolean }): GreenLayers {
  const picture = !i.held && i.lidar
  return {
    colour: picture && i.view !== 'plain',
    hachures: picture && i.view === 'slope',
    contours: picture && i.view === 'height',
    tags: picture && i.view === 'height',
    paceLines: !i.held && i.paceLines,
    outline: true,
    pin: true,
    rails: i.held,
    bars: true,
  }
}

/** Overall tilt past this is almost never a real green (#1503: 11 of 12 graded steep greens were bad outlines). */
export const HIDE_TILT_PCT = 10

/**
 * Why a green's heat map stays hidden (#1503), or null to show it. The outline
 * still shows, so a player can fix it. `tiltPct` is greenPlaneTilt over the grid
 * cut to the outline shown; `outlineFlagReason` is green_maps.outline_flag_reason
 * (a comma list from the outliner).
 */
export function heatMapHideReason(tiltPct: number | null, outlineFlagReason: string | null): string | null {
  if (outlineFlagReason?.split(',').some((r) => r.trim() === 'area_large')) return AREA_REASON
  if (tiltPct != null && tiltPct > HIDE_TILT_PCT) return `tilts ${tiltPct.toFixed(1)}%, steeper than a green`
  return null
}

const AREA_REASON = 'outline far bigger than a green'

/**
 * heatMapHideReason for a player's own outline (#1504): our rules judged our
 * outline, so they run again on theirs; any other flag (a lidar date, an
 * unexplained one) still hides. `tiltPct` is over the grid cut to their outline.
 * `gridFlagReason` is green_maps.grid_flag_reason, where the loader stores
 * heatMapHideReason's sentence (not outline_flag_reason's comma list).
 */
export function playerOutlineHideReason(gridFlagged: boolean, gridFlagReason: string | null, tiltPct: number | null): string | null {
  if (gridFlagged && gridFlagReason !== AREA_REASON && !gridFlagReason?.startsWith('tilts ')) return gridFlagReason ?? 'flagged'
  return heatMapHideReason(tiltPct, null)
}

/**
 * A player's own outline (#1504) over the green's survey, as both apps draw it:
 * the survey cut to their outline with its tilt, or why it stays hidden.
 * `not_reached`: the survey covers under MIN_OUTLINE_COVERAGE of the outline;
 * `suspect`: playerOutlineHideReason says hide. The apps word each.
 */
export function playerOutlineSurvey(
  full: GreenGrid,
  lng0: number,
  lat0: number,
  ring: GeoPoint[],
  gridFlagged: boolean,
  gridFlagReason: string | null,
): { grid: GreenGrid; tilt: PlaneTilt | null } | { hidden: 'not_reached' | 'suspect' } {
  if (outlineCoverage(full, lng0, lat0, ring) < MIN_OUTLINE_COVERAGE) return { hidden: 'not_reached' }
  const grid = clipGreenGrid(full, lng0, lat0, ring)
  const tilt = greenPlaneTilt(grid)
  if (playerOutlineHideReason(gridFlagged, gridFlagReason, tilt?.tiltPct ?? null)) return { hidden: 'suspect' }
  return { grid, tilt }
}
