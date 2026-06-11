export interface LatLng {
  lat: number
  lng: number
}

/**
 * `PLACE_BALL` — ball draggable, tap places ball, no aim interaction.
 * `SET_AIM`    — ball locked, long-press drops aim, camera rotates so
 *                play direction is up.
 * `PIN`        — pin placement modality (orthogonal to the shot flow).
 */
export type HoleMapPhase = 'PLACE_BALL' | 'SET_AIM' | 'PIN'
