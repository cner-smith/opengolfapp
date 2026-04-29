import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { FACILITIES, GOALS, SKILL_LEVELS } from '@oga/core'
import { getProfile, updateProfile } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type Profile = Database['public']['Tables']['profiles']['Row']
type SkillLevel = Profile['skill_level']
type Goal = Profile['goal']

export default function ProfileTab() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [skill, setSkill] = useState<SkillLevel>(null)
  const [goal, setGoal] = useState<Goal>(null)
  const [facilities, setFacilities] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data }) => {
      if (!active || !data) return
      setProfile(data)
      setUsername(data.username ?? '')
      setHandicap(data.handicap_index?.toString() ?? '')
      setSkill(data.skill_level ?? null)
      setGoal(data.goal ?? null)
      setFacilities(data.facilities ?? [])
    })
    return () => {
      active = false
    }
  }, [user?.id])

  async function save() {
    if (!user) return
    const numericHandicap = handicap === '' ? null : Number(handicap)
    if (handicap !== '' && Number.isNaN(numericHandicap)) {
      Alert.alert('Handicap must be a number')
      return
    }
    setSaving(true)
    const { data, error } = await updateProfile(supabase, user.id, {
      username: username || null,
      handicap_index: numericHandicap,
      skill_level: skill,
      goal,
      facilities,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Save failed', error.message)
      return
    }
    if (data) setProfile(data)
    Alert.alert('Saved', 'Profile updated. SG benchmarks will use the new handicap.')
  }

  function toggleFacility(f: string) {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  return (
    <ScrollView className="flex-1 bg-fairway-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-4 text-xl font-bold text-fairway-700">Profile</Text>

      <Field label="Username">
        <TextInput
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          className="rounded border border-gray-200 bg-white px-3 py-2"
        />
      </Field>

      <Field label="Handicap index">
        <TextInput
          keyboardType="decimal-pad"
          value={handicap}
          onChangeText={setHandicap}
          className="rounded border border-gray-200 bg-white px-3 py-2"
        />
      </Field>

      <Field label="Skill level">
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {SKILL_LEVELS.map((s) => (
            <Chip
              key={s}
              label={s}
              active={skill === s}
              onPress={() => setSkill(s)}
            />
          ))}
        </View>
      </Field>

      <Field label="Goal">
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {GOALS.map((g) => (
            <Chip key={g} label={g.replace('_', ' ')} active={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>
      </Field>

      <Field label="Facilities">
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {FACILITIES.map((f) => (
            <Chip
              key={f}
              label={f.replace('_', ' ')}
              active={facilities.includes(f)}
              onPress={() => toggleFacility(f)}
            />
          ))}
        </View>
      </Field>

      <Pressable
        onPress={save}
        disabled={saving}
        className="mt-2 items-center rounded-lg bg-fairway-500 py-3"
      >
        <Text className="text-base font-semibold text-white">
          {saving ? 'Saving…' : 'Save changes'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => supabase.auth.signOut()}
        className="mt-3 items-center rounded border border-gray-200 py-3"
      >
        <Text className="text-sm text-gray-600">Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">{label}</Text>
      {children}
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
      className={
        active
          ? 'rounded-full bg-fairway-500 px-3 py-1.5'
          : 'rounded-full border border-gray-200 bg-white px-3 py-1.5'
      }
    >
      <Text
        className={active ? 'text-xs font-semibold text-white' : 'text-xs text-gray-700'}
      >
        {label}
      </Text>
    </Pressable>
  )
}
