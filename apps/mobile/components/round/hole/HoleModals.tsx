import { Modal, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import type { Database } from '@oga/supabase'
import type { LieType, ResolvedHole } from '@oga/core'
import {
  // ShotLogger is mounted below but currently unreachable: its only entry
  // point was PuttingSheet's "Not a putt?" escape (swapPuttingToShot), and
  // PuttingSheet's live modal was retired in the #791 step-4 rework (Made/
  // Missed bottom overlays replaced it). Left in place rather than removed
  // to keep this diff focused — follow-up cleanup ticket, not this change.
  ShotLogger,
  type ShotLoggerValue,
} from '../ShotLogger'
import { ScorecardModal } from '../Scorecard'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import type { LatLng } from '../HoleMap'
import { distanceYards } from '../../../lib/maps'
import type { ActiveDialog } from './types'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface HoleModalsProps {
  shotNumber: number
  // Stable identity for the ShotLogger form instance — composed of
  // hole_score_id + a per-save counter (see #284). Changes only on a
  // legitimate "new shot entry" event (save success or hole change),
  // never on incidental shotNumber recomputation. Pass through to
  // <ShotLogger key={...}> so the form remount is intentional.
  shotEntryKey: string
  loggerOpen: boolean
  loggerInitial: ShotLoggerValue
  ball: LatLng | null
  roundPin: LatLng | null
  storedPin: LatLng | null
  scorecardOpen: boolean
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  resolvedHoleByNumber: Map<number, ResolvedHole>
  holeNumber: number
  routerReplace: (href: string) => void
  id: string | undefined
  onChangePar: (holeId: string, newPar: number) => Promise<void>
  setScorecardOpen: (open: boolean) => void
  // Confirm dialogs — one mutually-exclusive state. See ActiveDialog
  // in ./types for the union (#293).
  activeDialog: ActiveDialog
  totalShotsThisHole: number
  ending: boolean
  deleting: boolean
  saving: boolean
  onPersistShot: (v: ShotLoggerValue | null) => void
  onCloseLogger: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onConfirmLeave: () => void
  onCancelLeave: () => void
  onConfirmEnd: () => void
  onCancelEnd: () => void
  onGreenYes: () => void
  onGreenNo: () => void
  onAimPromptConfirm: () => void
  onAimPromptSkip: () => void
}

export function HoleModals(props: HoleModalsProps) {
  const {
    shotNumber,
    shotEntryKey,
    loggerOpen,
    loggerInitial,
    ball,
    roundPin,
    storedPin,
    scorecardOpen,
    holes,
    holeScores,
    resolvedHoleByNumber,
    holeNumber,
    routerReplace,
    id,
    onChangePar,
    setScorecardOpen,
    activeDialog,
    totalShotsThisHole,
    ending,
    deleting,
    saving,
    onPersistShot,
    onCloseLogger,
    onConfirmDelete,
    onCancelDelete,
    onConfirmLeave,
    onCancelLeave,
    onConfirmEnd,
    onCancelEnd,
    onGreenYes,
    onGreenNo,
    onAimPromptConfirm,
    onAimPromptSkip,
  } = props
  return (
    <>
      <ShotLogger
        key={shotEntryKey}
        visible={loggerOpen}
        shotNumber={shotNumber}
        isPutt={false}
        puttDistanceFt={
          ball
            ? Math.round(distanceYards(ball, roundPin ?? storedPin ?? ball) * 3)
            : undefined
        }
        initial={loggerInitial}
        saving={saving}
        onSave={(v) => onPersistShot(v)}
        onSkip={() => onPersistShot(null)}
        onClose={onCloseLogger}
      />

      {/* PuttingSheet's live-round modal was retired here (#791 step-4
          rework): on-green now uses the Made/Missed bottom overlays
          (MapBottomChrome) instead of a full sheet. The detailed putt read
          (aim/break/speed) moved to the end-of-hole summary, which has its
          own AimerOverlay + Read ▸ (HoleReviewSheet.tsx) — a parallel
          implementation, not a reuse of the PuttingSheet component. */}

      <ConfirmDialog
        visible={activeDialog === 'delete'}
        title="Delete this round?"
        message="Hole scores and shots are removed too. This cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />

      <ConfirmDialog
        visible={activeDialog === 'leave'}
        title="Leave round?"
        message="Your progress is saved and you can resume from the home screen."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={onConfirmLeave}
        onCancel={onCancelLeave}
      />

      <ConfirmDialog
        visible={activeDialog === 'end'}
        title={`End round after hole ${holeNumber}?`}
        message={`Your round will be saved with ${totalShotsThisHole > 0 ? holeNumber : holeNumber - 1} hole(s) of detail. SG and totals are computed from what's logged so far.`}
        confirmLabel="End round"
        cancelLabel="Cancel"
        busy={ending}
        onConfirm={onConfirmEnd}
        onCancel={onCancelEnd}
      />

      <ConfirmDialog
        visible={activeDialog === 'onGreen'}
        title="On the green?"
        message="Within 30 yd of the pin — were you putting, or chipping/in a bunker?"
        confirmLabel="Yes, I'm putting"
        cancelLabel="No"
        onConfirm={onGreenYes}
        onCancel={onGreenNo}
      />

      <ConfirmDialog
        visible={activeDialog === 'aim'}
        title="Set an aim point?"
        message="Your aim point is your start line — where you intend to start the ball, not where you want it to finish."
        confirmLabel="Set aim point →"
        cancelLabel="Skip"
        onConfirm={onAimPromptConfirm}
        onCancel={onAimPromptSkip}
      />

      <Modal
        visible={scorecardOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScorecardOpen(false)}
      >
        {/* GHRootView required: RN Modal is a separate native window on
            Android, so the swipe-to-dismiss pan wouldn't reach ScorecardModal
            without its own root (#496). Mirrors the putting modal above. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScorecardModal
          holes={holes}
          holeScores={holeScores}
          resolvedHoleByNumber={resolvedHoleByNumber}
          currentHoleNumber={holeNumber}
          onJumpToHole={(n) => {
            setScorecardOpen(false)
            if (n !== holeNumber) {
              routerReplace(`/(app)/round/${id}?hole=${n}`)
            }
          }}
          onChangePar={onChangePar}
          onClose={() => setScorecardOpen(false)}
          />
        </GestureHandlerRootView>
      </Modal>
    </>
  )
}
