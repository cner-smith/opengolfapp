import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  FACILITIES,
  GOALS,
  HANDICAP_PROVENANCE_LABEL,
  handicapProvenance,
  SKILL_LEVELS,
} from '@oga/core'
import { getProfile, updateProfile } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUnitsContext } from '../../contexts/UnitsContext'
import { clearScreenCache } from '../../lib/screenCache'
import { getAimTilt, setAimTilt, type AimTilt } from '../../lib/aimTilt'
import { getLeftHand, setLeftHand } from '../../lib/leftHand'
import { getSoundsOn, setSoundsOn } from '../../lib/sounds'
import { AppBar } from '../../components/ui/AppBar'
import { PaperTile, SectionHead } from '../../components/paper/Section'
import { FONT_CAP, P, R } from '../../components/paper/tokens'
import { HardShadow, Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { TYPE } from '../../lib/typography'

type Profile = Database['public']['Tables']['profiles']['Row']
type SkillLevel = Profile['skill_level']
type Goal = Profile['goal']

// Mirrors the server-side username constraint: alphanumerics, hyphen,
// underscore; 3–32 chars. Empty string is also valid (username is
// nullable). Inlined rather than lifted to @oga/core because it has
// only two callers (web + mobile profile screens) — under the
// 3-caller extraction rule.
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/
const USERNAME_HELPER =
  '3–32 characters. Letters, numbers, - and _ only.'

// PostgREST surfaces raw SQL constraint messages on save errors —
// fine for `console.error` but not for an Alert. Map the common
// failure modes to friendly copy; everything else falls back to a
// neutral string.
function humanizeProfileSaveError(message: string | undefined): string {
  if (!message) return 'Could not save profile. Please try again.'
  if (/duplicate key|unique/i.test(message)) {
    return 'That username is already taken.'
  }
  if (/check constraint|violates/i.test(message)) {
    return "One of the fields didn't pass validation."
  }
  return 'Could not save profile. Please try again.'
}

export default function ProfileTab() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [skill, setSkill] = useState<SkillLevel>(null)
  const [goal, setGoal] = useState<Goal>(null)
  const [facilities, setFacilities] = useState<string[]>([])
  const [unit, setUnit] = useState<'yards' | 'meters'>('yards')
  const { setUnit: setAppUnit, setPlaysLeftHanded: setAppLefty } = useUnitsContext()
  const [playsLefty, setPlaysLefty] = useState(false)
  const [emailSummaries, setEmailSummaries] = useState(true)
  // Device-local (lib/aimTilt), so it saves on tap rather than with the
  // profile row below.
  const [aimTilt, setAimTiltState] = useState<AimTilt>(0)
  useEffect(() => {
    void getAimTilt().then(setAimTiltState)
  }, [])
  const chooseAimTilt = (t: AimTilt) => {
    setAimTiltState(t)
    void setAimTilt(t)
  }
  const [leftHand, setLeftHandState] = useState(false)
  useEffect(() => {
    void getLeftHand().then(setLeftHandState)
  }, [])
  const chooseLeftHand = (on: boolean) => {
    setLeftHandState(on)
    void setLeftHand(on)
  }
  const [sounds, setSoundsState] = useState(true)
  useEffect(() => {
    void getSoundsOn().then(setSoundsState)
  }, [])
  const chooseSounds = (on: boolean) => {
    setSoundsState(on)
    void setSoundsOn(on)
  }
  // Count of rounds with a derived score_differential — the signal for
  // whether the displayed index is a calculated WHS value or still the
  // entered one (#521). Mobile doesn't compute differentials, so this is
  // only ever non-zero for players who've also logged rated rounds on web.
  const [differentialsCount, setDifferentialsCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteAccount() {
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleting(false)
      setDeleteOpen(false)
      Alert.alert('Could not delete account', error.message)
      return
    }
    // The account row is already gone; the JWT just stays valid until
    // sign-out, so clear the session. If signOut itself errors we must STILL
    // release the modal — otherwise the user is stranded in a disabled
    // "Deleting…" dialog after an irreversible delete. On success the auth
    // listener unmounts this screen and redirects to login.
    clearScreenCache()
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setDeleting(false)
      setDeleteOpen(false)
      Alert.alert(
        'Account deleted',
        'Your account has been deleted. Restart the app to finish signing out.',
      )
    }
  }

  const trimmedUsername = username.trim()
  const usernameInvalid =
    trimmedUsername !== '' && !USERNAME_PATTERN.test(trimmedUsername)
  const showUsernameError = usernameTouched && usernameInvalid

  // Hydrate form fields from the server once per signed-in user. After
  // hydration, only save() and the user's edits drive the form — a
  // re-fetch can't clobber typing. Reset on user.id change so a different
  // account starts cleanly.
  const hydratedUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (authLoading || !user) return
    if (hydratedUserIdRef.current === user.id) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[profile/getProfile]', error.message)
        Alert.alert('Could not load profile', error.message)
        return
      }
      if (!data) return
      hydratedUserIdRef.current = user.id
      setProfile(data as unknown as Profile)
      setUsername(data.username ?? '')
      setHandicap(data.handicap_index?.toString() ?? '')
      setSkill(data.skill_level ?? null)
      setGoal(data.goal ?? null)
      setFacilities(data.facilities ?? [])
      setUnit(data.distance_unit === 'meters' ? 'meters' : 'yards')
      setPlaysLefty(data.plays_left_handed === true)
      setEmailSummaries(data.email_round_summaries_enabled ?? true)
    })
    supabase
      .from('rounds')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('score_differential', 'is', null)
      .then(({ count, error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('[profile/differentials-count]', error.message)
        }
        if (active) setDifferentialsCount(count ?? 0)
      })
    return () => {
      active = false
    }
  }, [authLoading, user?.id])

  async function save() {
    if (!user) return
    if (usernameInvalid) {
      setUsernameTouched(true)
      Alert.alert('Username invalid', USERNAME_HELPER)
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
    const { data, error } = await updateProfile(supabase, user.id, {
      username: trimmedUsername || null,
      handicap_index: numericHandicap,
      skill_level: skill,
      goal,
      facilities,
      distance_unit: unit,
      plays_left_handed: playsLefty,
      email_round_summaries_enabled: emailSummaries,
    })
    setSaving(false)
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[profile/save]', error.message)
      Alert.alert('Save failed', humanizeProfileSaveError(error.message))
      return
    }
    if (data) setProfile(data)
    setAppUnit(unit)
    setAppLefty(playsLefty)
    Alert.alert('Saved', 'Profile updated.')
  }

  function toggleFacility(f: string) {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  const provenance = handicapProvenance(differentialsCount)
  const provenanceCalculated = provenance === 'calculated'

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar
        eyebrow={profile?.username ? `@${profile.username}` : 'Account'}
        title="Profile"
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <PaperTile style={{ marginBottom: 22 }} innerStyle={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>
            Handicap index
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 56, lineHeight: 64 }]}>
            {profile?.handicap_index ?? '—'}
          </Text>
          {profile?.handicap_index != null && (
            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: provenanceCalculated ? P.forest : P.lineStrong,
              }}
            >
              <Text
                maxFontSizeMultiplier={FONT_CAP}
                style={[TYPE.body, { fontSize: 12, color: provenanceCalculated ? P.forest : P.inkDim }]}
              >
                {HANDICAP_PROVENANCE_LABEL[provenance]}
              </Text>
            </View>
          )}
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.body, { color: P.inkDim, fontSize: 14, marginTop: 8, textTransform: 'capitalize' }]}
          >
            {profile?.skill_level ?? 'No skill level set'}
          </Text>
        </PaperTile>

        <Field label="Username">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(v) => {
              setUsername(v)
              setUsernameTouched(true)
            }}
            style={{
              ...inputStyle,
              borderColor: showUsernameError ? P.neg : P.ink,
            }}
          />
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            style={[TYPE.body, {
              color: showUsernameError ? P.neg : P.inkDim,
              fontSize: 12,
              marginTop: 6,
            }]}
          >
            {USERNAME_HELPER}
          </Text>
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

        <Field label="Units">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip
              label="Yards"
              active={unit === 'yards'}
              onPress={() => setUnit('yards')}
            />
            <Chip
              label="Metres"
              active={unit === 'meters'}
              onPress={() => setUnit('meters')}
            />
          </View>
        </Field>

        <Field label="Plays">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="Right-handed" active={!playsLefty} onPress={() => setPlaysLefty(false)} />
            <Chip label="Left-handed" active={playsLefty} onPress={() => setPlaysLefty(true)} />
          </View>
        </Field>

        <Field label="Aim view">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="Flat" active={aimTilt === 0} onPress={() => chooseAimTilt(0)} />
            <Chip label="Flyover" active={aimTilt === 60} onPress={() => chooseAimTilt(60)} />
          </View>
        </Field>

        <Field label="Live round layout">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="Right-handed" active={!leftHand} onPress={() => chooseLeftHand(false)} />
            <Chip label="Left-handed" active={leftHand} onPress={() => chooseLeftHand(true)} />
          </View>
        </Field>

        <Field label="Sounds">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="On" active={sounds} onPress={() => chooseSounds(true)} />
            <Chip label="Off" active={!sounds} onPress={() => chooseSounds(false)} />
          </View>
        </Field>

        <Field label="Email round summaries">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip
              label="On"
              active={emailSummaries === true}
              onPress={() => setEmailSummaries(true)}
            />
            <Chip
              label="Off"
              active={emailSummaries === false}
              onPress={() => setEmailSummaries(false)}
            />
          </View>
        </Field>

        <View style={{ marginTop: 18 }}>
          <SectionHead title="Equipment" />
          <LinkKey accessibilityLabel="Open My Bag" label="My Bag" onPress={() => router.push('/(app)/bag')} />
        </View>

        <View style={{ marginTop: 18 }}>
          <SectionHead title="Getting started" />
          <LinkKey
            accessibilityLabel="Replay intro tour"
            label="Replay intro tour"
            onPress={() => router.navigate({ pathname: '/(app)', params: { replayTour: '1' } })}
          />
        </View>

        <Key
          accessibilityLabel={saving ? 'Saving profile' : 'Save profile changes'}
          tone="primary"
          onPress={save}
          disabled={saving || usernameInvalid}
          style={{ marginTop: 18 }}
          faceStyle={{ minHeight: 50 }}
        >
          <KeyText tone="primary" bold size={15} disabled={saving || usernameInvalid}>
            {saving ? 'Saving…' : 'Save changes'}
          </KeyText>
        </Key>

        <PaperTile style={{ marginTop: 28 }} innerStyle={{ padding: 18 }}>
          <SectionHead title="OGA on the web" style={{ borderTopWidth: 0, paddingTop: 0, marginBottom: 8 }} />
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 14, lineHeight: 20, marginBottom: 14 }]}>
            Your rounds sync to a free web dashboard. Sign in at oga.golf
            with the same account for bigger stats, strokes gained, and
            shot-pattern charts.
          </Text>
          <Key accessibilityLabel="Open the OGA website" onPress={() => Linking.openURL('https://oga.golf')} faceStyle={{ minHeight: 44 }}>
            <KeyText size={13} bold>Website · oga.golf ↗</KeyText>
          </Key>
          {/* iOS: no donation CTAs — App Review 3.1.1 requires IAP or removal.
              A neutral website link (no payment framing) is allowed; donors
              find Ko-fi / GitHub Sponsors on the site. Android keeps them. */}
          {Platform.OS !== 'ios' && (
            <>
              <SectionHead title="Support OGA" style={{ marginTop: 18, marginBottom: 8 }} />
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 14, lineHeight: 20, marginBottom: 14 }]}>
                OGA is free and open source. If it helps your game,
                consider buying us a round.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Key
                  accessibilityLabel="Open Ko-fi sponsorship page"
                  onPress={() => Linking.openURL('https://ko-fi.com/nartana')}
                  style={{ flex: 1 }}
                  faceStyle={{ minHeight: 44 }}
                >
                  <KeyText size={13} bold>Ko-fi ↗</KeyText>
                </Key>
                <Key
                  accessibilityLabel="Open GitHub Sponsors page"
                  onPress={() => Linking.openURL('https://github.com/sponsors/cner-smith')}
                  style={{ flex: 1 }}
                  faceStyle={{ minHeight: 44 }}
                >
                  <KeyText size={13} bold>GitHub ↗</KeyText>
                </Key>
              </View>
            </>
          )}
        </PaperTile>

        <Key
          accessibilityLabel="Sign out"
          onPress={() => {
            // Next sign-in must not render this account's cached screens.
            clearScreenCache()
            supabase.auth.signOut()
          }}
          style={{ marginTop: 28 }}
          faceStyle={{ minHeight: 46 }}
        >
          <KeyText size={14} style={{ color: P.neg }}>Sign out</KeyText>
        </Key>

        <Key
          accessibilityLabel="Delete account"
          onPress={() => setDeleteOpen(true)}
          style={{ marginTop: 12 }}
          faceStyle={{ minHeight: 46 }}
        >
          <KeyText size={14} bold style={{ color: P.neg }}>Delete account</KeyText>
        </Key>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteOpen}
        busy={deleting}
        onConfirm={deleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </PaperSurface>
  )
}

