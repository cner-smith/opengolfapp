import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  createCourse,
  createHoles,
  createRound,
  defaultHolesForCourse,
  searchCourses,
  upsertHoleScore,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

type CourseRow = Database['public']['Tables']['courses']['Row']

export default function NewRound() {
  const { user } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingCourseName, setCreatingCourseName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    searchCourses(supabase, query, 20).then(({ data }: { data: any }) => {
      if (!active) return
      setResults(data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [query])

  async function startWith(courseId: string) {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: round, error: roundError } = await createRound(supabase, {
        user_id: user.id,
        course_id: courseId,
        played_at: today,
      })
      if (roundError || !round) throw roundError ?? new Error('Round insert failed')

      const { data: holes, error: holesError } = await supabase
        .from('holes')
        .select('id, number, par')
        .eq('course_id', courseId)
        .order('number')
      if (holesError) throw holesError

      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (holes ?? []).map((h: any) =>
          upsertHoleScore(supabase, {
            round_id: round.id,
            hole_id: h.id,
            score: 0,
          }),
        ),
      )

      router.replace(`/(app)/round/${round.id}/hole/1`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addNewCourse() {
    const name = creatingCourseName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const { data: course, error: courseError } = await createCourse(supabase, { name })
      if (courseError || !course) throw courseError ?? new Error('Course insert failed')
      const { error: holesError } = await createHoles(supabase, defaultHolesForCourse(course.id))
      if (holesError) throw holesError
      setCreatingCourseName('')
      await startWith(course.id)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F4F0', padding: 16 }}>
      <Text
        style={{
          color: '#111111',
          fontSize: 22,
          fontWeight: '600',
          marginBottom: 12,
        }}
      >
        Start a round
      </Text>
      <TextInput
        placeholder="Search course…"
        value={query}
        onChangeText={setQuery}
        style={{
          backgroundColor: '#F9F9F6',
          borderWidth: 0.5,
          borderColor: '#E4E4E0',
          borderRadius: 7,
          paddingHorizontal: 10,
          paddingVertical: 9,
          fontSize: 13,
          marginBottom: 8,
        }}
      />
      {loading && <ActivityIndicator color="#1D9E75" style={{ marginVertical: 8 }} />}
      <FlatList
        data={results}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => startWith(item.id)}
            disabled={busy}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 0.5,
              borderColor: '#E4E4E0',
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: '#111111', fontSize: 14, fontWeight: '500' }}>
              {item.name}
            </Text>
            {item.location && (
              <Text style={{ color: '#888880', fontSize: 11 }}>{item.location}</Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <Text style={{ color: '#888880', fontSize: 13 }}>No courses found.</Text>
          )
        }
      />

      <View
        style={{
          marginTop: 14,
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          borderWidth: 0.5,
          borderColor: '#E4E4E0',
          padding: 14,
        }}
      >
        <Text
          style={{
            color: '#888880',
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Add a new course
        </Text>
        <TextInput
          placeholder="Course name"
          value={creatingCourseName}
          onChangeText={setCreatingCourseName}
          style={{
            backgroundColor: '#F9F9F6',
            borderWidth: 0.5,
            borderColor: '#E4E4E0',
            borderRadius: 7,
            paddingHorizontal: 10,
            paddingVertical: 9,
            fontSize: 13,
            marginBottom: 8,
          }}
        />
        <Pressable
          onPress={addNewCourse}
          disabled={busy || !creatingCourseName.trim()}
          style={{
            backgroundColor: '#111111',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: busy || !creatingCourseName.trim() ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
            {busy ? 'Working…' : 'Create course + start round'}
          </Text>
        </Pressable>
        <Text style={{ color: '#888880', fontSize: 11, marginTop: 6 }}>
          Creates an 18-hole par-72 layout you can edit later.
        </Text>
      </View>

      {error && (
        <View className="mt-3 rounded bg-red-50 p-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}
    </View>
  )
}
