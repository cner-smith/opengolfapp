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
  if (outlineFlagReason?.split(',').some((r) => r.trim() === 'area_large')) return 'outline far bigger than a green'
  if (tiltPct != null && tiltPct > HIDE_TILT_PCT) return `tilts ${tiltPct.toFixed(1)}%, steeper than a green`
  return null
}
