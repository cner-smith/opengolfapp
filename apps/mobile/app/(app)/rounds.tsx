import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Link } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { formatSG, isStaleEmptyRound, partialRoundLabel } from '@oga/core'
import { deleteRound, getRoundsList } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { clearScreenCache, getCached, setCached } from '../../lib/screenCache'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Entrance } from '../../components/ui/Entrance'
import { TYPE } from '../../lib/typography'
import { PaperSurface } from '../../components/paper/Paper'
import { PaperTile } from '../../components/paper/Section'
import { FONT_CAP, P } from '../../components/paper/tokens'

interface RoundRow {
  id: string
  played_at: string
  created_at: string
  total_score: number | null
  sg_total: number | null
  courses?: { name: string | null } | null
  hole_scores?: { score: number; holes: { number: number } | null }[] | null
}

// Screen-reader label for a round row. TalkBack and VoiceOver read visible
// numbers but don't always interpret them; spell out what each field is.
function buildA11yLabel(r: RoundRow): string {
  const parts = [`Round at ${r.courses?.name ?? 'unnamed course'}`, r.played_at]
  if (r.total_score != null) parts.push(`scored ${r.total_score}`)
  if (r.sg_total != null) parts.push(`strokes gained ${formatSG(r.sg_total)}`)
  return parts.join('. ') + '.'
}

export default function RoundsList() {
  const { user } = useAuth()
  // Seed from the screen cache for an instant render on revisit; the mount
  // fetch below re-runs every visit and replaces it (#599).
  const [rounds, setRounds] = useState<RoundRow[]>(
    () => getCached<RoundRow[]>('roundsList') ?? [],
  )
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map())

  useEffect(() => {
    if (!user) return
    let active = true
    getRoundsList(supabase, user.id, 500).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[rounds/getRecentRounds]', error.message)
        return
      }
      if (data) {
        // Old rounds with no scored hole stay out of the list (#1055).
        const kept = (data as RoundRow[]).filter((r) => !isStaleEmptyRound(r))
        setRounds(kept)
        setCached('roundsList', kept)
      }
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const handleDelete = useCallback(
    async (id: string, courseName: string) => {
      if (!user) return
      setDeleting(true)
      try {
        const { error } = await deleteRound(supabase, id, user.id)
        if (error) throw error
        // Wipe ALL cached screens — a stale home/round-detail cache would
        // resurrect the deleted round as a ghost (#705 redux).
        clearScreenCache()
        // The round screen stays mounted behind this one; tell it (#613).
        DeviceEventEmitter.emit('oga:roundDeleted', id)
        setRounds((prev) => prev.filter((r) => r.id !== id))
        // Delay so VoiceOver doesn't swallow the announce while focus
        // shifts from the dismissing ConfirmDialog.
        setTimeout(() => {
          AccessibilityInfo.announceForAccessibility(
            `Deleted round at ${courseName}`,
          )
        }, 120)
      } finally {
        setDeleting(false)
        setPendingDelete(null)
        swipeRefs.current.delete(id)
      }
    },
    [user],
  )

  // Shared entry point for the three delete triggers: swipe-tap,
  // long-press, and the custom 'delete' accessibility action.
  const openDeleteFor = useCallback((r: RoundRow) => {
    swipeRefs.current.get(r.id)?.close()
    setPendingDelete({
      id: r.id,
      name: r.courses?.name ?? 'this round',
    })
  }, [])

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="All rounds" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 28,
        }}
      >
        {rounds.length === 0 ? (
          <PaperTile style={{ marginTop: 18 }} innerStyle={{ padding: 22 }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 22 }]}>
              No rounds yet.
            </Text>
          </PaperTile>
        ) : (
          <Entrance index={0}>
          <View style={{ borderTopWidth: 1, borderColor: P.ink }}>
            {rounds.map((r) => (
              <Swipeable
                key={r.id}
                ref={(ref) => {
                  swipeRefs.current.set(r.id, ref)
                }}
                renderRightActions={() => (
                  <Pressable
                    onPress={() => openDeleteFor(r)}
                    style={{
                      backgroundColor: P.neg,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 22,
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={FONT_CAP}
                      style={[TYPE.bodyBold, {
                        color: P.raised,
                        fontSize: 13,
                        letterSpacing: 0.3,
                      }]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                )}
                overshootRight={false}
              >
                <PaperSurface>
                <Link href={`/(app)/round/${r.id}`} asChild>
                  <PressableTouch
                    onLongPress={() => openDeleteFor(r)}
                    accessibilityLabel={buildA11yLabel(r)}
                    accessibilityHint="Opens round detail"
                    accessibilityActions={[
                      { name: 'delete', label: 'Delete round' },
                    ]}
                    onAccessibilityAction={(e) => {
                      if (e.nativeEvent.actionName === 'delete')
                        openDeleteFor(r)
                    }}
                    android_ripple={{ color: 'rgba(31,61,44,0.10)' }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderColor: P.line,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 4 }]}>
                        {r.played_at}
                        {partialRoundLabel(r.hole_scores)}
                      </Text>
                      <Text
                        maxFontSizeMultiplier={FONT_CAP}
                        style={[TYPE.serif, {
                          color: P.ink,
                          fontSize: 17,
                        }]}
                      >
                        {r.courses?.name ?? 'Round'}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: 14,
                      }}
                    >
                      <Text
                        maxFontSizeMultiplier={FONT_CAP}
                        style={[TYPE.serifUpright, {
                          color: P.ink,
                          fontSize: 22,
                          fontVariant: ['tabular-nums'],
                        }]}
                      >
                        {r.total_score ? r.total_score : '—'}
                      </Text>
                      <Text
                        maxFontSizeMultiplier={FONT_CAP}
                        style={[TYPE.serifUpright, {
                          color:
                            r.sg_total == null
                              ? P.inkDim
                              : r.sg_total >= 0
                                ? P.forest
                                : P.neg,
                          fontSize: 13,
                          fontVariant: ['tabular-nums'],
                        }]}
                      >
                        {r.sg_total == null ? '—' : formatSG(r.sg_total)}
                      </Text>
                    </View>
                  </PressableTouch>
                </Link>
                </PaperSurface>
              </Swipeable>
            ))}
          </View>
          </Entrance>
        )}
      </ScrollView>
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete this round?"
        message={
          pendingDelete
            ? `${pendingDelete.name} will be removed along with its hole scores and shots. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={async () => {
          if (pendingDelete)
            await handleDelete(pendingDelete.id, pendingDelete.name)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </PaperSurface>
  )
}
