import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CANONICAL_CLUBS_BY_CATEGORY,
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  clubCategoryFor,
  clubTypicalDistance,
  formatClubLabel,
  type Club,
  type ClubCategory,
} from '@oga/core'
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AppBar } from '../../components/ui/AppBar'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { FONT_CAP, P, R } from '../../components/paper/tokens'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useClubDispersion } from '../../components/round/hole/useClubDispersion'
import {
  deleteClub,
  reorderClubs,
  resetBag,
  upsertClub,
  useUserBag,
  type UserClub,
} from '../../hooks/useUserBag'

const META: import('react-native').TextStyle = { ...TYPE.body, color: P.inkDim, fontSize: 12 }

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
  const insets = useSafeAreaInsets()
  const formScrollRef = useRef<ScrollView>(null)
  const { user } = useAuth()
  const { bag, isLoading, error, refetch } = useUserBag({
    includeBenched: true,
    seedIfEmpty: true,
  })
  // Count per club_type once — the row's "show loft to disambiguate" flag is
  // an O(1) lookup instead of a full-bag scan per row on every list render
  // (incl. every drag frame).
  const clubTypeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of bag) m.set(c.club_type, (m.get(c.club_type) ?? 0) + 1)
    return m
  }, [bag])
  // Typical distance per row: measured from the player's shots once a club
  // has enough of them (the live wheel's rule), else the typed estimate (#1052).
  const { byClub } = useClubDispersion(user?.id)
  const { toDisplay } = useUnits()
  function distanceLabel(c: UserClub): string {
    const d = byClub.get(c.club_type as Club)
    const shots = d?.points.length ?? 0
    const t = clubTypicalDistance(d?.medianDistanceYards, shots, c.typical_distance_yards)
    if (!t) return ''
    return ` · ${toDisplay(t.yards)} · ${t.source === 'shots' ? `from ${shots} shots` : 'estimate'}`
  }
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<AddDraft>(EMPTY_DRAFT)
  // Set to a club id when the modal is editing an existing row; null when
  // it's adding a new club. The modal renders the same form either way;
  // only the upsert payload differs.
  const [editingId, setEditingId] = useState<string | null>(null)
  // Lets the user enter a free-text club_type when the canonical chip
  // list for the chosen category doesn't cover what they carry.
  const [customMode, setCustomMode] = useState(false)

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
      'This deletes every club and seeds the default 14-club bag.',
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

  function startEdit(c: UserClub) {
    setDraft({
      name: c.name,
      category: clubCategoryFor(c.club_type),
      clubType: c.club_type,
      loft: c.loft != null ? String(c.loft) : '',
      typicalDistance:
        c.typical_distance_yards != null ? String(c.typical_distance_yards) : '',
    })
    setEditingId(c.id)
    setShowAdd(true)
  }

  function closeForm() {
    setShowAdd(false)
    setEditingId(null)
    setCustomMode(false)
    setDraft(EMPTY_DRAFT)
  }

  async function handleSave() {
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
      const existing = editingId ? bag.find((c) => c.id === editingId) : null
      const sortOrder = existing
        ? existing.sort_order
        : bag.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1
      // Editing an existing row keeps club_type fixed — that's the
      // canonical id for stats joins. Only edit name/loft/typical here.
      await upsertClub(user.id, {
        ...(editingId ? { id: editingId } : {}),
        name: draft.name.trim(),
        club_type: existing
          ? existing.club_type
          : draft.clubType.trim().toLowerCase(),
        loft: parseNumOrNull(draft.loft),
        typical_distance_yards: parseNumOrNull(draft.typicalDistance),
        sort_order: sortOrder,
        in_bag: existing ? existing.in_bag : true,
      })
      await refetch()
      closeForm()
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
      <PaperSurface style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
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
              style={[TYPE.body, {
                color: 'rgba(242,238,229,0.75)',
                fontSize: 13,
              }]}
            >
              ← Back
            </Text>
          </Pressable>
        }
      />
      {isLoading && (
        <View style={{ padding: 24 }}>
          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14 }]}>Loading bag…</Text>
        </View>
      )}
      {error && (
        <View style={{ padding: 24 }}>
          <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 14 }]}>
            Could not load bag: {error.message}
          </Text>
        </View>
      )}
      {!isLoading && !error && (
        <DraggableFlatList
          data={bag}
          keyExtractor={(c) => c.id}
          onDragEnd={({ data }) => onDragEnd(data)}
          // The list is the last child of a flex:1 root next to the AppBar.
          // Without a bounded height it sizes to content and pushes the
          // footer (Add club / Reset to default bag) off-screen with no
          // scroll — react-native-draggable-flatlist needs flex:1 here (#528).
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 18 }}>
              <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, marginBottom: 6 }]}>
                Add the clubs you carry. Only these clubs appear when logging
                shots.
              </Text>
              <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12 }]}>
                Hold a club to drag it. Benched clubs stay saved but are
                hidden from the shot logger.
              </Text>
            </View>
          }
          renderItem={({ item, drag, isActive }: RenderItemParams<UserClub>) => (
            <ClubRow
              club={item}
              isActive={isActive}
              hasDuplicateType={(clubTypeCounts.get(item.club_type) ?? 0) > 1}
              distance={distanceLabel(item)}
              onLongPress={drag}
              onToggle={() => toggleInBag(item)}
              onDelete={() => confirmDelete(item)}
              onEdit={() => startEdit(item)}
            />
          )}
          ListFooterComponent={
            <View style={{ marginTop: 22, gap: 12 }}>
              <Key
                tone="primary"
                accessibilityLabel="Add club"
                onPress={() => setShowAdd(true)}
                faceStyle={{ minHeight: 48 }}
              >
                <KeyText tone="primary" bold>
                  Add club →
                </KeyText>
              </Key>
              <Key
                accessibilityLabel="Reset to default bag"
                onPress={confirmReset}
                faceStyle={{ minHeight: 44 }}
              >
                <KeyText size={13}>Reset to default bag</KeyText>
              </Key>
            </View>
          }
        />
      )}

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        {/* iOS: padding lifts the sheet above the keyboard (Android pans). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(28,33,28,0.55)',
          }}
        >
          <ScrollView
            ref={formScrollRef}
            // The sheet shrinks when the keyboard opens but keeps offset 0, so
            // the fields + Save sat under the fold. The inputs are the sheet's
            // last rows, so scrolling to the end shows the focused one + Save.
            onLayout={() => {
              if (TextInput.State.currentlyFocusedInput()) formScrollRef.current?.scrollToEnd({ animated: false })
            }}
            keyboardShouldPersistTaps="handled"
            style={{
              backgroundColor: P.raised,
              borderTopLeftRadius: R,
              borderTopRightRadius: R,
              borderTopWidth: 1,
              borderColor: P.ink,
            }}
            contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 28 }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 32,
                height: 4,
                borderRadius: 2,
                backgroundColor: P.line,
                marginBottom: 14,
              }}
            />
            <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, marginBottom: 4 }}>
              {editingId ? 'Edit club' : 'New club'}
            </Text>
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[TYPE.serif, {
                color: P.ink,
                fontSize: 22,
                marginBottom: 18,
              }]}
            >
              {editingId ? 'Edit club.' : 'Add to bag.'}
            </Text>

            {!editingId && (
              <>
                <Field label="Category">
                  <CategoryRow
                    value={draft.category}
                    onChange={(c) => {
                      setCustomMode(false)
                      setDraft((d) => ({
                        ...d,
                        category: c,
                        clubType:
                          c === 'utility'
                            ? d.clubType
                            : CANONICAL_CLUBS_BY_CATEGORY[c][0] ?? '',
                      }))
                    }}
                  />
                </Field>

                <Field label="Club type">
                  {draft.category === 'utility' || customMode ? (
                    <View style={{ gap: 6 }}>
                      <TextInput
                        value={draft.clubType}
                        onChangeText={(v) =>
                          setDraft((d) => ({ ...d, clubType: v }))
                        }
                        placeholder="e.g. chipper, attack wedge, 1.5 hybrid"
                        style={inputStyle}
                        autoCapitalize="none"
                      />
                      {customMode && draft.category !== 'utility' && (
                        <Pressable
                          onPress={() => {
                            setCustomMode(false)
                            setDraft((d) => ({
                              ...d,
                              clubType:
                                CANONICAL_CLUBS_BY_CATEGORY[d.category][0] ?? '',
                            }))
                          }}
                        >
                          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12 }]}>
                            ← Back to {CLUB_CATEGORY_LABELS[draft.category]} list
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                    >
                      {CANONICAL_CLUBS_BY_CATEGORY[draft.category].map((c) => (
                        <Chip
                          key={c}
                          label={formatClubLabel({ club_type: c })}
                          active={draft.clubType === c}
                          onPress={() =>
                            setDraft((d) => ({ ...d, clubType: c }))
                          }
                        />
                      ))}
                      <Chip
                        label="Other…"
                        active={false}
                        onPress={() => {
                          setCustomMode(true)
                          setDraft((d) => ({ ...d, clubType: '' }))
                        }}
                      />
                    </View>
                  )}
                </Field>
              </>
            )}

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

            {!editingId && (
              <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12, marginTop: 6 }]}>
                Category will default to{' '}
                {CLUB_CATEGORY_LABELS[clubCategoryFor(draft.clubType)]} based on
                the club_type you chose.
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              <Key
                tone="primary"
                accessibilityLabel={editingId ? 'Save changes →' : 'Add to bag →'}
                onPress={handleSave}
                style={{ flex: 1 }}
                faceStyle={{ minHeight: 48 }}
              >
                <KeyText tone="primary" bold>
                  {editingId ? 'Save changes →' : 'Add to bag →'}
                </KeyText>
              </Key>
              <Key accessibilityLabel="Cancel" onPress={closeForm} faceStyle={{ minHeight: 48, paddingHorizontal: 18 }}>
                <KeyText size={13}>Cancel</KeyText>
              </Key>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </GestureHandlerRootView>
  )
}

function ClubRow({
  club,
  isActive,
  hasDuplicateType,
  distance,
  onLongPress,
  onToggle,
  onDelete,
  onEdit,
}: {
  club: UserClub
  isActive: boolean
  hasDuplicateType: boolean
  /** " · 152 yd · from 23 shots", or "" when the club has no distance. */
  distance: string
  onLongPress: () => void
  onToggle: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: P.line,
        backgroundColor: isActive ? P.well : P.chrome,
      }}
    >
      <Pressable
        onLongPress={onLongPress}
        accessibilityLabel="Drag to reorder"
        hitSlop={8}
        style={{ paddingHorizontal: 6 }}
      >
        <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 16 }]}>⠿</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 16 }]}>
          {club.name}
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={{ ...META, marginTop: 2 }}>
          {formatClubLabel(club, { hasDuplicateType })}
          {club.loft != null &&
          club.club_type !== 'cw' &&
          club.club_type !== 'custom_wedge' &&
          !hasDuplicateType
            ? ` · ${club.loft}°`
            : ''}
          {distance}
        </Text>
      </View>
      <Key
        onPress={onToggle}
        accessibilityLabel={club.in_bag ? 'Bench club' : 'Put in bag'}
        latched={club.in_bag}
        faceStyle={{ minHeight: 30, paddingHorizontal: 10 }}
      >
        <KeyText size={12} bold={club.in_bag}>
          {club.in_bag ? 'In bag' : 'Benched'}
        </KeyText>
      </Key>
      <Pressable
        onPress={onEdit}
        accessibilityLabel={`Edit ${club.name}`}
        hitSlop={8}
        style={{ paddingHorizontal: 4 }}
      >
        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12 }]}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityLabel={`Delete ${club.name}`}
        hitSlop={8}
        style={{ paddingHorizontal: 4 }}
      >
        <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 12 }]}>Delete</Text>
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
    <Key accessibilityLabel={label} latched={active} onPress={onPress} faceStyle={{ minHeight: 36, paddingHorizontal: 10 }}>
      <KeyText size={12} bold={active}>
        {label}
      </KeyText>
    </Key>
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
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>
        {label}
      </Text>
      {children}
    </View>
  )
}

const inputStyle: import('react-native').TextStyle = {
  ...TYPE.body,
  borderWidth: 1,
  borderColor: P.ink,
  backgroundColor: P.raised,
  borderRadius: R,
  paddingHorizontal: 10,
  paddingVertical: 8,
  fontSize: 14,
  color: P.ink,
}

