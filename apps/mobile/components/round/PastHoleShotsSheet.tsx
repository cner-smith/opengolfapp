import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import {
  DEFAULT_BAG,
  LIE_TYPE_LABELS,
  LIE_TYPES,
  SHOT_RESULTS,
  formatClubLabel,
  formatDistance,
  type DistanceUnit,
  type LieType,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useUserBag } from '../../hooks/useUserBag'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FONT, TYPE } from '../../lib/typography'

type ShotRow = Database['public']['Tables']['shots']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

const SHOT_RESULT_LABELS: Record<ShotResult, string> = {
  solid: 'Solid',
  push_right: 'Push R',
  pull_left: 'Pull L',
  fat: 'Fat',
  thin: 'Thin',
  shank: 'Shank',
  topped: 'Topped',
  penalty: 'Penalty',
  ob: 'OB',
}

interface PastHoleShotsSheetProps {
  visible: boolean
  holeNumber: number | null
  par: number | null
  shots: ShotRow[]
  unit: DistanceUnit
  onClose: () => void
  onShotUpdated?: (shot: ShotRow) => void
}

export function PastHoleShotsSheet({
  visible,
  holeNumber,
  par,
  shots,
  unit,
  onClose,
  onShotUpdated,
}: PastHoleShotsSheetProps) {
  const { bag } = useUserBag({ seedIfEmpty: false })
  const clubs = bag.length > 0 ? bag : DEFAULT_BAG
  const [editingShot, setEditingShot] = useState<ShotRow | null>(null)
  const [saving, setSaving] = useState(false)
  const insets = useSafeAreaInsets()

  const sortedShots = [...shots].sort((a, b) => a.shot_number - b.shot_number)

  async function handleSave(
    shotId: string,
    updates: { club: string | null; lie_type: string | null; shot_result: string | null },
  ) {
    setSaving(true)
    const { data, error } = await supabase
      .from('shots')
      .update(updates)
      .eq('id', shotId)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setEditingShot(null)
      onShotUpdated?.(data as ShotRow)
    }
  }

  // One <Modal> with discriminated content (list vs editor) — NOT two
  // sibling Modals. iOS allows one presented modal per presenter, so the
  // old stacked-Modal edit flow silently failed to present (#293/#495).
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={editingShot ? () => setEditingShot(null) : onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={editingShot ? () => setEditingShot(null) : onClose}
        />
        {editingShot ? (
          <EditShotSheet
            shot={editingShot}
            clubs={clubs}
            unit={unit}
            saving={saving}
            onSave={(updates) => handleSave(editingShot.id, updates)}
            onClose={() => setEditingShot(null)}
          />
        ) : (
        <View
          style={{
            backgroundColor: '#FBF8F1',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: insets.bottom + 28,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D9D2BF',
              marginBottom: 14,
            }}
          />
          <Text style={{ ...KICKER, marginBottom: 4 }}>
            Hole {holeNumber ?? '—'}
            {par != null ? ` · Par ${par}` : ''}
          </Text>
          <Text
            style={[TYPE.serif, {
              color: '#1C211C',
              fontSize: 22,
              fontStyle: 'italic',
              fontWeight: '500',
              marginBottom: 14,
            }]}
          >
            {sortedShots.length} shot{sortedShots.length === 1 ? '' : 's'}
          </Text>

          {sortedShots.length === 0 ? (
            <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, lineHeight: 20 }]}>
              No shots logged for this hole.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: '85%' }}>
              {sortedShots.map((s) => (
                <ShotRowView
                  key={s.id}
                  shot={s}
                  unit={unit}
                  onPress={() => setEditingShot(s)}
                />
              ))}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close hole shots"
            onPress={onClose}
            style={{
              marginTop: 14,
              paddingVertical: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
            }}
          >
            <Text style={{ ...KICKER, color: '#5C6356' }}>Close</Text>
          </Pressable>
        </View>
        )}
      </View>
    </Modal>
  )
}

