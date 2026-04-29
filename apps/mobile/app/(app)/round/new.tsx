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
    searchCourses(supabase, query, 20).then(({ data }) => {
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
        (holes ?? []).map((h) =>
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
    <View className="flex-1 bg-fairway-50 p-4">
      <Text className="mb-3 text-xl font-bold text-fairway-700">Start a round</Text>
      <TextInput
        placeholder="Search course…"
        value={query}
        onChangeText={setQuery}
        className="mb-2 rounded bg-white px-3 py-2"
      />
      {loading && <ActivityIndicator className="my-2" />}
      <FlatList
        data={results}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => startWith(item.id)}
            disabled={busy}
            className="mb-2 rounded bg-white px-4 py-3"
          >
            <Text className="font-medium text-gray-900">{item.name}</Text>
            {item.location && <Text className="text-xs text-gray-500">{item.location}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <Text className="text-sm text-gray-500">No courses found.</Text>
          )
        }
      />

      <View className="mt-4 rounded-lg bg-white p-3">
        <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
          Add a new course
        </Text>
        <TextInput
          placeholder="Course name"
          value={creatingCourseName}
          onChangeText={setCreatingCourseName}
          className="mb-2 rounded border border-gray-200 px-3 py-2"
        />
        <Pressable
          onPress={addNewCourse}
          disabled={busy || !creatingCourseName.trim()}
          className="items-center rounded bg-fairway-500 py-3"
        >
          <Text className="font-semibold text-white">
            {busy ? 'Working…' : 'Create course + start round'}
          </Text>
        </Pressable>
        <Text className="mt-1 text-xs text-gray-500">
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
