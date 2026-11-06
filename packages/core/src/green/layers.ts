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
