import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Link } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import { formatSG } from '@oga/core'
import { deleteRound, getRecentSGData } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FONT, TYPE } from '../../lib/typography'

interface RoundRow {
  id: string
  played_at: string
  total_score: number | null
  sg_total: number | null
  courses?: { name: string | null } | null
}

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
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
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map())

  useEffect(() => {
    if (!user) return
    let active = true
    getRecentSGData(supabase, user.id, 500).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[rounds/getRecentSGData]', error.message)
        return
      }
      if (data) setRounds(data as RoundRow[])
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
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar title="All rounds" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 28,
        }}
      >
        {rounds.length === 0 ? (
          <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13, marginTop: 18 }]}>
            No rounds yet.
          </Text>
        ) : (
          <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
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
                      backgroundColor: '#A33A2A',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 22,
                    }}
                  >
                    <Text
                      style={[TYPE.bodyBold, {
                        color: '#F2EEE5',
                        fontSize: 13,
                        fontWeight: '600',
                        letterSpacing: 0.3,
                      }]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                )}
                overshootRight={false}
              >
                <Link href={`/(app)/round/${r.id}`} asChild>
                  <Pressable
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
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderColor: '#D9D2BF',
                      backgroundColor: '#F2EEE5',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ ...KICKER, marginBottom: 4 }}>
                        {r.played_at}
                      </Text>
                      <Text
                        style={[TYPE.serif, {
                          color: '#1C211C',
                          fontSize: 17,
                          fontWeight: '500',
                          fontStyle: 'italic',
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
                        style={[TYPE.serifUpright, {
                          color: '#1C211C',
                          fontSize: 22,
                          fontWeight: '500',
                          fontVariant: ['tabular-nums'],
                        }]}
                      >
                        {r.total_score ?? '—'}
                      </Text>
                      <Text
                        style={[TYPE.serifUpright, {
                          color:
                            r.sg_total == null
                              ? '#8A8B7E'
                              : r.sg_total >= 0
                                ? '#1F3D2C'
                                : '#A33A2A',
                          fontSize: 13,
                          fontWeight: '500',
                          fontVariant: ['tabular-nums'],
                        }]}
                      >
                        {r.sg_total == null ? '—' : formatSG(r.sg_total)}
                      </Text>
                    </View>
                  </Pressable>
                </Link>
              </Swipeable>
            ))}
          </View>
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
    </View>
  )
}
