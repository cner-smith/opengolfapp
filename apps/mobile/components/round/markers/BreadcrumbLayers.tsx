import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { LatLng, PlateSide } from '../HoleMap.types'
import { TYPE } from '../../../lib/typography'
import { P } from '../../paper/tokens'
import { MARKER_PRESS_RETENTION } from './Callouts'

// Pixel nudge for the OB disc when a re-hit covers it, matching web's
// [-20, 0] in useMapLayers.ts. `circle-translate` / `text-translate` are
// paint properties and are NOT data-driven, which is why the shifted and
// unshifted cases need separate layers rather than an expression (#839).
const OB_NUDGE: [number, number] = [-20, 0]

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

interface BreadcrumbLayersProps {
  previousShots: LatLng[]
  previousShotsLine: GeoJSON.Feature | null
  /** Each leg's distance at its midpoint (the live round; the past round passes none). */
  segments: { id: string; midpoint: LatLng; yards: number }[]
  styleLoaded: boolean
  isPinMode: boolean
  toDisplay: (yards: number) => string
  /**
   * Out-of-bounds flag per shot, index-aligned with `previousShots` (#839).
   * Optional/undefined-safe so callers that haven't threaded OB data yet
   * (there are none left, but keep this defensive) still render plain
   * waypoints.
   */
  obs?: boolean[]
  /** Shot number per `previousShots` entry. */
  numbers: number[]
  /** Plate side per entry; unset = up and to the right. */
  plates?: (PlateSide | undefined)[]
  /** The past round's selected leg, drawn solid. */
  segment?: GeoJSON.Feature | null
  onSelect?: (i: number) => void
}

