import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { getCourseTees, updateRound, upsertCourseTees } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { FONT, TYPE } from '../../lib/typography'

type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

const KICKER: import('react-native').TextStyle = {
  fontFamily: FONT.mono,
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// Presentational tee picker: lists a course's tees and lets the player add
// one (rating/slope/yards). Selection is reported via `onSelect` — it does
// NOT persist anything to a round, so it works both before a round exists
// (round/new.tsx setup step) and against an existing round (the scorecard
// wrapper below). Adding a tee creates a course-level `course_tees` row and
// immediately selects it. `busy` lets a caller disable the list while it
// persists the selection elsewhere.
export function TeePicker({
  courseId,
  selectedTeeId,
  onSelect,
  busy = false,
}: {
  courseId: string
  selectedTeeId: string | null
  onSelect: (tee: { id: string; tee_color: string }) => void
  busy?: boolean
}) {
  const [tees, setTees] = useState<CourseTeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addBusy, setAddBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await getCourseTees(supabase, courseId)
        if (active) {
          setTees(data ?? [])
          setLoading(false)
        }
      } catch {
        // Network failure: drop to an empty list rather than stranding the
        // component on "Loading tees…" with an unhandled rejection.
        if (active) {
          setTees([])
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  async function addTee(vals: {
    color: string
    rating: number | null
    slope: number | null
    yards: number | null
  }) {
    setAddBusy(true)
    try {
      const { data, error } = await upsertCourseTees(supabase, [
        {
          course_id: courseId,
          tee_color: vals.color.toLowerCase(),
          course_rating: vals.rating,
          slope_rating: vals.slope,
          total_yards: vals.yards,
        },
      ])
      if (error) throw error
      const created = (data ?? [])[0] as CourseTeeRow | undefined
      if (!created) throw new Error('Tee not created')
      setTees((prev) => {
        const without = prev.filter((t) => t.id !== created.id)
        return [...without, created]
      })
      setAdding(false)
      onSelect({ id: created.id, tee_color: created.tee_color })
    } catch (e) {
      Alert.alert('Could not add tee', (e as Error).message)
    } finally {
      setAddBusy(false)
    }
  }

  const disabled = busy || addBusy

  if (loading) {
    return (
      <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 13 }]}>Loading tees…</Text>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      {tees.map((t) => {
        const active = selectedTeeId === t.id
        const hasRating = t.course_rating != null && t.slope_rating != null
        return (
          <Pressable
            key={t.id}
            onPress={() => onSelect({ id: t.id, tee_color: t.tee_color })}
            disabled={disabled}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              backgroundColor: active ? '#1F3D2C' : '#FBF8F1',
              borderWidth: 1,
              borderColor: active ? '#1F3D2C' : '#D9D2BF',
              borderRadius: 2,
              paddingVertical: 12,
              paddingHorizontal: 14,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text
              style={[TYPE.serif, {
                color: active ? '#F2EEE5' : '#1C211C',
                fontSize: 16,
                fontStyle: 'italic',
                fontWeight: '500',
                textTransform: 'capitalize',
              }]}
            >
              {t.tee_color}
            </Text>
            <Text
              style={{
                ...KICKER,
                color: active ? 'rgba(242,238,229,0.75)' : '#5C6356',
              }}
            >
              {hasRating ? `${t.course_rating?.toFixed(1)} / ${t.slope_rating}` : 'No rating'}
            </Text>
          </Pressable>
        )
      })}

      {adding ? (
        <AddTeeForm busy={addBusy} onCancel={() => setAdding(false)} onSubmit={addTee} />
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          disabled={disabled}
          style={{
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderStyle: 'dashed',
            borderRadius: 2,
            paddingVertical: 11,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>+ Add tee</Text>
        </Pressable>
      )}
    </View>
  )
}

// Scorecard wrapper: a labelled section that persists the picked tee onto
// the round (course_tee_id + tee_color) so the finalize pass can compute a
// WHS score differential. A tee with course rating + slope is the one input
// the crawler can't supply, so the player records it here.
export function RoundTeeSelector({
  courseId,
  roundId,
  userId,
  currentTeeId,
  onChange,
}: {
  courseId: string
  roundId: string
  userId: string
  currentTeeId: string | null
  onChange: (tee: { id: string; color: string }) => void
}) {
  const [busy, setBusy] = useState(false)

  async function persist(tee: { id: string; tee_color: string }) {
    setBusy(true)
    try {
      const { error } = await updateRound(
        supabase,
        roundId,
        { course_tee_id: tee.id, tee_color: tee.tee_color },
        userId,
      )
      if (error) throw error
      onChange({ id: tee.id, color: tee.tee_color })
    } catch (e) {
      Alert.alert('Could not set tee', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingTop: 14,
        marginTop: 8,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 4 }}>Tee played</Text>
      <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12, marginBottom: 12 }]}>
        Add the tee's rating and slope to get a handicap differential.
      </Text>
      <TeePicker
        courseId={courseId}
        selectedTeeId={currentTeeId}
        onSelect={persist}
        busy={busy}
      />
    </View>
  )
}

function AddTeeForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  onCancel: () => void
  onSubmit: (vals: {
    color: string
    rating: number | null
    slope: number | null
    yards: number | null
  }) => void
}) {
  const [color, setColor] = useState('white')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [yards, setYards] = useState('')

  // Postgres numeric accepts 'NaN'; filter to finite to avoid poisoning the
  // differential math (mirrors the bag form's parseNumOrNull).
  function num(s: string): number | null {
    if (!s.trim()) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#D9D2BF',
        borderRadius: 2,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ ...KICKER }}>Add tee</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TeeField label="Color" value={color} onChangeText={setColor} width="100%" autoCapitalize="none" />
        <TeeField label="Rating" value={rating} onChangeText={setRating} placeholder="71.2" keyboardType="decimal-pad" width="31%" />
        <TeeField label="Slope" value={slope} onChangeText={setSlope} placeholder="124" keyboardType="number-pad" width="31%" />
        <TeeField label="Yards" value={yards} onChangeText={setYards} placeholder="6450" keyboardType="number-pad" width="31%" />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Pressable
          onPress={onCancel}
          style={{
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
            paddingVertical: 9,
            paddingHorizontal: 14,
          }}
        >
          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13 }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            color.trim() &&
            onSubmit({ color, rating: num(rating), slope: num(slope), yards: num(yards) })
          }
          disabled={busy || !color.trim()}
          style={{
            backgroundColor: busy || !color.trim() ? '#9F9580' : '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 9,
            paddingHorizontal: 16,
          }}
        >
          <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 13, fontWeight: '600' }]}>
            {busy ? 'Saving…' : 'Add tee'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function TeeField({
  label,
  width,
  ...input
}: {
  label: string
  width: import('react-native').DimensionValue
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ width, gap: 4 }}>
      <Text style={{ ...KICKER, fontSize: 9 }}>{label}</Text>
      <TextInput
        {...input}
        style={[TYPE.body, {
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 2,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 14,
          color: '#1C211C',
        }]}
      />
    </View>
  )
}
