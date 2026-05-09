import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import type { HoleMapPhase, LatLng } from '../HoleMap.types'
import { Marker } from './Marker'

function toCoord(l: LatLng): [number, number] {
  return [l.lng, l.lat]
}

interface AimGhostHookOpts {
  ball: LatLng | null | undefined
  aim: LatLng | null | undefined
  phase: HoleMapPhase
  previousShotsLen: number
}

interface AimGhostHookResult {
  aimGhosts: { ball: LatLng; aim: LatLng }[]
  aimGhostFeatures: GeoJSON.FeatureCollection | null
}

// Aim ghosts: prior shots' aim point + ball-start, retained as faded
// markers + dotted lines so the player can see intended direction vs
// actual result across the whole hole. Captured locally in the map so
// the parent doesn't have to thread historical aim coords through.
export function useAimGhosts({
  ball,
  aim,
  phase,
  previousShotsLen,
}: AimGhostHookOpts): AimGhostHookResult {
  const [aimGhosts, setAimGhosts] = useState<
    { ball: LatLng; aim: LatLng }[]
  >([])
  const lastAimSnapshotRef = useRef<{ ball: LatLng; aim: LatLng } | null>(null)
  const isAimPhase = phase === 'SET_AIM'

  // While in SET_AIM, snapshot the current ball + aim pair so we can
  // promote it to a ghost the moment the phase exits SET_AIM (i.e. shot
  // was saved or aim was abandoned for ball placement again).
  useEffect(() => {
    if (isAimPhase && ball && aim) {
      lastAimSnapshotRef.current = { ball, aim }
    }
  }, [isAimPhase, ball?.lat, ball?.lng, aim?.lat, aim?.lng])

  const ghostPhaseRef = useRef<HoleMapPhase>(phase)
  useEffect(() => {
    if (ghostPhaseRef.current === 'SET_AIM' && phase !== 'SET_AIM') {
      const snap = lastAimSnapshotRef.current
      if (snap) {
        setAimGhosts((prev) => [...prev, snap])
        lastAimSnapshotRef.current = null
      }
    }
    ghostPhaseRef.current = phase
  }, [phase])

  // Hole change is signalled by previousShots resetting to empty (the
  // parent re-mounts a new hole with no prior shot starts). Clear ghosts
  // so they don't bleed across holes. Guarded on aimGhosts.length > 0
  // so the initial mount (where prevShotsLen and aimGhosts.length are
  // both 0) doesn't schedule a no-op state update.
  const ghostCount = aimGhosts.length
  useEffect(() => {
    if (previousShotsLen === 0 && ghostCount > 0) {
      setAimGhosts([])
    }
  }, [previousShotsLen, ghostCount])

  const aimGhostFeatures = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (aimGhosts.length === 0) return null
    return {
      type: 'FeatureCollection' as const,
      features: aimGhosts.map((g, i) => ({
        type: 'Feature' as const,
        properties: { id: i },
        geometry: {
          type: 'LineString' as const,
          coordinates: [toCoord(g.ball), toCoord(g.aim)],
        },
      })),
    }
  }, [aimGhosts])

  return { aimGhosts, aimGhostFeatures }
}

interface AimGhostLayersProps {
  aimGhosts: { ball: LatLng; aim: LatLng }[]
  aimGhostFeatures: GeoJSON.FeatureCollection | null
  styleLoaded: boolean
  isPinMode: boolean
}

// Renders the dotted breadcrumb between past ball→aim pairs and a small
// faded aim marker at each historical aim point. Mounted as a child of
// MapView; both the ShapeSource and the PointAnnotations must render at
// the map level, so the layers are factored out together.
export function AimGhostLayers({
  aimGhosts,
  aimGhostFeatures,
  styleLoaded,
  isPinMode,
}: AimGhostLayersProps) {
  if (isPinMode) return null
  return (
    <>
      {styleLoaded && (
        <Mapbox.ShapeSource
          id="aimGhostsLine"
          shape={aimGhostFeatures ?? { type: 'FeatureCollection', features: [] }}
        >
          <Mapbox.LineLayer
            id="aimGhostsLineLayer"
            style={{
              lineColor: '#A66A1F',
              lineWidth: 1.2,
              lineDasharray: [3, 3],
              lineOpacity: 0.4,
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {aimGhosts.map((g, i) => (
        <Mapbox.PointAnnotation
          key={`aim-ghost-${i}`}
          id={`aim-ghost-${i}`}
          coordinate={toCoord(g.aim)}
        >
          <View style={{ opacity: 0.4 }}>
            <Marker color="#A66A1F" border="#FBF8F1" size={9} />
          </View>
        </Mapbox.PointAnnotation>
      ))}
    </>
  )
}
