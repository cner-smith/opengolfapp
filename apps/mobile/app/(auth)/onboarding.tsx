import { useState } from 'react'
import { Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { FONT, TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { SectionHead } from '../../components/paper/Section'
import { FONT_CAP, P, R } from '../../components/paper/tokens'

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
  const insets = useSafeAreaInsets()
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
    // Top inset on the frame, not the content: scrolled text slid under the
    // status bar. Bottom inset clears the 3-button nav bar.
    <PaperSurface style={{ flex: 1, paddingTop: insets.top }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>
        Welcome to OGA
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 28, lineHeight: 34, marginBottom: 4 }]}>
        Three quick questions
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 18, marginBottom: 22 }]}>
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
          maxFontSizeMultiplier={FONT_CAP}
          style={{
            backgroundColor: P.raised,
            borderWidth: 1,
            borderColor: P.ink,
            borderRadius: R,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontSize: 15,
            color: P.ink,
            fontFamily: FONT.body,
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

      <View style={{ marginTop: 4, marginBottom: 18 }}>
        <SectionHead title="Bag (optional)" style={{ marginBottom: 6 }} />
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginBottom: 12 }]}>
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
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 8 }]}>
          {bagSelection.size} of {DEFAULT_BAG.length} selected
        </Text>
      </View>

      <Key
        tone="primary"
        accessibilityLabel="Start tracking"
        onPress={() => save({ seedBag: true })}
        disabled={saving}
        style={{ marginTop: 8 }}
        faceStyle={{ minHeight: 50 }}
      >
        <KeyText tone="primary" bold size={15} disabled={saving}>
          {saving ? 'Saving…' : 'Start tracking'}
        </KeyText>
      </Key>

      <Key
        accessibilityLabel="Set up bag later"
        onPress={() => save({ seedBag: false })}
        disabled={saving}
        style={{ marginTop: 12 }}
        faceStyle={{ minHeight: 46 }}
      >
        <KeyText size={14} disabled={saving}>
          Set up later →
        </KeyText>
      </Key>
    </ScrollView>
    </PaperSurface>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <SectionHead title={label} />
      {children}
    </View>
  )
}

// Latched paper key, as on Profile.
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
    <Key accessibilityLabel={label} latched={active} onPress={onPress} faceStyle={{ minHeight: 40, paddingHorizontal: 12 }}>
      <KeyText size={13} bold={active}>
        {label}
      </KeyText>
    </Key>
  )
}
