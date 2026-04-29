import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'

type RoundRow = Database['public']['Tables']['rounds']['Row'] & {
  courses?: { name: string | null } | null
}

export default function Home() {
  const { user } = useAuth()
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('rounds')
      .select('*, courses(name)')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (active) setRounds((data ?? []) as RoundRow[])
      })
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    pendingCount().then(setPending)
    syncPendingShots()
      .then(() => pendingCount().then(setPending))
      .catch(() => undefined)
  }, [])

  return (
    <ScrollView className="flex-1 bg-fairway-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-fairway-700">OGA</Text>
      <Text className="mb-4 text-sm text-gray-500">Live round tracker</Text>

      <Link href="/(app)/round/new" asChild>
        <Pressable className="mb-4 items-center rounded-lg bg-fairway-500 py-4">
          <Text className="text-base font-semibold text-white">+ Start round</Text>
        </Pressable>
      </Link>

      {pending > 0 && (
        <View className="mb-4 rounded bg-amber-50 p-3">
          <Text className="text-sm text-amber-900">
            {pending} shot{pending === 1 ? '' : 's'} waiting to sync
          </Text>
        </View>
      )}

      <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
        Recent rounds
      </Text>
      {rounds.length === 0 ? (
        <Text className="text-sm text-gray-500">No rounds yet.</Text>
      ) : (
        rounds.map((r) => (
          <Link key={r.id} href={`/(app)/round/${r.id}`} asChild>
            <Pressable className="mb-2 rounded bg-white px-4 py-3">
              <Text className="font-medium text-gray-900">
                {r.courses?.name ?? 'Round'}
              </Text>
              <Text className="text-xs text-gray-500">
                {r.played_at}
                {r.total_score ? ` · ${r.total_score}` : ''}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  )
}
