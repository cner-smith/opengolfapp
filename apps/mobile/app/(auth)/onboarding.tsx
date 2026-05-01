import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { GOALS, SKILL_LEVELS, type Goal, type SkillLevel } from '@oga/core'
import { updateProfile } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: 'Just starting out',
  casual: 'Casual',
  developing: 'Developing player',
  competitive: 'Competitive amateur',
}

const GOAL_LABEL: Record<Goal, string> = {
  break_100: 'Break 100',
  break_90: 'Break 90',
  break_80: 'Break 80',
  break_70s: 'Break into the 70s',
  scratch: 'Scratch and below',
}

export default function MobileOnboarding() {
  const router = useRouter()
  const { user } = useAuth()
  const [skill, setSkill] = useState<SkillLevel | null>(null)
  const [handicap, setHandicap] = useState('15')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!user) return
    if (!skill || !goal) {
      Alert.alert('Pick a skill level and a goal first')
      return
    }
    const numericHandicap = handicap === '' ? null : Number(handicap)
    if (handicap !== '' && Number.isNaN(numericHandicap)) {
      Alert.alert('Handicap must be a number')
      return
    }
    setSaving(true)
    const { error } = await updateProfile(supabase, user.id, {
      skill_level: skill,
      handicap_index: numericHandicap,
      goal,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Save failed', error.message)
      return
    }
    router.replace('/(app)')
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F4F4F0' }}
      contentContainerStyle={{ padding: 16, paddingTop: 48, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: '#888880',
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Welcome to OGA
      </Text>
      <Text
        style={{
          color: '#111111',
          fontSize: 22,
          fontWeight: '600',
          lineHeight: 28,
          marginBottom: 4,
        }}
      >
        Three quick questions
      </Text>
      <Text style={{ color: '#888880', fontSize: 13, marginBottom: 20 }}>
        Calibrates strokes-gained baselines. You can edit these in Profile later.
      </Text>

      <Field label="Skill level">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SKILL_LEVELS.map((s) => (
            <Chip
              key={s}
              label={SKILL_LABEL[s]}
              active={skill === s}
              onPress={() => setSkill(s)}
            />
          ))}
        </View>
      </Field>

      <Field label="Handicap index">
        <TextInput
          keyboardType="decimal-pad"
          value={handicap}
          onChangeText={setHandicap}
          style={{
            backgroundColor: '#F9F9F6',
            borderWidth: 0.5,
            borderColor: '#E4E4E0',
            borderRadius: 7,
            paddingHorizontal: 10,
            paddingVertical: 9,
            fontSize: 13,
            color: '#111111',
          }}
        />
      </Field>

      <Field label="Goal">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GOALS.map((g) => (
            <Chip
              key={g}
              label={GOAL_LABEL[g]}
              active={goal === g}
              onPress={() => setGoal(g)}
            />
          ))}
        </View>
      </Field>

      <Pressable
        onPress={save}
        disabled={saving}
        style={{
          marginTop: 8,
          backgroundColor: '#111111',
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          opacity: saving ? 0.5 : 1,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
          {saving ? 'Saving…' : 'Start tracking'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
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
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
