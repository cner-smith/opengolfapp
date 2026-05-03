import { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  CLUBS,
  clubCategoryFor,
  type ClubCategory,
} from '@oga/core'
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AppBar } from '../../components/ui/AppBar'
import { useAuth } from '../../hooks/useAuth'
import {
  deleteClub,
  reorderClubs,
  resetBag,
  upsertClub,
  useUserBag,
  type UserClub,
} from '../../hooks/useUserBag'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const CANONICAL_BY_CATEGORY: Record<ClubCategory, readonly string[]> = {
  driver: ['driver'],
  wood: CLUBS.filter((c) => /^[357]w$/.test(c)),
  hybrid: CLUBS.filter((c) => /^[345]h$/.test(c)),
  iron: CLUBS.filter((c) => /^[2-9]i$/.test(c)),
  wedge: ['pw', 'gw', 'sw', 'lw'],
  putter: ['putter'],
  utility: [],
}

interface AddDraft {
  name: string
  category: ClubCategory
  clubType: string
  loft: string
  typicalDistance: string
}

const EMPTY_DRAFT: AddDraft = {
  name: '',
  category: 'iron',
  clubType: '7i',
  loft: '',
  typicalDistance: '',
}

export default function BagScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { bag, isLoading, error, refetch } = useUserBag({
    includeBenched: true,
    seedIfEmpty: true,
  })
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<AddDraft>(EMPTY_DRAFT)

  async function toggleInBag(c: UserClub) {
    if (!user) return
    try {
      await upsertClub(user.id, {
        id: c.id,
        name: c.name,
        club_type: c.club_type,
        loft: c.loft,
        typical_distance_yards: c.typical_distance_yards,
        sort_order: c.sort_order,
        in_bag: !c.in_bag,
      })
      await refetch()
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message)
    }
  }

  function confirmDelete(c: UserClub) {
    Alert.alert(`Delete ${c.name}?`, 'You can re-add it any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return
          try {
            await deleteClub(user.id, c.id)
            await refetch()
          } catch (e) {
            Alert.alert('Delete failed', (e as Error).message)
          }
        },
      },
    ])
  }

  function confirmReset() {
    Alert.alert(
      'Reset to default bag?',
      'This deletes every club and seeds the default 15-club bag.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!user) return
            try {
              await resetBag(user.id)
              await refetch()
            } catch (e) {
              Alert.alert('Reset failed', (e as Error).message)
            }
          },
        },
      ],
    )
  }

  // Postgres `numeric` accepts the string 'NaN' as a valid value, which
  // would corrupt downstream stat math. Filter to finite numbers only.
  function parseNumOrNull(s: string): number | null {
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  async function handleAdd() {
    if (!user) return
    if (!draft.name.trim()) {
      Alert.alert('Name is required')
      return
    }
    if (!draft.clubType.trim()) {
      Alert.alert('Club type is required')
      return
    }
    if (draft.loft && !Number.isFinite(Number(draft.loft))) {
      Alert.alert('Loft must be a number')
      return
    }
    if (
      draft.typicalDistance &&
      !Number.isFinite(Number(draft.typicalDistance))
    ) {
      Alert.alert('Typical distance must be a number')
      return
    }
    try {
      const maxSort = bag.reduce((m, c) => Math.max(m, c.sort_order), -1)
      await upsertClub(user.id, {
        name: draft.name.trim(),
        club_type: draft.clubType.trim().toLowerCase(),
        loft: parseNumOrNull(draft.loft),
        typical_distance_yards: parseNumOrNull(draft.typicalDistance),
        sort_order: maxSort + 1,
        in_bag: true,
      })
      await refetch()
      setDraft(EMPTY_DRAFT)
      setShowAdd(false)
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message)
    }
  }

  async function onDragEnd(reordered: UserClub[]) {
    if (!user) return
    try {
      await reorderClubs(
        user.id,
        reordered.map((c) => c.id),
      )
    } catch (e) {
      Alert.alert('Reorder failed', (e as Error).message)
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow="Equipment"
        title="My bag."
        right={
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={10}
          >
            <Text
              style={{
                color: 'rgba(242,238,229,0.75)',
                fontSize: 13,
              }}
            >
              ← Back
            </Text>
          </Pressable>
        }
      />
      {isLoading && (
        <View style={{ padding: 24 }}>
          <Text style={{ color: '#5C6356', fontSize: 14 }}>Loading bag…</Text>
        </View>
      )}
      {error && (
        <View style={{ padding: 24 }}>
          <Text style={{ color: '#A33A2A', fontSize: 14 }}>
            Could not load bag: {error.message}
          </Text>
        </View>
      )}
      {!isLoading && !error && (
        <DraggableFlatList
          data={bag}
          keyExtractor={(c) => c.id}
          onDragEnd={({ data }) => onDragEnd(data)}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: '#5C6356', fontSize: 14, marginBottom: 6 }}>
                Add the clubs you carry. Only these clubs appear when logging
                shots.
              </Text>
              <Text style={{ color: '#8A8B7E', fontSize: 12 }}>
                Hold a club to drag it. Benched clubs stay saved but are
                hidden from the shot logger.
              </Text>
            </View>
          }
          renderItem={({ item, drag, isActive }: RenderItemParams<UserClub>) => (
            <ClubRow
              club={item}
              isActive={isActive}
              onLongPress={drag}
              onToggle={() => toggleInBag(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ListFooterComponent={
            <View style={{ marginTop: 22, gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add club"
                onPress={() => setShowAdd(true)}
                style={{
                  backgroundColor: '#1F3D2C',
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text
                  style={{ color: '#F2EEE5', fontSize: 14, fontWeight: '600' }}
                >
                  Add club →
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset to default bag"
                onPress={confirmReset}
                style={{
                  borderWidth: 1,
                  borderColor: '#1F3D2C',
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text style={{ color: '#1F3D2C', fontSize: 13 }}>
                  Reset to default bag
                </Text>
              </Pressable>
            </View>
          }
        />
      )}

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(28,33,28,0.55)',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{
              backgroundColor: '#FBF8F1',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
            contentContainerStyle={{ padding: 18, paddingBottom: 28 }}
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
            <Text style={{ ...KICKER, marginBottom: 4 }}>New club</Text>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 22,
                fontWeight: '500',
                fontStyle: 'italic',
                marginBottom: 18,
              }}
            >
              Add to bag.
            </Text>

            <Field label="Category">
              <CategoryRow
                value={draft.category}
                onChange={(c) =>
                  setDraft((d) => ({
                    ...d,
                    category: c,
                    clubType:
                      c === 'utility'
                        ? d.clubType
                        : CANONICAL_BY_CATEGORY[c][0] ?? '',
                  }))
                }
              />
            </Field>

            <Field label="Club type">
              {draft.category === 'utility' ? (
                <TextInput
                  value={draft.clubType}
                  onChangeText={(v) => setDraft((d) => ({ ...d, clubType: v }))}
                  placeholder="e.g. chipper, mini_driver, aw"
                  style={inputStyle}
                  autoCapitalize="none"
                />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {CANONICAL_BY_CATEGORY[draft.category].map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      active={draft.clubType === c}
                      onPress={() => setDraft((d) => ({ ...d, clubType: c }))}
                    />
                  ))}
                </View>
              )}
            </Field>

            <Field label="Display name">
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="e.g. 7 Iron, Stealth Driver, 60° Lob"
                style={inputStyle}
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Loft (°)">
                  <TextInput
                    value={draft.loft}
                    onChangeText={(v) => setDraft((d) => ({ ...d, loft: v }))}
                    keyboardType="decimal-pad"
                    placeholder="optional"
                    style={inputStyle}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Typical (yd)">
                  <TextInput
                    value={draft.typicalDistance}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, typicalDistance: v }))
                    }
                    keyboardType="numeric"
                    placeholder="optional"
                    style={inputStyle}
                  />
                </Field>
              </View>
            </View>

            <Text style={{ color: '#8A8B7E', fontSize: 12, marginTop: 6 }}>
              Category will default to{' '}
              {CLUB_CATEGORY_LABELS[clubCategoryFor(draft.clubType)]} based on
              the club_type you chose.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              <Pressable
                onPress={handleAdd}
                style={{
                  flex: 1,
                  backgroundColor: '#1F3D2C',
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text
                  style={{ color: '#F2EEE5', fontSize: 14, fontWeight: '600' }}
                >
                  Add to bag →
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowAdd(false)
                  setDraft(EMPTY_DRAFT)
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#5C6356', fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  )
}

function ClubRow({
  club,
  isActive,
  onLongPress,
  onToggle,
  onDelete,
}: {
  club: UserClub
  isActive: boolean
  onLongPress: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#D9D2BF',
        backgroundColor: isActive ? '#EBE5D6' : '#F2EEE5',
      }}
    >
      <Pressable
        onLongPress={onLongPress}
        accessibilityLabel="Drag to reorder"
        hitSlop={8}
        style={{ paddingHorizontal: 6 }}
      >
        <Text style={{ color: '#8A8B7E', fontSize: 16 }}>⠿</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#1C211C', fontSize: 16, fontWeight: '500' }}>
          {club.name}
        </Text>
        <Text style={{ ...KICKER, marginTop: 2 }}>
          {club.club_type}
          {club.loft != null ? ` · ${club.loft}°` : ''}
          {club.typical_distance_yards != null
            ? ` · ${club.typical_distance_yards} yd`
            : ''}
        </Text>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={club.in_bag ? 'Bench club' : 'Put in bag'}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: '#D9D2BF',
          backgroundColor: club.in_bag ? '#1F3D2C' : 'transparent',
        }}
      >
        <Text
          style={{
            color: club.in_bag ? '#F2EEE5' : '#5C6356',
            fontSize: 10,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            fontWeight: '500',
          }}
        >
          {club.in_bag ? 'In bag' : 'Benched'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete ${club.name}`}
        hitSlop={8}
        style={{ paddingHorizontal: 4 }}
      >
        <Text style={{ color: '#A33A2A', fontSize: 12 }}>Delete</Text>
      </Pressable>
    </View>
  )
}

function CategoryRow({
  value,
  onChange,
}: {
  value: ClubCategory
  onChange: (v: ClubCategory) => void
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {CLUB_CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={CLUB_CATEGORY_LABELS[c]}
          active={value === c}
          onPress={() => onChange(c)}
        />
      ))}
    </View>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 2,
      }}
    >
      <Text
        style={{
          color: active ? '#F2EEE5' : '#1C211C',
          fontSize: 12,
          fontWeight: active ? '500' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  )
}

const inputStyle: import('react-native').TextStyle = {
  borderWidth: 1,
  borderColor: '#D9D2BF',
  backgroundColor: '#FBF8F1',
  borderRadius: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  fontSize: 14,
  color: '#1C211C',
}