const inputStyle = {
  ...TYPE.body,
  backgroundColor: P.raised,
  borderWidth: 1,
  borderColor: P.ink,
  borderRadius: R,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: P.ink,
} as const

// A raised paper key standing in for a navigation row.
function LinkKey({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Key
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      faceStyle={{ minHeight: 50, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink, fontSize: 16 }]}>{label}</Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.forest, fontSize: 18 }]}>→</Text>
    </Key>
  )
}

// Two-phase confirmation for the irreversible account delete, in a SINGLE
// Modal (never two stacked — iOS allows one presented modal per presenter,
// #293). Phase 1 is the "are you sure" warning; phase 2 requires typing the
// exact phrase, so the delete can't be triggered by a stray tap.
const DELETE_PHRASE = 'delete my account'

function DeleteAccountModal({
  visible,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean
  busy: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const [phase, setPhase] = useState<'confirm' | 'type'>('confirm')
  const [text, setText] = useState('')
  const matches = text.trim().toLowerCase() === DELETE_PHRASE

  // Reset to phase one whenever the modal (re)opens, so a reopened dialog
  // never starts on the typed step with stale text.
  useEffect(() => {
    if (visible) {
      setPhase('confirm')
      setText('')
    }
  }, [visible])

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      {/* iOS: re-centre the dialog above the keyboard so Delete stays tappable
          on the type-to-confirm step (App Review exercises this path). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: P.scrim, alignItems: 'center', justifyContent: 'center', padding: 18 }}
      >
        <HardShadow style={{ width: '100%', maxWidth: 360 }}>
          <PaperSurface fill={P.raised} style={{ borderColor: P.ink, borderWidth: 1, borderRadius: R, padding: 22, overflow: 'hidden' }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginBottom: 6 }]}>
              Confirm delete
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 22, lineHeight: 28, marginBottom: 10 }]}>
              {phase === 'confirm' ? 'Delete your OGA account?' : 'Type to confirm'}
            </Text>

            {phase === 'confirm' ? (
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
                This will permanently delete your account and all rounds, shots,
                and saved data. This cannot be undone.
              </Text>
            ) : (
              <>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 14 }]}>
                  Type{' '}
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.bodyBold, { color: P.ink }]}>{DELETE_PHRASE}</Text>{' '}
                  below to permanently delete your account.
                </Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={DELETE_PHRASE}
                  placeholderTextColor={P.ink45}
                  maxFontSizeMultiplier={FONT_CAP}
                  style={{ ...inputStyle, marginBottom: 22 }}
                  accessibilityLabel="Type delete my account to confirm"
                />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* regular weight — secondary Cancel, must not compete with the
                  destructive Delete action (#598 review). */}
              <Key accessibilityLabel="Cancel" onPress={onCancel} disabled={busy} style={{ flex: 1 }} faceStyle={{ minHeight: 46 }}>
                <KeyText size={13} disabled={busy}>Cancel</KeyText>
              </Key>
              {phase === 'confirm' ? (
                <Key
                  tone="danger"
                  accessibilityLabel="Continue to type-to-confirm step"
                  onPress={() => setPhase('type')}
                  style={{ flex: 1 }}
                  faceStyle={{ minHeight: 46 }}
                >
                  <KeyText tone="danger" bold size={14}>Continue</KeyText>
                </Key>
              ) : (
                <Key
                  tone="danger"
                  accessibilityLabel="Delete account"
                  onPress={onConfirm}
                  disabled={busy || !matches}
                  style={{ flex: 1 }}
                  faceStyle={{ minHeight: 46 }}
                >
                  <KeyText tone="danger" bold size={14} disabled={busy || !matches}>
                    {busy ? 'Deleting…' : 'Delete account'}
                  </KeyText>
                </Key>
              )}
            </View>
          </PaperSurface>
        </HardShadow>
      </KeyboardAvoidingView>
    </Modal>
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

// Option chips in the paper style of the round screens (#611): a key that
// sits latched (pressed in) while chosen.
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
      <KeyText size={13} bold={active} style={{ textTransform: 'capitalize' }}>
        {label}
      </KeyText>
    </Key>
  )
}
