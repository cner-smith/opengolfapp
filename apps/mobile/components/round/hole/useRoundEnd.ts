import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import type { User } from '@supabase/supabase-js'
import { deleteRound, getProfile } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { pendingCount } from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import { completeRound } from '../../../lib/completeRound'
import type { ActiveDialog } from './types'
import type { UseHoleDataResult } from './useHoleData'

interface UseRoundEndInput {
  user: User | null
  round: UseHoleDataResult['round']
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>
  // The round was just finalized; the host swaps to the completed-round
  // summary (see useShotActions' input, #909).
  onRoundCompleted: () => void
}

export interface UseRoundEndResult {
  ending: boolean
  deleting: boolean
  handleEndRound: () => Promise<void>
  handleDeleteRound: () => Promise<void>
  handleExitFromError: () => void
}

// Finalizing, deleting and leaving the round. Split out of useShotActions (#1015).
export function useRoundEnd({ user, round, setActiveDialog, onRoundCompleted }: UseRoundEndInput): UseRoundEndResult {
  const router = useRouter()
  // Same async-setter race as persistShot: `setEnding(true)` commits a tick
  // late, so a fast double-tap of Finish (18th hole) or End round could fire
  // completeRound twice. The ref flips synchronously and blocks the second.
  const endInFlightRef = useRef(false)
  const [ending, setEnding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleEndRound() {
    if (!round || !user) return
    if (endInFlightRef.current) return
    endInFlightRef.current = true
    setEnding(true)
    try {
      // Drain the queue before finalizing (#651). syncPendingShots joins
      // an in-flight run instead of no-oping, but a joined run may have
      // snapshotted the queue before the final putt's row landed — if
      // anything is still pending after the first pass, run once more now
      // that the previous run has settled.
      await syncPendingShots().catch(() => undefined)
      if ((await pendingCount(user.id)) > 0) {
        await syncPendingShots().catch(() => undefined)
      }
      const unsynced = await pendingCount(user.id)
      if (unsynced > 0) {
        // Shots that never reached the server would silently vanish from
        // totals/SG (completeRound reads the server's shot set). Make the
        // player choose: keep the round open and retry with a better
        // connection, or knowingly finalize over what synced. cancelable:
        // false so the Android back button can't dismiss without
        // resolving.
        const finishAnyway = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Some shots have not synced',
            `${unsynced} shot${unsynced === 1 ? ' has' : 's have'} not reached the server. ` +
              'Finishing now will compute totals and strokes gained without ' +
              `${unsynced === 1 ? 'it' : 'them'}. You can keep the round open and finish later with a better connection.`,
            [
              {
                text: 'Keep round open',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Finish anyway',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ],
            { cancelable: false },
          )
        })
        if (!finishAnyway) return
      }
      const { data: profile } = await getProfile(supabase, user.id)
      const handicap =
        (profile as { handicap_index?: number | null } | null)?.handicap_index ??
        null
      await completeRound({
        roundId: round.id,
        courseId: round.course_id,
        userId: user.id,
        handicap,
      })
      onRoundCompleted()
    } catch (err) {
      Alert.alert('End round failed', (err as Error).message)
    } finally {
      endInFlightRef.current = false
      setEnding(false)
      // Guard against clobbering a different dialog the user may have
      // opened during the async window (TS agent feedback on #293).
      setActiveDialog(prev => (prev === 'end' ? null : prev))
    }
  }

  async function handleDeleteRound() {
    if (!round || !user) return
    setDeleting(true)
    try {
      const { error: delErr } = await deleteRound(supabase, round.id, user.id)
      if (delErr) {
        Alert.alert('Delete failed', delErr.message)
        return
      }
      router.replace('/(app)')
    } finally {
      setDeleting(false)
      // Guard against clobbering a different dialog the user may have
      // opened during the async window.
      setActiveDialog(prev => (prev === 'delete' ? null : prev))
    }
  }

  function handleExitFromError() {
    // Leave to home WITHOUT deleting. A load error (network blip on a
    // rounds-deep resume) or a missing hole means the round is still
    // resumable — and synthetic no-layout courses are now playable (#614),
    // so there's no "unplayable, discard it" case left to justify a delete.
    // The old delete-on-exit destroyed a whole logged round on a transient
    // failure, behind copy that claimed nothing was logged (#653). The
    // round stays resumable, and is still deletable from the home list.
    setActiveDialog(prev => (prev === 'exit' ? null : prev))
    router.replace('/(app)')
  }

  return { ending, deleting, handleEndRound, handleDeleteRound, handleExitFromError }
}
