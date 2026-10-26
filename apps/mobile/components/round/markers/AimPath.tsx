import { useMemo } from 'react'
import Mapbox from '@rnmapbox/maps'
import { bearingDegrees, destinationYards } from '@oga/core'
import { distanceYards } from '../../../lib/maps'
import type { LatLng } from '../HoleMap.types'

// Half-length (yards) of the perpendicular crosshair tick drawn at the aim
// — a short geo segment across the aim line so the draggable midpoint
// handle reads as a crosshair (refs ux-09). Decorative; the transparent
// PointAnnotation owns the actual drag.
const CROSSHAIR_HALF_YARDS = 7

// How far past the aim the dotted aim-direction reference extends. Large
// enough to run off-screen at the live-round zoom so it reads as a line
// continuing "to infinity" in the direction you're aiming.
const AIM_EXTENSION_YARDS = 250

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

function line(coordinates: [number, number][]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates },
  }
}

// The aim's lines: the dotted direction ray, the solid ball → aim → pin path
// and the crosshair tick at the aim.
export function AimPath({ ball, aim, pin }: { ball: LatLng; aim: LatLng; pin: LatLng | null }) {
  // Bearing of ball → aim; null with the aim ~on the ball, where it's
  // meaningless — bearingDegrees(p, p) returns 0 (finite, not NaN), so a
  // finite-check alone wouldn't catch it. Below ~1 yd matches arcGeoJSON's
  // radius floor.
  const heading = useMemo(() => {
    if (distanceYards(ball, aim) < 1) return null
    const h = bearingDegrees(ball.lat, ball.lng, aim.lat, aim.lng)
    return Number.isFinite(h) ? h : null
  }, [ball.lat, ball.lng, aim.lat, aim.lng])

  // Aim direction extended "to infinity" (dotted): a ray from the aim
  // continuing along the ball→aim bearing, past the target — the straight
  // line your shot points down, which is where the dispersion arc points.
  // In a bent shot it diverges from the solid ball→aim→pin path.
  const referenceLine = useMemo(
    () => (heading == null ? null : line([toCoord(aim), toCoord(destinationYards(aim, heading, AIM_EXTENSION_YARDS))])),
    [heading, aim.lat, aim.lng],
  )

  // Solid aim path origin → aim → pin (bends at the aim as it's dragged).
  // Falls back to ball→aim on no-pin holes.
  const aimLine = useMemo(
    () => line(pin ? [toCoord(ball), toCoord(aim), toCoord(pin)] : [toCoord(ball), toCoord(aim)]),
    [ball, aim, pin],
  )

  // Perpendicular crosshair tick at the aim: rotates with the line.
  // destinationYards/bearingDegrees share the arc's great-circle model.
  const aimCrosshair = useMemo(
    () =>
      heading == null
        ? null
        : line([
            toCoord(destinationYards(aim, heading - 90, CROSSHAIR_HALF_YARDS)),
            toCoord(destinationYards(aim, heading + 90, CROSSHAIR_HALF_YARDS)),
          ]),
    [heading, aim.lat, aim.lng],
  )

  return (
    <>
      {/* Dotted cream hairline — the neutral guide the solid aim path bends
          off. Drawn first so everything else reads on top. */}
      {referenceLine && (
        <Mapbox.ShapeSource id="referenceLine" shape={referenceLine}>
          <Mapbox.LineLayer
            id="referenceLineLayer"
            style={{
              lineColor: '#FBF8F1',
              lineWidth: 1.5,
              lineDasharray: [1, 3],
              lineOpacity: 0.5,
              lineCap: 'round',
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {/* Solid aim path (white — reads against the green satellite where
          amber didn't). */}
      <Mapbox.ShapeSource id="aimLine" shape={aimLine}>
        <Mapbox.LineLayer
          id="aimLineLayer"
          style={{
            lineColor: '#FBF8F1',
            lineWidth: 2,
            lineOpacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </Mapbox.ShapeSource>

      {/* Crosshair tick — drawn over the aim line so the two cross. The
          transparent aim annotation owns the drag. */}
      {aimCrosshair && (
        <Mapbox.ShapeSource id="aimCrosshair" shape={aimCrosshair}>
          <Mapbox.LineLayer
            id="aimCrosshairLayer"
            style={{
              lineColor: '#FBF8F1',
              lineWidth: 2,
              lineOpacity: 0.95,
              lineCap: 'round',
            }}
          />
        </Mapbox.ShapeSource>
      )}
    </>
  )
}
