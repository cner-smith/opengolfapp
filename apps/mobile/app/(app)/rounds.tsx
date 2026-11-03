import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { formatSG, isStaleEmptyRound, parseLocalDate, partialRoundLabel } from '@oga/core'
import { deleteRound, getRoundsList } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { clearScreenCache, getCached, setCached } from '../../lib/screenCache'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Entrance } from '../../components/ui/Entrance'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { PaperTile } from '../../components/paper/Section'
import { ImportHistoryLink } from '../../components/home/RoundCTAs'
import { FONT_CAP, P } from '../../components/paper/tokens'

interface RoundRow {
  id: string
  played_at: string
  created_at: string
  tee_color: string | null
  total_score: number | null
  sg_total: number | null
  // Optional: rows cached before #727 have none.
  hole_count?: number | null
  courses?: { name: string | null } | null
  hole_scores?: { score: number; holes: { number: number } | null }[] | null
}

// "Oct 19, 2026 · Black tees", as Home's recent rounds date a round.
function playedLine(r: RoundRow): string {
  const date = parseLocalDate(r.played_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const tee = r.tee_color
    ? ` · ${r.tee_color.charAt(0).toUpperCase()}${r.tee_color.slice(1)} tees`
    : ''
  return `${date}${tee}${partialRoundLabel(r.hole_scores, r.hole_count)}`
}

// Screen-reader label for a round row. TalkBack and VoiceOver read visible
// numbers but don't always interpret them; spell out what each field is.
function buildA11yLabel(r: RoundRow): string {
  const parts = [`Round at ${r.courses?.name ?? 'unnamed course'}`, playedLine(r)]
  if (r.total_score != null) parts.push(`scored ${r.total_score}`)
  if (r.sg_total != null) parts.push(`strokes gained ${formatSG(r.sg_total)}`)
  return parts.join('. ') + '.'
}

export default function RoundsList() {
  const { user } = useAuth()
  const router = useRouter()
  // Seed from the screen cache for an instant render on revisit; the mount
  // fetch below re-runs every visit and replaces it (#599).
  const [rounds, setRounds] = useState<RoundRow[]>(
    () => getCached<RoundRow[]>('roundsList') ?? [],
  )
  // The empty state waits for the first fetch, so a slow load doesn't flash
  // "No rounds yet" at a player who has rounds.
  const [loaded, setLoaded] = useState(() => getCached<RoundRow[]>('roundsList') != null)
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
        setLoaded(true)
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

  const renderRound = useCallback(
    ({ item: r, index }: { item: RoundRow; index: number }) => {
      const row = (
        <Swipeable
          ref={(ref) => {
            swipeRefs.current.set(r.id, ref)
          }}
          // Quiet delete: paper with a brick word, not a red slab. Long-press
          // and the screen-reader action open the same confirm.
          renderRightActions={() => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete round at ${r.courses?.name ?? 'this round'}`}
              onPress={() => openDeleteFor(r)}
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 22,
                borderBottomWidth: 1,
                borderLeftWidth: 1,
                borderColor: P.line,
              }}
            >
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 14 }]}>
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
                accessibilityActions={[{ name: 'delete', label: 'Delete round' }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'delete') openDeleteFor(r)
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
                  <Text
                    maxFontSizeMultiplier={FONT_CAP}
                    numberOfLines={2}
                    style={[TYPE.serif, { color: P.ink, fontSize: 19, lineHeight: 24 }]}
                  >
                    {r.courses?.name ?? 'Round'}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={FONT_CAP}
                    numberOfLines={1}
                    style={[TYPE.body, { color: P.inkDim, fontSize: 13, marginTop: 3 }]}
                  >
                    {playedLine(r)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14 }}>
                  <Text
                    maxFontSizeMultiplier={FONT_CAP}
                    style={[TYPE.serifUpright, { color: P.ink, fontSize: 24, fontVariant: ['tabular-nums'] }]}
                  >
                    {r.total_score ? r.total_score : '—'}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={FONT_CAP}
                    style={[TYPE.serifUpright, {
                      color: r.sg_total == null ? P.inkDim : r.sg_total >= 0 ? P.forest : P.neg,
                      fontSize: 14,
                      minWidth: 40,
                      textAlign: 'right',
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
      )
      // Stagger only the first screenful; rows further down mount as they scroll in.
      return index < 8 ? <Entrance index={index}>{row}</Entrance> : row
    },
    [openDeleteFor],
  )

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="All rounds" />
      {/* FlatList, not a ScrollView: the list holds up to 500 rounds, each a
          Swipeable, and only the rows on screen should mount. */}
      <FlatList
        data={rounds}
        keyExtractor={(r) => r.id}
        renderItem={renderRound}
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 28,
        }}
        ListHeaderComponent={
          rounds.length > 0 ? <View style={{ borderTopWidth: 1, borderColor: P.ink }} /> : null
        }
        ListEmptyComponent={
          !loaded ? null : (
          <Entrance index={0}>
            <PaperTile style={{ marginTop: 18 }} innerStyle={{ padding: 22 }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 22 }]}>
                No rounds yet.
              </Text>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 18 }]}>
                Log your first round, or bring your history from another app, to start tracking strokes gained.
              </Text>
              <Key
                tone="primary"
                accessibilityLabel="Log a round"
                onPress={() => router.push('/(app)/round/new?mode=past')}
                faceStyle={{ minHeight: 50 }}
              >
                <KeyText tone="primary" bold size={15}>
                  Log a round
                </KeyText>
              </Key>
              <View style={{ marginTop: 10 }}>
                <ImportHistoryLink />
              </View>
            </PaperTile>
          </Entrance>
          )
        }
      />
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
