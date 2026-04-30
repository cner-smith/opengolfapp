import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { FACILITIES, GOALS, SKILL_LEVELS } from '@oga/core'
import { getProfile, updateProfile } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { AppBar } from '../../components/ui/AppBar'

type Profile = Database['public']['Tables']['profiles']['Row']
type SkillLevel = Profile['skill_level']
type Goal = Profile['goal']

export default function ProfileTab() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [skill, setSkill] = useState<SkillLevel>(null)
  const [goal, setGoal] = useState<Goal>(null)
  const [facilities, setFacilities] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        Alert.alert('Could not load profile', error.message)
        return
      }
      if (!data) return
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
  }, [authLoading, user?.id])

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
    <View style={{ flex: 1, backgroundColor: '#F4F4F0' }}>
      <AppBar
        eyebrow={profile?.username ? `@${profile.username}` : 'Account'}
        title="Profile"
      />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 0.5,
            borderColor: '#E4E4E0',
            borderRadius: 10,
            padding: 16,
            marginBottom: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#888880',
              fontSize: 11,
              fontWeight: '500',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Handicap index
          </Text>
          <Text
            style={{
              color: '#111111',
              fontSize: 36,
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
            }}
          >
            {profile?.handicap_index ?? '—'}
          </Text>
          <Text
            style={{ color: '#888880', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}
          >
            {profile?.skill_level ?? 'No skill level set'}
          </Text>
        </View>

        <Field label="Username">
          <TextInput
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            style={inputStyle}
          />
        </Field>

        <Field label="Handicap index">
          <TextInput
            keyboardType="decimal-pad"
            value={handicap}
            onChangeText={setHandicap}
            style={inputStyle}
          />
        </Field>

        <Field label="Skill level">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {GOALS.map((g) => (
              <Chip
                key={g}
                label={g.replace('_', ' ')}
                active={goal === g}
                onPress={() => setGoal(g)}
              />
            ))}
          </View>
        </Field>

        <Field label="Facilities">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
          style={{
            marginTop: 4,
            backgroundColor: '#111111',
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{
            marginTop: 10,
            backgroundColor: '#FFFFFF',
            borderWidth: 0.5,
            borderColor: '#E4E4E0',
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#888880', fontSize: 12 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const inputStyle = {
  backgroundColor: '#F9F9F6',
  borderWidth: 0.5,
  borderColor: '#E4E4E0',
  borderRadius: 7,
  paddingHorizontal: 10,
  paddingVertical: 9,
  fontSize: 13,
  color: '#111111',
} as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
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
        {label}
      </Text>
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
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
        borderWidth: 0.5,
        borderColor: active ? '#1D9E75' : '#E0E0DA',
      }}
    >
      <Text
        style={{
          color: active ? '#0F6E56' : '#111111',
          fontSize: 12,
          fontWeight: active ? '500' : '400',
          textTransform: 'capitalize',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
