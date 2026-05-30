import { Pressable, Text, View } from 'react-native'
import type { Database } from '@oga/supabase'
import {
  ScorecardPreview,
} from '../Scorecard'
import { KICKER, type RoundState } from './types'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface HoleStripProps {
  pinPlacementOpen: boolean
  teePlacementOpen: boolean
  roundState: RoundState
  ball: { lat: number; lng: number } | null
  aim: { lat: number; lng: number } | null
  saving: boolean
  roundPin: { lat: number; lng: number } | null
  tee: { lat: number; lng: number } | null
  nearPin: boolean
  /**
   * True when raw GPS is available, even if `ball` hasn't been set yet.
   * Lets "Mark ball here" stay enabled — `markBallHere` falls back to
   * the raw GPS position when no marker has been dropped.
   */
  hasGps: boolean
  totalShotsThisHole: number
  holeNumber: number
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  onCancelPinPlacement: () => void
  onCancelTeePlacement: () => void
  onClearRoundPin: () => void
  onConfirmAim: () => void
  onRePlaceBall: () => void
  onSkipAim: () => void
  onMarkBallHere: () => void
  onOpenPinPlacement: () => void
  onOpenTeePlacement: () => void
  onFinishHole: () => void
  onPrev: () => void
  onNext: () => void
  onOpenScorecard: () => void
}

export function HoleStrip({
  pinPlacementOpen,
  teePlacementOpen,
  roundState,
  ball,
  aim,
  saving,
  roundPin,
  tee,
  nearPin,
  hasGps,
  totalShotsThisHole,
  holeNumber,
  holes,
  holeScores,
  onCancelPinPlacement,
  onCancelTeePlacement,
  onClearRoundPin,
  onConfirmAim,
  onRePlaceBall,
  onSkipAim,
  onMarkBallHere,
  onOpenPinPlacement,
  onOpenTeePlacement,
  onFinishHole,
  onPrev,
  onNext,
  onOpenScorecard,
}: HoleStripProps) {
  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: '#D9D2BF',
      }}
    >
      {pinPlacementOpen ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel pin placement"
            onPress={onCancelPinPlacement}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D9D2BF',
              paddingVertical: 14,
              alignItems: 'center',
              borderRadius: 2,
            }}
          >
            <Text
              style={{
                color: '#5C6356',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              Cancel
            </Text>
          </Pressable>
          {roundPin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear pin"
              onPress={onClearRoundPin}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#A33A2A',
                paddingVertical: 14,
                alignItems: 'center',
                borderRadius: 2,
              }}
            >
              <Text
                style={{
                  color: '#A33A2A',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                Clear flag
              </Text>
            </Pressable>
          )}
        </View>
      ) : teePlacementOpen ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel tee placement"
            onPress={onCancelTeePlacement}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D9D2BF',
              paddingVertical: 14,
              alignItems: 'center',
              borderRadius: 2,
            }}
          >
            <Text
              style={{
                color: '#5C6356',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : roundState === 'SET_AIM' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={aim ? 'Confirm aim point' : 'Long-press the map to set aim point'}
            accessibilityState={{ disabled: !aim }}
            onPress={onConfirmAim}
            disabled={!aim}
            style={{
              backgroundColor: aim ? '#1F3D2C' : '#EBE5D6',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: aim ? '#F2EEE5' : '#8A8B7E',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              {aim ? 'Confirm aim →' : 'Long-press the map to aim'}
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Re-place ball"
              onPress={onRePlaceBall}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 6 }}
            >
              <Text style={{ ...KICKER, color: '#8A8B7E' }}>← Re-place ball</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip aim point"
              onPress={onSkipAim}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 6 }}
            >
              <Text style={{ ...KICKER, color: '#8A8B7E' }}>Skip aim</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              ball
                ? 'Mark ball at current position'
                : hasGps
                  ? 'Mark ball at your GPS location'
                  : 'Waiting for GPS — drop the ball on the map'
            }
            accessibilityState={{ disabled: (!ball && !hasGps) || saving }}
            onPress={onMarkBallHere}
            disabled={(!ball && !hasGps) || saving}
            style={{
              backgroundColor: ball || hasGps ? '#1F3D2C' : '#EBE5D6',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: ball || hasGps ? '#F2EEE5' : '#8A8B7E',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              {saving
                ? 'Saving…'
                : ball
                  ? 'Mark ball here →'
                  : hasGps
                    ? 'Mark ball at my GPS →'
                    : 'Waiting for GPS…'}
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            {!tee && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Place tee box"
                onPress={onOpenTeePlacement}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 6 }}
              >
                <Text style={{ ...KICKER, color: '#5C6356' }}>Place tee box</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={roundPin ? 'Move pin' : 'Place pin'}
              onPress={onOpenPinPlacement}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 6, marginLeft: tee ? 'auto' : undefined }}
            >
              <Text
                style={{
                  ...KICKER,
                  color: nearPin ? '#A66A1F' : '#8A8B7E',
                }}
              >
                {roundPin
                  ? 'Move pin'
                  : nearPin
                    ? 'On the green — place today\'s pin'
                    : 'Place pin location'}
              </Text>
            </Pressable>
          </View>
          {totalShotsThisHole > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={holeNumber < 18 ? 'Finish hole and continue' : 'Finish round'}
              onPress={onFinishHole}
              style={{
                borderWidth: 1,
                borderColor: '#1F3D2C',
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 10,
                borderRadius: 2,
              }}
            >
              <Text
                style={{
                  color: '#1F3D2C',
                  fontSize: 13,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                {holeNumber < 18 ? `Finish hole · next →` : 'Finish round'}
              </Text>
            </Pressable>
          )}
        </>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous hole"
          accessibilityState={{ disabled: holeNumber === 1 }}
          onPress={onPrev}
          disabled={holeNumber === 1}
          style={{
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
            paddingVertical: 6,
            paddingHorizontal: 12,
            opacity: holeNumber === 1 ? 0.4 : 1,
          }}
        >
          <Text style={{ fontSize: 12, color: '#1C211C' }}>← Prev</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenScorecard}
          style={{ flex: 1, alignItems: 'center' }}
          accessibilityLabel="Open scorecard"
        >
          <Text
            style={{
              fontFamily: 'Fraunces-Medium',
              fontSize: 13,
              color: '#1C211C',
              marginBottom: 2,
            }}
          >
            {`Hole ${holeNumber} · Par ${holes.find((h) => h.number === holeNumber)?.par ?? 4}`}
          </Text>
          <Text
            style={{
              ...KICKER,
              color: '#5C6356',
              marginBottom: 4,
            }}
          >
            Scorecard ▾
          </Text>
          <ScorecardPreview
            holes={holes}
            holeScores={holeScores}
            currentHoleNumber={holeNumber}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next hole"
          accessibilityState={{ disabled: holeNumber === 18 }}
          onPress={onNext}
          disabled={holeNumber === 18}
          style={{
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
            paddingVertical: 6,
            paddingHorizontal: 12,
            opacity: holeNumber === 18 ? 0.4 : 1,
          }}
        >
          <Text style={{ fontSize: 12, color: '#1C211C' }}>Next →</Text>
        </Pressable>
      </View>
    </View>
  )
}
