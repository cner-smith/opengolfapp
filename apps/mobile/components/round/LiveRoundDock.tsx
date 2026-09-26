import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tourMakePercent } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface, Rocker } from '../paper/Paper'
import { Em, NoPinVoice, Primary, Secondary, SmallKey, Voice } from '../paper/Dock'
import { Icon } from '../paper/icons'
import { GAP, MARGIN, P } from '../paper/tokens'
import { RulerCard } from './HoleMapOverlays'
import type { RoundState } from './hole/types'
import type { OffscreenArrow } from './HoleMap.types'

// The Mapbox logo + attribution live in the strip under the footer (ToS);
// gesture-nav insets are too thin to show them, so keep at least this much.
export const MIN_BOTTOM_STRIP = 26

export interface LiveRoundDockProps {
  roundState: RoundState
  pinPlacementOpen: boolean
  hasPin: boolean
  ball: { lat: number; lng: number } | null
  aim: { lat: number; lng: number } | null
  saving: boolean
  hasGps: boolean
  /** The ball is tracking the player's GPS (not dragged). */
  ballFromGps: boolean
  isRevisitingPlayedHole: boolean
  totalShotsThisHole: number
  /** Saving this hole ends the round rather than moving on (#940). */
  finishesRound: boolean
  lefty: boolean
  /** Played-hole edit surface: renders in place of the buttons. */
  editStepper: ReactNode | null

  patternOn: boolean
  onTogglePattern: () => void
  onTogglePin: () => void
  overlayMode: 'tee' | 'appr'
  onSetOverlayMode: (m: 'tee' | 'appr') => void
  rulerIndex: number
  onSelectRuler: (i: number) => void
  showRecenter: boolean
  onRecenter: () => void

  aimHintVisible: boolean
  onDismissAimHint: () => void
  puttDistanceFt: number | null
  /** OB offered for the hole's last shot (#839 / #895 B2). */
  obPromptActive: boolean
  lastShotIsOb: boolean
  /** Direction to the last shot's marker while it's off-screen, else null. */
  obArrow: OffscreenArrow | null

  onCancelPinPlacement: () => void
  onConfirmAim: () => void
  onRePlaceBall: () => void
  onSkipAim: () => void
  onMarkBallHere: () => void
  onOnGreen: () => void
  onAddShot: () => void
  onMarkLastShotOb: () => void
  onFinishHole: () => void
  onPuttMade: () => void
  onPuttMissed: () => void
  onNotOnGreen: () => void
  /** Height of the paper footer (voice line + buttons), for camera framing. */
  onFooterHeight: (h: number) => void
}

// Live-round dock (#611 §4–§6): the side stacks standing 8 above a paper
// footer that holds the voice line and the bottom row. Absolute over the map,
// which runs on under the nav bar (the Mapbox logo shows there).
export function LiveRoundDock(p: LiveRoundDockProps) {
  const insets = useSafeAreaInsets()
  const aimLike = p.roundState === 'SET_AIM' && !p.pinPlacementOpen && p.aim != null
  const putting = p.roundState === 'PUTTING'
  const showStacks = p.editStepper == null

  const keys = (
    <View style={{ flexDirection: 'row', gap: GAP, width: 124 }}>
      <Key
        accessibilityLabel={p.patternOn ? 'Hide shot pattern' : 'Show shot pattern'}
        onPress={p.onTogglePattern}
        latched={p.patternOn && !putting && p.hasPin}
        disabled={putting || !p.hasPin}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pattern size={20} color={putting || !p.hasPin ? P.ink35 : P.ink} />
        <KeyText size={11} bold={p.patternOn && !putting && p.hasPin} disabled={putting || !p.hasPin}>
          Pattern
        </KeyText>
      </Key>
      <Key
        accessibilityLabel={p.pinPlacementOpen ? 'Cancel pin placement' : 'Place pin'}
        onPress={p.onTogglePin}
        latched={p.pinPlacementOpen}
        style={{ flex: 1 }}
        faceStyle={{ height: 46, gap: 1 }}
      >
        <Icon.pin size={20} />
        <KeyText size={11} bold={p.pinPlacementOpen}>
          Pin
        </KeyText>
      </Key>
    </View>
  )

  const right = aimLike ? (
    <View style={{ width: 96, gap: GAP }}>
      <Rocker
        options={[
          { value: 'tee', label: 'Tee' },
          { value: 'appr', label: 'Appr' },
        ]}
        value={p.overlayMode}
        onChange={(v) => v && p.onSetOverlayMode(v)}
      />
      <RulerCard mode={p.overlayMode} index={p.rulerIndex} onSelect={p.onSelectRuler} lefty={p.lefty} />
    </View>
  ) : p.showRecenter ? (
    <Key
      accessibilityLabel="Put the ball on my GPS spot"
      onPress={p.onRecenter}
      disabled={!p.hasGps}
      faceStyle={{ width: 48, height: 48 }}
    >
      <Icon.gps size={24} color={p.hasGps ? P.ink : P.ink35} />
    </Key>
  ) : (
    <View />
  )

  const voice = voiceLine(p)
  const buttons = bottomRow(p)
  if (p.lefty) buttons.reverse()

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, MIN_BOTTOM_STRIP) }}
    >
      {showStacks && (
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: p.lefty ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: MARGIN,
            paddingBottom: GAP,
          }}
        >
          {keys}
          {right}
        </View>
      )}
      <PaperSurface
        onLayout={(e) => p.onFooterHeight(e.nativeEvent.layout.height)}
        style={{
          borderTopWidth: 1,
          borderTopColor: P.ink,
          paddingTop: voice ? 0 : 6,
          paddingHorizontal: MARGIN,
          paddingBottom: 7,
        }}
      >
        {voice}
        {p.editStepper ?? (
          <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}>{buttons}</View>
        )}
      </PaperSurface>
    </View>
  )
}

