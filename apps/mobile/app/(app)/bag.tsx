import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  bagGaps,
  clubTypicalDistance,
  distanceUnitAbbr,
  formatClubLabel,
  MIN_SAMPLES_FOR_STATS,
  wholeDistance,
  type Club,
  type ClubCategory,
  type DistanceUnit,
} from '@oga/core'
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AppBar } from '../../components/ui/AppBar'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { FONT_CAP, P, R } from '../../components/paper/tokens'
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useClubDispersion } from '../../components/round/hole/useClubDispersion'
import { GapChart, type ChartClub } from '../../components/bag/GapChart'
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
  const { unit } = useUnits()
  // Every in-bag club's typical distance and range, in the bag's own order;
  // core's bagGaps reads the holes, overlaps and the headline from them.
  const inBag = bag.filter((c) => c.in_bag)
  const benched = bag.filter((c) => !c.in_bag)
  const readings: Reading[] = inBag.map((c) => {
    const d = byClub.get(c.club_type as Club)
    const shots = d?.points.length ?? 0
    const typical = clubTypicalDistance(d?.medianDistanceYards, shots, c.typical_distance_yards)
    return { id: c.id, clubType: c.club_type, typical, range: typical?.source === 'shots' ? (d?.range ?? null) : null, shots }
  })
  const readingOf = new Map(readings.map((r) => [r.id, r]))
  const gaps = bagGaps(readings, unit)
  // The gap printed on the rule above a club: only between neighbours on the
  // card that both have a number.
  const gapAbove = new Map<string, { yards: number; widest: boolean }>()
  for (const g of gaps.gaps) {
    if (g.kind === 'not measured') continue
    const [i, j] = [inBag.findIndex((c) => c.id === g.longer.id), inBag.findIndex((c) => c.id === g.shorter.id)]
    if (Math.abs(i - j) !== 1) continue
    gapAbove.set(inBag[Math.max(i, j)]!.id, { yards: g.yards, widest: g === gaps.widest })
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
  const editingClub = editingId ? bag.find((c) => c.id === editingId) ?? null : null

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
        // The card drags only clubs in the bag; the bench keeps its place after them.
        [...reordered, ...bag.filter((c) => !c.in_bag)].map((c) => c.id),
      )
    } catch (e) {
      Alert.alert('Reorder failed', (e as Error).message)
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <PaperSurface style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <AppBar
        title="My bag"
        right={
          <PressableTouch
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={10}
          >
            <Text style={[TYPE.body, { color: 'rgba(242,238,229,0.75)', fontSize: 13 }]}>← Back</Text>
          </PressableTouch>
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
          data={inBag}
          keyExtractor={(c) => c.id}
          onDragEnd={({ data }) => onDragEnd(data)}
          // The list is the last child of a flex:1 root next to the AppBar.
          // Without a bounded height it sizes to content and pushes the
          // footer (Add club / Reset to default bag) off-screen with no
          // scroll — react-native-draggable-flatlist needs flex:1 here (#528).
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 18 }]}>
                {bag.length > 0
                  ? `${inBag.length} club${inBag.length === 1 ? '' : 's'} in the bag${benched.length ? `, ${benched.length} on the bench` : ''}. Only clubs in the bag show when you log a shot.`
                  : 'The clubs you carry. Only these show when you log a shot.'}
              </Text>
              <GapChart gaps={gaps} unit={unit} />
              {/* Top of the yardage card: title, then the column heads on an ink rule. */}
              <View style={[CARD_SIDES, { borderTopWidth: 1, paddingTop: 14 }]}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 20 }]}>Yardage card</Text>
                <View style={{ flexDirection: 'row', marginTop: 10, paddingBottom: 5, borderBottomWidth: 1.5, borderColor: P.ink }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { flex: 1, paddingLeft: HANDLE }]}>Club</Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { width: PLAYS, textAlign: 'right' }]}>Plays</Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { width: TYPICAL, textAlign: 'right' }]}>Typical, {distanceUnitAbbr(unit)}</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<UserClub>) => (
            <ClubRow
              club={item}
              first={getIndex() === 0}
              isActive={isActive}
              hasDuplicateType={(clubTypeCounts.get(item.club_type) ?? 0) > 1}
              reading={readingOf.get(item.id)}
              unit={unit}
              gap={gapAbove.get(item.id) ?? null}
              onLongPress={drag}
              onEdit={() => startEdit(item)}
            />
          )}
          ListFooterComponent={
            <View>
              <View style={[CARD_SIDES, { borderBottomWidth: 1, paddingTop: 10, paddingBottom: 14, borderTopWidth: inBag.length ? 1 : 0, borderTopColor: P.line }]}>
                {inBag.length === 0 ? (
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.inkDim, fontSize: 16, marginBottom: 8 }]}>
                    Every club is on the bench. Put one back to start the card.
                  </Text>
                ) : null}
                <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { lineHeight: 17 }]}>
                  Typical is the middle of your shots once a club has {MIN_SAMPLES_FOR_STATS}; before that, your own estimate in
                  italics. Plays is where two in three of its shots finish. The number on each rule is the gap between the two
                  clubs. Hold ⠿ to set the order of the club wheel; tap a club to edit it.
                </Text>
              </View>

              {benched.length > 0 ? (
                <View style={{ marginTop: 26 }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 20 }]}>On the bench</Text>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { marginTop: 2, marginBottom: 8 }]}>Saved, but hidden from the shot logger.</Text>
                  {benched.map((c) => (
                    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderColor: P.line }}>
                      <PressableTouch accessibilityRole="button" accessibilityLabel={`Edit ${c.name}`} onPress={() => startEdit(c)} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
                        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>{c.name}</Text>
                      </PressableTouch>
                      <PressableTouch accessibilityRole="button" accessibilityLabel={`Put ${c.name} in the bag`} onPress={() => toggleInBag(c)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink, fontSize: 13 }]}>Put in bag</Text>
                      </PressableTouch>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={{ marginTop: 22, gap: 12 }}>
                <Key tone="primary" accessibilityLabel="Add club" onPress={() => setShowAdd(true)} faceStyle={{ minHeight: 48 }}>
                  <KeyText tone="primary" bold>
                    Add club →
                  </KeyText>
                </Key>
                <PressableTouch accessibilityRole="button" accessibilityLabel="Reset to default bag" onPress={confirmReset} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>Reset to the default bag</Text>
                </PressableTouch>
              </View>
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
              {editingClub ? editingClub.name : 'Add to bag'}
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
                        <PressableTouch
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
                        </PressableTouch>
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
            {editingClub ? (
              // Bench and delete live with the club, so the card stays clean.
              // The sheet closes before the delete confirm (one modal at a time).
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <PressableTouch
                  accessibilityRole="button"
                  accessibilityLabel={editingClub.in_bag ? `Bench ${editingClub.name}` : `Put ${editingClub.name} in the bag`}
                  onPress={() => {
                    closeForm()
                    void toggleInBag(editingClub)
                  }}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink, fontSize: 14 }]}>
                    {editingClub.in_bag ? 'Bench it' : 'Put in bag'}
                  </Text>
                </PressableTouch>
                <PressableTouch
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${editingClub.name}`}
                  onPress={() => {
                    closeForm()
                    confirmDelete(editingClub)
                  }}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.neg, fontSize: 14 }]}>Delete</Text>
                </PressableTouch>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </GestureHandlerRootView>
  )
}

// One in-bag club for core's bagGaps, with its shot count for the card.
interface Reading extends ChartClub {
  shots: number
}

// The card's columns: drag handle, club, plays, typical.
const HANDLE = 26
const PLAYS = 68
const TYPICAL = 72
const CARD_SIDES: import('react-native').ViewStyle = {
  backgroundColor: P.raised,
  borderColor: P.lineStrong,
  borderLeftWidth: 1,
  borderRightWidth: 1,
  paddingHorizontal: 12,
}

// One club on the yardage card. The rule above it carries the gap to the club
// above, printed under the typical column. Tap opens the edit sheet; the
// handle drags.
function ClubRow({
  club,
  first,
  isActive,
  hasDuplicateType,
  reading,
  unit,
  gap,
  onLongPress,
  onEdit,
}: {
  club: UserClub
  first: boolean
  isActive: boolean
  hasDuplicateType: boolean
  /** Undefined only for a frame while the bag and the readings disagree. */
  reading: Reading | undefined
  unit: DistanceUnit
  /** Yards to the club above, when both have a number. */
  gap: { yards: number; widest: boolean } | null
  onLongPress: () => void
  onEdit: () => void
}) {
  // A putter has no yardage on the card.
  const t = club.club_type === 'putter' ? null : (reading?.typical ?? null)
  const typical = t ? wholeDistance(t.yards, unit) : null
  const estimate = t?.source === 'estimate'
  const plays = reading?.range ? `${wholeDistance(reading.range.low, unit)}–${wholeDistance(reading.range.high, unit)}` : ''
  const shots = reading?.shots ?? 0
  const meta = [
    formatClubLabel(club, { hasDuplicateType }),
    club.loft != null && club.club_type !== 'cw' && club.club_type !== 'custom_wedge' && !hasDuplicateType ? `${club.loft}°` : null,
    t?.source === 'shots' ? `${shots} shots` : estimate ? 'your estimate' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={[CARD_SIDES, { backgroundColor: isActive ? P.well : P.raised }]}>
      {/* The rule, with the gap set on it (inside the row so a list cell can't clip it). */}
      {!first ? (
        <View style={{ height: 14, justifyContent: 'center' }}>
          <View style={{ height: 1, backgroundColor: P.line }} />
          {gap != null ? (
            <View pointerEvents="none" style={{ position: 'absolute', right: 0, width: TYPICAL, alignItems: 'center' }}>
              <Text
                maxFontSizeMultiplier={FONT_CAP}
                accessibilityLabel={`${wholeDistance(gap.yards, unit)} ${distanceUnitAbbr(unit)} gap${gap.widest ? ', the widest' : ''}`}
                style={[
                  gap.widest ? TYPE.serif : TYPE.serifUpright,
                  { fontSize: 12, lineHeight: 14, paddingHorizontal: 5, color: gap.widest ? P.warn : P.inkDim, backgroundColor: P.raised },
                ]}
              >
                {wholeDistance(gap.yards, unit)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: 6 }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PressableTouch
          onLongPress={onLongPress}
          delayLongPress={180}
          accessibilityLabel={`Hold to drag ${club.name}`}
          hitSlop={8}
          style={{ width: HANDLE, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 15 }]}>⠿</Text>
        </PressableTouch>
        <PressableTouch
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${club.name}${typical != null ? `, typical ${typical}` : ''}`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44 }}
        >
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]} numberOfLines={1}>
              {club.name}
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[META, { marginTop: 1 }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { width: PLAYS, textAlign: 'right', fontSize: 13, color: P.inkDim }]}>
            {plays}
          </Text>
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[
              estimate ? TYPE.serif : TYPE.serifUpright,
              { width: TYPICAL, textAlign: 'right', fontSize: typical != null ? 28 : 20, lineHeight: 32, color: estimate || typical == null ? P.inkDim : P.ink },
            ]}
          >
            {typical ?? (club.club_type === 'putter' ? '' : '–')}
          </Text>
        </PressableTouch>
      </View>
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

