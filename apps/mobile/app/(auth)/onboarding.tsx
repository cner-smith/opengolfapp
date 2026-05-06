import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  DEFAULT_BAG,
  GOALS,
  SKILL_LEVELS,
  type Goal,
  type SkillLevel,
} from '@oga/core'
import { seedDefaultBag, updateProfile } from '@oga/supabase'
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
  // Bag step starts with all DEFAULT_BAG selected; user untoggles
  // clubs they don't carry. The "Set up later →" button (issue #156)
  // commits with seed=false so no user_clubs rows are inserted from
  // onboarding — auto-seed in useUserBag (issue #152) covers them on
  // first shot log or bag-page visit.
  const [bagSelection, setBagSelection] = useState<Set<string>>(
    () => new Set(DEFAULT_BAG.map((c) => c.club_type)),
  )

  function toggleBagClub(clubType: string) {
    setBagSelection((prev) => {
      const next = new Set(prev)
      if (next.has(clubType)) next.delete(clubType)
      else next.add(clubType)
      return next
    })
  }

  async function save(opts: { seedBag: boolean } = { seedBag: true }) {
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
    if (numericHandicap != null && (numericHandicap < -10 || numericHandicap > 54)) {
      Alert.alert('Handicap must be between -10 and 54')
      return
    }
    setSaving(true)
    if (opts.seedBag && bagSelection.size > 0) {
      try {
        const reseeded = DEFAULT_BAG.filter((c) =>
          bagSelection.has(c.club_type),
        ).map((c, idx) => ({
          club_type: c.club_type,
          name: c.name,
          sort_order: idx,
        }))
        await seedDefaultBag(supabase, user.id, reseeded)
      } catch (e) {
        // Bag seeding is best-effort; let the user know but don't
        // block their onboarding completion. They can rebuild the bag
        // from Profile → My Bag.
        Alert.alert(
          'Bag setup skipped',
          `Could not save bag: ${(e as Error).message}. You can build it from Profile → My Bag.`,
        )
      }
    }
    // Single profile write — saves the required fields AND flips the
    // onboarding gate atomically. If the bag write above failed the
    // gate still flips so the user isn't trapped on /onboarding.
    const { error } = await updateProfile(supabase, user.id, {
      skill_level: skill,
      handicap_index: numericHandicap,
      goal,
      onboarding_completed: true,
    })
    if (error) {
      setSaving(false)
      Alert.alert('Save failed', error.message)
      return
    }
    setSaving(false)
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

      <View
        style={{
          marginTop: 8,
          marginBottom: 18,
          paddingTop: 18,
          borderTopWidth: 0.5,
          borderColor: '#E4E4E0',
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
          Bag (optional)
        </Text>
        <Text style={{ color: '#888880', fontSize: 12, marginBottom: 10 }}>
          Select the clubs you carry. You can customize your bag fully in
          Settings → My Bag later.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DEFAULT_BAG.map((c) => (
            <Chip
              key={c.club_type}
              label={c.name}
              active={bagSelection.has(c.club_type)}
              onPress={() => toggleBagClub(c.club_type)}
            />
          ))}
        </View>
        <Text
          style={{
            color: '#888880',
            fontSize: 11,
            marginTop: 8,
            letterSpacing: 0.3,
          }}
        >
          {bagSelection.size} of {DEFAULT_BAG.length} selected
        </Text>
      </View>

      <Pressable
        onPress={() => save({ seedBag: true })}
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

      <Pressable
        onPress={() => save({ seedBag: false })}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Set up bag later"
        style={{
          marginTop: 10,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#1F3D2C',
          backgroundColor: 'transparent',
          opacity: saving ? 0.5 : 1,
        }}
      >
        <Text style={{ color: '#1F3D2C', fontSize: 13, fontWeight: '500' }}>
          Set up later →
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