function ShotRowView({
  shot,
  unit,
  onPress,
}: {
  shot: ShotRow
  unit: DistanceUnit
  onPress: () => void
}) {
  const clubLabel = shot.club ? formatClubLabel({ club_type: shot.club }) : '—'
  const lieLabel = shot.lie_type ? LIE_TYPE_LABELS[shot.lie_type as LieType] : null
  const distanceLabel =
    shot.distance_to_target != null ? formatDistance(shot.distance_to_target, unit) : null

  return (
    <PressableTouch
      android_ripple={{ color: '#EBE5D6' }}
      accessibilityRole="button"
      accessibilityLabel={`Edit shot ${shot.shot_number}: ${clubLabel}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#EBE5D6',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Text style={[TYPE.kicker, { width: 24, color: '#8A8B7E', fontSize: 14, fontVariant: ['tabular-nums'] }]}>
        {shot.shot_number}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 15, fontWeight: '500', textTransform: 'capitalize' }]}>
          {clubLabel}
        </Text>
        {(lieLabel || distanceLabel) && (
          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12, marginTop: 2 }]}>
            {[lieLabel, distanceLabel].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12 }]}>Edit</Text>
    </PressableTouch>
  )
}

interface EditShotSheetProps {
  shot: ShotRow
  clubs: readonly { club_type: string; name?: string | null }[]
  unit: DistanceUnit
  saving: boolean
  onSave: (updates: { club: string | null; lie_type: string | null; shot_result: string | null }) => void
  onClose: () => void
}

function EditShotSheet({ shot, clubs, saving, onSave, onClose }: EditShotSheetProps) {
  const insets = useSafeAreaInsets()
  const [club, setClub] = useState<string | null>(shot.club ?? null)
  const [lieType, setLieType] = useState<string | null>(shot.lie_type ?? null)
  const [shotResult, setShotResult] = useState<string | null>(shot.shot_result ?? null)

  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: insets.bottom + 28,
        maxHeight: '90%',
      }}
    >
      <View
        style={{
          alignSelf: 'center',
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#D9D2BF',
          marginBottom: 14,
        }}
      />
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 17,
          fontStyle: 'italic',
          fontWeight: '500',
          marginBottom: 18,
        }]}
      >
        Edit shot {shot.shot_number}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={{ ...KICKER, marginBottom: 8 }}>Club</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {clubs.map((c) => {
              const active = club === c.club_type
              return (
                <Pressable
                  key={c.club_type}
                  onPress={() => setClub(c.club_type)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 2,
                    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
                  }}
                >
                  <Text style={[TYPE.body, { color: active ? '#F2EEE5' : '#1C211C', fontSize: 12 }]}>
                    {formatClubLabel({ club_type: c.club_type })}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <Text style={{ ...KICKER, marginBottom: 8 }}>Lie</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {LIE_TYPES.map((lt) => {
              const active = lieType === lt
              return (
                <Pressable
                  key={lt}
                  onPress={() => setLieType(lt)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 2,
                    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
                  }}
                >
                  <Text style={[TYPE.body, { color: active ? '#F2EEE5' : '#1C211C', fontSize: 12 }]}>
                    {LIE_TYPE_LABELS[lt as LieType]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <Text style={{ ...KICKER, marginBottom: 8 }}>Result</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SHOT_RESULTS.map((r) => {
              const active = shotResult === r
              return (
                <Pressable
                  key={r}
                  onPress={() => setShotResult(r)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 2,
                    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
                  }}
                >
                  <Text style={[TYPE.body, { color: active ? '#F2EEE5' : '#1C211C', fontSize: 12 }]}>
                    {SHOT_RESULT_LABELS[r as ShotResult]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
          }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save shot edits"
          disabled={saving}
          onPress={() => onSave({ club, lie_type: lieType, shot_result: shotResult })}
          style={{
            flex: 2,
            paddingVertical: 12,
            alignItems: 'center',
            backgroundColor: saving ? '#5C6356' : '#1F3D2C',
            borderRadius: 2,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ ...KICKER, color: '#F2EEE5' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  )
}
