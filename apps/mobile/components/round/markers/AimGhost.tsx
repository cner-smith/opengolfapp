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
  // Whether the SET_AIM exit is a real shot commit (roundState →
  // SHOT_DETAIL / PUTTING) vs a "Re-place ball" backout (roundState →
  // bare PLACE_BALL). The HoleMap `phase` collapses both to PLACE_BALL
  // (HoleMapPhase has no SHOT_DETAIL/PUTTING), so the string alone can't
  // tell a committed shot from an abandoned aim — promoting on every exit
  // would re-introduce the duplicate-ghost bug (commit 4670661), dropping
  // on every exit means no ghost ever records. This flag, derived from the
  // raw roundState in LiveRoundSession, is the authoritative discriminator.
  aimCommitted: boolean
  // Explicit hole-change signal. The prior "previousShotsLen === 0"
  // heuristic worked when HoleMap remounted per hole, but in the
  // resident-MapView world (post-#264) it fires during the gap between
  // ghost promotion (on phase exit SET_AIM) and shot persistence
  // (which bumps previousShotsLen), wiping the ghost that just got
  // captured.
  holeNumber: number
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
  aimCommitted,
  holeNumber,
}: AimGhostHookOpts): AimGhostHookResult {
  const [aimGhosts, setAimGhosts] = useState<
    { ball: LatLng; aim: LatLng }[]
  >([])
  const lastAimSnapshotRef = useRef<{ ball: LatLng; aim: LatLng } | null>(null)
  const isAimPhase = phase === 'SET_AIM'

  // While in SET_AIM, snapshot the current ball + aim pair so we can
  // promote it to a ghost the moment the shot is committed.
  useEffect(() => {
    if (isAimPhase && ball && aim) {
      lastAimSnapshotRef.current = { ball, aim }
    }
  }, [isAimPhase, ball?.lat, ball?.lng, aim?.lat, aim?.lng])

  // Mirror the latest commit signal + live aim into refs so the
  // phase-gated effect below reads current values without re-running on
  // every aim drag (which would fire mid-SET_AIM, before any exit).
  const aimCommittedRef = useRef(aimCommitted)
  aimCommittedRef.current = aimCommitted
  const aimRef = useRef(aim)
  aimRef.current = aim

  const ghostPhaseRef = useRef<HoleMapPhase>(phase)
  useEffect(() => {
    // Promote only on a COMMITTED exit. Both a real shot commit and a
    // "Re-place ball" backout leave SET_AIM for HoleMap-phase PLACE_BALL
    // (the phase enum collapses SHOT_DETAIL/PUTTING into PLACE_BALL), so the
    // phase string can't distinguish them — that collision is why promotion
    // was dead. `aimCommitted` (from the raw roundState) does distinguish:
    //   - commit (confirmAim / on-green) → aimCommitted true, aim still set
    //   - skip aim                       → aimCommitted true, aim cleared (null)
    //   - re-place ball                  → aimCommitted false
    // Promote iff committed AND the aim survived the exit (excludes skip),
    // else drop. Reading the live `aim` here — rather than aimTouched, whose
    // reset is an async effect — avoids any cross-component effect-ordering
    // race, so a re-place / skip can never wrongly promote a duplicate.
    if (ghostPhaseRef.current === 'SET_AIM' && phase !== 'SET_AIM') {
      const snap = lastAimSnapshotRef.current
      if (snap && aimCommittedRef.current && aimRef.current) {
        setAimGhosts((prev) => [...prev, snap])
      }
      lastAimSnapshotRef.current = null
    }
    ghostPhaseRef.current = phase
  }, [phase])

  // Clear ghosts on hole change. The functional setter bails on an
  // already-empty array so the initial mount doesn't enqueue a no-op
  // state update.
  useEffect(() => {
    setAimGhosts((prev) => (prev.length === 0 ? prev : []))
  }, [holeNumber])

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