// The paper breadcrumbs (#611 §19.3), live and past alike (#1209): a dotted
// cream trail through the shot starts, a numbered crumb at each, and the
// leg distances the live round passes in `segments`. The crumbs are
// MarkerViews (see PaperCrumb). ponytail: one native view per crumb; a hole
// rarely has more than six. If a long hole with re-hits stutters on a phone,
// draw the dots as a CircleLayer and keep views for the plates only.
export function BreadcrumbLayers({
  previousShots,
  previousShotsLine,
  segments,
  styleLoaded,
  isPinMode,
  toDisplay,
  obs,
  numbers,
  plates,
  segment,
  onSelect,
}: BreadcrumbLayersProps) {
  const waypointFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const coords = previousShots.map(toCoord)
    // Mirrors web's coincidence guard (useMapLayers.ts): the OB disc only
    // gets nudged aside when something else really is on the same
    // coordinate — a lone OB shot stays dead centre in its ring. Without
    // this the platforms disagree in exactly the case the guard exists for,
    // e.g. after tagging OB but before the re-hit is logged.
    const shareCount = new Map<string, number>()
    for (const c of coords) {
      const k = `${c[0]},${c[1]}`
      shareCount.set(k, (shareCount.get(k) ?? 0) + 1)
    }
    return {
      type: 'FeatureCollection',
      features: previousShots.map((_p, i) => {
        const c = coords[i]!
        const ob = obs?.[i] === true
        return {
          type: 'Feature',
          properties: {
            n: i + 1,
            ob,
            obShifted: ob && (shareCount.get(`${c[0]},${c[1]}`) ?? 0) > 1,
          },
          geometry: { type: 'Point', coordinates: c },
        }
      }),
    }
  }, [previousShots, obs])

  const segmentFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      // A leg under 10 yd puts its midpoint label on the markers themselves
      // ("0 yd" over shot 1 right after Confirm aim, "2 yd" on the green).
      features: segments.filter((s) => s.yards >= 10).map((s) => ({
        type: 'Feature',
        properties: { label: toDisplay(s.yards) },
        geometry: { type: 'Point', coordinates: toCoord(s.midpoint) },
      })),
    }),
    [segments, toDisplay],
  )

  if (isPinMode) return null
  // ShapeSource / LineLayer / SymbolLayer all crash native with
  // "Source X is not in style" if mounted before the satellite style
  // finishes loading. Gate every layer behind this flag.
  if (!styleLoaded) return null

  const features = waypointFeatures.features
  return (
    <>
      <Mapbox.ShapeSource
        id="prevShotsLine"
        shape={previousShotsLine ?? { type: 'FeatureCollection', features: [] }}
      >
        {/* Round-capped near-zero dashes read as dots (dasharray is in
            line widths). */}
        <Mapbox.LineLayer
          id="prevShotsLineLayer"
          style={{ lineColor: P.raised, lineWidth: 1.5, lineDasharray: [0.01, 2.7], lineCap: 'round' }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource
        id="pastSegment"
        shape={segment ?? { type: 'FeatureCollection', features: [] }}
      >
        <Mapbox.LineLayer
          id="pastSegmentCasing"
          style={{ lineColor: P.ink, lineWidth: 4, lineOpacity: 0.35, lineCap: 'round' }}
        />
        <Mapbox.LineLayer
          id="pastSegmentLine"
          style={{ lineColor: P.raised, lineWidth: 2, lineCap: 'round' }}
        />
      </Mapbox.ShapeSource>
      {/* OB badge ring (#839): the re-hit starts on the OB shot's spot, so
          the ring peeks out around whichever crumb ends up on top. */}
      <Mapbox.ShapeSource id="prevShotsWaypoints" shape={waypointFeatures}>
        <Mapbox.CircleLayer
          id="prevShotsObRing"
          filter={['==', ['get', 'ob'], true]}
          style={{
            circleRadius: 15,
            circleColor: 'rgba(0,0,0,0)',
            circleStrokeColor: P.neg,
            circleStrokeWidth: 3,
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="prevShotsSegments" shape={segmentFeatures}>
        <Mapbox.SymbolLayer
          id="prevShotsSegmentLabel"
          style={{
            textField: ['get', 'label'],
            textSize: 11,
            textColor: '#F2EEE5',
            textHaloColor: 'rgba(28,33,28,0.85)',
            textHaloWidth: 1.5,
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
      </Mapbox.ShapeSource>
      {features.map((f, i) => (
        <PaperCrumb
          key={`crumb-${i}`}
          id={`crumb-${i}`}
          coordinate={f.geometry.coordinates as [number, number]}
          n={numbers[i] ?? i + 1}
          plate={plates?.[i]}
          ob={f.properties?.ob === true}
          shifted={f.properties?.obShifted === true}
          onPress={onSelect ? () => onSelect(i) : undefined}
        />
      ))}
    </>
  )
}

// Unselected paper crumb (§19.3): a 10 dp ink dot on the spot and the Fraunces-it
// number on a small plate out to one side on a flat leader (#1208): up and
// to the right unless ShotCallout fans it to another side clear of its
// neighbours, so stacked shots near the green don't cover each other's spots.
// @oga/core's plate-fan boxes mirror these positions; change both together. MarkerView (not a GL symbol) because the
// numeral is Fraunces, which the satellite style's glyph server doesn't have.
// An OB shot keeps its brick dot and plate (#839) and the -20 nudge when a re-hit sits
// on it. The 44 dp box is the tap target when tappable; otherwise the marker
// passes touches through to the map.
function PaperCrumb({
  id,
  coordinate,
  n,
  ob,
  shifted,
  plate = 'ur',
  onPress,
}: {
  id: string
  coordinate: [number, number]
  n: number
  ob: boolean
  shifted: boolean
  plate?: PlateSide
  onPress?: () => void
}) {
  const left = plate === 'ul' || plate === 'dl'
  const down = plate === 'dr' || plate === 'dl'
  return (
    <Mapbox.MarkerView
      id={id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap
      // Off, a crumb near the live round's GPS puck is hidden.
      allowOverlapWithPuck
      pointerEvents={onPress ? 'auto' : 'none'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Shot ${n}`}
        disabled={!onPress}
        onPress={onPress}
        pressRetentionOffset={MARKER_PRESS_RETENTION}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: shifted ? OB_NUDGE[0] : 0 }],
        }}
      >
        <View style={{ width: 44, height: 44 }}>
          <View
            style={{
              position: 'absolute',
              left: 17,
              top: 17,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: ob ? P.neg : P.ink,
              borderWidth: 2,
              borderColor: P.raised,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: left ? 8.15 : 34.35,
              top: down ? 18.7 : 9.3,
              width: 1.5,
              height: 16,
              backgroundColor: P.raised,
              transform: [{ rotate: left === down ? '70deg' : '-70deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              ...(left ? { right: 42 } : { left: 42 }),
              top: down ? 23 : 1,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 5,
              borderRadius: 3,
              backgroundColor: ob ? P.neg : P.raised,
              borderWidth: 1,
              borderColor: P.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              allowFontScaling={false}
              style={[TYPE.serif, { fontSize: 15, lineHeight: 18, color: ob ? P.raised : P.ink }]}
            >
              {n}
            </Text>
          </View>
        </View>
      </Pressable>
    </Mapbox.MarkerView>
  )
}

// The past round's selected breadcrumb (#611 §19.3): a 26 dp ink disc with a
// cream numeral inside the live ball's 44 dp grab disc.
export function SelectedCrumb({ n }: { n: number | null }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(28,33,28,0.28)',
        borderWidth: 1.5,
        borderColor: 'rgba(251,248,241,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: P.ink,
          borderWidth: 2,
          borderColor: P.raised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text allowFontScaling={false} style={[TYPE.serif, { fontSize: 15, lineHeight: 18, color: P.raised }]}>
          {n ?? ''}
        </Text>
      </View>
    </View>
  )
}
