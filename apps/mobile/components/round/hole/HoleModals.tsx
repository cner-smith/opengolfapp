import { Modal, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import type { Database } from '@oga/supabase'
import { formatHoleList, type ResolvedHole } from '@oga/core'
import { ScorecardModal } from '../Scorecard'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import type { ActiveDialog } from './types'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

interface HoleModalsProps {
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
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onConfirmLeave: () => void
  onCancelLeave: () => void
  onConfirmEnd: () => void
  // #940 prompt: other holes still unfinished when the last one to play is saved.
  unfinished: { holes: number[]; onContinue: (hole: number) => void }
  onCancelEnd: () => void
}

export function HoleModals(props: HoleModalsProps) {
  const {
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
    onConfirmDelete,
    onCancelDelete,
    onConfirmLeave,
    onCancelLeave,
    onConfirmEnd,
    unfinished,
    onCancelEnd,
  } = props
  // Holes with anything logged — counted, not assumed from the hole number:
  // #940's "Continue to hole N" makes out-of-order play common.
  const currentHoleId = holes.find((h) => h.number === holeNumber)?.id
  const detailedHoles = holeScores.filter(
    (s) => s.score > 0 || (s.hole_id === currentHoleId && totalShotsThisHole > 0),
  ).length
  return (
    <>
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
        message={`Your round will be saved with ${detailedHoles} hole(s) of detail. SG and totals are computed from what's logged so far.`}
        confirmLabel="End round"
        cancelLabel="Cancel"
        busy={ending}
        onConfirm={onConfirmEnd}
        onCancel={onCancelEnd}
      />

      {/* #940: Back / dismiss = Continue, the safe choice — never ends the round. */}
      <ConfirmDialog
        visible={activeDialog === 'unfinished'}
        title={`Hole${unfinished.holes.length === 1 ? '' : 's'} ${formatHoleList(unfinished.holes)} ${unfinished.holes.length === 1 ? "isn't" : "aren't"} finished`}
        message="Keep playing, or finish the round now with what's logged."
        confirmLabel="Finish round"
        cancelLabel={`Continue to hole ${unfinished.holes[0] ?? ''}`}
        busy={ending}
        onConfirm={onConfirmEnd}
        onCancel={() => unfinished.holes[0] != null && unfinished.onContinue(unfinished.holes[0])}
      />

      <Modal
        visible={scorecardOpen}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setScorecardOpen(false)}
      >
        {/* GHRootView required: RN Modal is a separate native window on
            Android, so the swipe-to-dismiss pan wouldn't reach ScorecardModal
            without its own root (#496). */}
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
