import { useMemo } from 'react'
import { Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { coneRingGeoJSON, dispersionRodsGeoJSON, scatterGeoJSON, type AimRelativeDispersion } from '@oga/core'
import type { LatLng } from '../HoleMap.types'
import { useUnits } from '../../../hooks/useUnits'
import { TYPE } from '../../../lib/typography'
import { HardShadow } from '../../paper/Paper'
import { P } from '../../paper/tokens'

// The ring, bias line and rods need this many shots to mean anything (§8).
export const RING_MIN_SHOTS = 10
const MAX_DOTS = 40

export interface PatternOverlay {
  /** Aim-relative landings, most recent first. */
  points: { alongYards: number; perpYards: number }[]
  /** Null for a sparse club (< 5 usable shots): dots only, dimmed. */
  dispersion: AimRelativeDispersion | null
}

// Shot-pattern overlay "B" + checkered rods (#611 LOCKED-SPEC §8): the
// selected club's recent landings, its 68% ring on the mean, the aim→mean
// bias line, and two ground-space rods stating the true spread.
export function DispersionLayers({ ball, aim, pattern }: { ball: LatLng; aim: LatLng; pattern: PatternOverlay }) {
  const { toDisplay } = useUnits()
  const dots = useMemo(() => {
    const fc = scatterGeoJSON(ball, aim, pattern.points.slice(0, MAX_DOTS))
    return fc.features.length > 0 ? fc : null
  }, [ball, aim, pattern.points])

  const ring = useMemo(() => {
    const d = pattern.dispersion
    if (!d || d.sampleSize < RING_MIN_SHOTS) return null
    const ring68 = coneRingGeoJSON(ball, aim, d.along68, d.perp68, {
      alongMeanYards: d.alongMean,
      perpMeanYards: d.perpMean,
    })
    const mean = scatterGeoJSON(ball, aim, [{ alongYards: d.alongMean, perpYards: d.perpMean }]).features[0]
    const rods = dispersionRodsGeoJSON(ball, aim, d)
    if (!ring68 || !mean || !rods) return null
    const bias = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [[aim.lng, aim.lat], mean.geometry.coordinates] },
    }
    return { ring68, mean, bias, rods, along68: d.along68, perp68: d.perp68 }
  }, [ball, aim, pattern.dispersion])

  const n = dots?.features.length ?? 0
  const dim = pattern.dispersion ? 1 : 0.5
  return (
    <>
      {dots && (
        <Mapbox.ShapeSource id="patternDots" shape={dots}>
          <Mapbox.CircleLayer
            id="patternDotsLayer"
            style={{
              circleRadius: n <= 20 ? 3.5 : 3,
              circleColor: P.raised,
              circleOpacity: (n <= 20 ? 0.75 : 0.5) * dim,
              circleStrokeWidth: 1,
              circleStrokeColor: P.tagShadow,
              circleStrokeOpacity: dim,
            }}
          />
        </Mapbox.ShapeSource>
      )}
      {ring && (
        <>
          <Mapbox.ShapeSource id="patternRing" shape={ring.ring68}>
            <Mapbox.FillLayer id="patternRingFill" style={{ fillColor: P.raised, fillOpacity: 0.14 }} />
            <Mapbox.LineLayer id="patternRingHalo" style={{ lineColor: P.ink, lineWidth: 4, lineOpacity: 0.35 }} />
            <Mapbox.LineLayer id="patternRingLine" style={{ lineColor: P.raised, lineWidth: 2, lineOpacity: 0.95 }} />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource id="patternBias" shape={ring.bias}>
            <Mapbox.LineLayer id="patternBiasLine" style={{ lineColor: P.raised, lineWidth: 2, lineDasharray: [1, 1.5] }} />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource id="patternMean" shape={ring.mean}>
            <Mapbox.CircleLayer
              id="patternMeanDot"
              style={{ circleRadius: 4, circleColor: P.raised, circleStrokeWidth: 1.5, circleStrokeColor: P.ink }}
            />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource id="patternRods" shape={ring.rods.lines}>
            <Mapbox.LineLayer
              id="patternRodCasing"
              filter={['==', ['get', 'k'], 'rod']}
              style={{ lineColor: P.ink, lineWidth: 6 }}
            />
            <Mapbox.LineLayer
              id="patternRodChecks"
              filter={['==', ['get', 'k'], 'check']}
              style={{ lineColor: ['match', ['get', 'c'], 1, P.ink, P.raised], lineWidth: 4 }}
            />
            <Mapbox.LineLayer
              id="patternRodTicks"
              filter={['==', ['get', 'k'], 'tick']}
              style={{ lineColor: P.ink, lineWidth: 3 }}
            />
          </Mapbox.ShapeSource>
          <RodTag id="patternLengthTag" at={ring.rods.lengthTag} display={toDisplay(ring.along68)} />
          <RodTag id="patternWidthTag" at={ring.rods.widthTag} display={toDisplay(ring.perp68)} />
        </>
      )}
    </>
  )
}

// "±21 yd", centred on its rod and screen-upright (§8).
function RodTag({ id, at, display }: { id: string; at: LatLng; display: string }) {
  const [num = '', unit = ''] = display.split(' ')
  return (
    <Mapbox.MarkerView id={id} coordinate={[at.lng, at.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
      {/* Room for the hard shadow so the MarkerView doesn't clip it. */}
      <View style={{ paddingRight: 2, paddingBottom: 2 }}>
        <HardShadow>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              backgroundColor: P.raised,
              borderWidth: 1,
              borderColor: P.ink,
              borderRadius: 2,
              paddingHorizontal: 5,
              paddingBottom: 1,
            }}
          >
            <Text style={[TYPE.serif, { fontSize: 15, lineHeight: 20, color: P.ink }]}>±{num}</Text>
            <Text style={[TYPE.kicker, { fontSize: 11, color: P.ink }]}> {unit}</Text>
          </View>
        </HardShadow>
      </View>
    </Mapbox.MarkerView>
  )
}