// One line at a time, highest priority wins (§6 table).
function voiceLine(p: LiveRoundDockProps): ReactNode {
  if (p.editStepper) return null
  if (p.pinPlacementOpen) {
    return (
      <Voice trailing={<SmallKey label="Cancel" onPress={p.onCancelPinPlacement} />}>
        <Em>Where’s the flag?</Em> Tap it on the map.
      </Voice>
    )
  }
  if (!p.hasPin) return <NoPinVoice onPress={p.onTogglePin} />
  if (p.obPromptActive && p.lastShotIsOb) {
    return (
      <Voice trailing={<SmallKey label="Undo" onPress={p.onMarkLastShotOb} />}>
        Penalty stroke added.
      </Voice>
    )
  }
  if (p.obPromptActive && p.obArrow) {
    return (
      <Voice trailing={<SmallKey label="OB" color={P.neg} onPress={p.onMarkLastShotOb} />}>
        {p.obArrow} Did shot {p.totalShotsThisHole} go out of bounds?
      </Voice>
    )
  }
  if (p.roundState === 'PUTTING') {
    const ft = p.puttDistanceFt
    const pct = ft != null && ft > 0 ? tourMakePercent(ft) : null
    return pct != null ? (
      <Voice>
        Nice — you’re on. <Em>Tour pros hole this {pct}%</Em> of the time.
      </Voice>
    ) : (
      <Voice>Nice — you’re on.</Voice>
    )
  }
  if (p.roundState === 'SET_AIM') {
    if (!p.aim) return <Voice>Long-press the map where you’re aiming.</Voice>
    if (p.aimHintVisible) {
      return (
        <Voice
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss hint"
              onPress={p.onDismissAimHint}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon.x size={18} />
            </Pressable>
          }
        >
          Your aim is your start line — drag it to adjust.
        </Voice>
      )
    }
    return null
  }
  if (p.roundState === 'PLACE_BALL' && !p.isRevisitingPlayedHole) {
    return <Voice>Mark your ball, then drag to fine-tune.</Voice>
  }
  return null
}

function bottomRow(p: LiveRoundDockProps): ReactNode[] {
  if (p.roundState === 'PUTTING') {
    return [
      <Secondary key="not" label="Not on the green" onPress={p.onNotOnGreen} />,
      <Secondary key="miss" label="Missed" onPress={p.onPuttMissed} disabled={p.saving} />,
      <Primary key="made" label="Made it" onPress={p.onPuttMade} disabled={p.saving} />,
    ]
  }
  if (p.roundState === 'SET_AIM') {
    return [
      <Secondary key="replace" label="Re-place ball" onPress={p.onRePlaceBall} />,
      <Secondary key="skip" label="Skip aim" onPress={p.onSkipAim} />,
      <Primary key="confirm" label="Confirm aim" onPress={p.onConfirmAim} disabled={!p.aim} />,
    ]
  }
  const finish =
    p.totalShotsThisHole > 0 ? (
      <Secondary key="finish" label={p.finishesRound ? 'Finish round' : 'Finish hole'} onPress={p.onFinishHole} />
    ) : null
  if (p.isRevisitingPlayedHole) {
    return [finish, <Primary key="add" label="Add a shot" onPress={p.onAddShot} disabled={p.saving} />].filter(Boolean)
  }
  const onGreen =
    p.totalShotsThisHole > 0 && (p.ball != null || p.hasGps) && !p.saving ? (
      <Secondary key="green" label="On the green" onPress={p.onOnGreen} />
    ) : null
  const waiting = !p.ball && !p.hasGps
  const label = p.saving ? 'Saving…' : waiting ? 'Waiting for GPS…' : 'Mark my ball'
  const sub = p.saving || waiting ? undefined : p.ballFromGps || !p.ball ? 'at my GPS spot' : undefined
  return [
    finish,
    onGreen,
    <Primary key="mark" label={label} sub={sub} onPress={p.onMarkBallHere} disabled={waiting || p.saving} />,
  ].filter(Boolean)
}
