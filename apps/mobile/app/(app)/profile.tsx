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

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getProfile(supabase, user.id).then(({ data, error }: { data: any; error: any }) => {
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
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow={profile?.username ? `@${profile.username}` : 'Account'}
        title="Profile"
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#D9D2BF',
            paddingVertical: 28,
            alignItems: 'center',
            marginBottom: 22,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>Handicap index</Text>
          <Text
            style={{
              color: '#1C211C',
              fontSize: 56,
              fontStyle: 'italic',
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
              lineHeight: 60,
            }}
          >
            {profile?.handicap_index ?? '—'}
          </Text>
          <Text
            style={{
              color: '#5C6356',
              fontSize: 14,
              marginTop: 6,
              textTransform: 'capitalize',
            }}
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
            marginTop: 18,
            backgroundColor: '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{
            marginTop: 22,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              ...KICKER,
              color: '#8A8B7E',
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const inputStyle = {
  backgroundColor: '#FBF8F1',
  borderWidth: 1,
  borderColor: '#D9D2BF',
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: '#1C211C',
} as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingTop: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 12 }}>{label}</Text>
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
        paddingVertical: 8,
        borderRadius: 2,
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
      }}
    >
      <Text
        style={{
          color: active ? '#F2EEE5' : '#1C211C',
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
