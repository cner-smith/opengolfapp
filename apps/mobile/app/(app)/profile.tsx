import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import { clearScreenCache } from '../../lib/screenCache'
import { AppBar } from '../../components/ui/AppBar'
import { TYPE } from '../../lib/typography'

type Profile = Database['public']['Tables']['profiles']['Row']
type SkillLevel = Profile['skill_level']
type Goal = Profile['goal']

const KICKER: import('react-native').TextStyle = {
  ...TYPE.kicker,
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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
  const [emailSummaries, setEmailSummaries] = useState(true)
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
    Alert.alert('Saved', 'Profile updated. SG benchmarks will use the new handicap.')
  }

  function toggleFacility(f: string) {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  const provenance = handicapProvenance(differentialsCount)
  const provenanceCalculated = provenance === 'calculated'

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
            style={[TYPE.serif, {
              color: '#1C211C',
              fontSize: 56,
              lineHeight: 60,
            }]}
          >
            {profile?.handicap_index ?? '—'}
          </Text>
          {profile?.handicap_index != null && (
            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 2,
                backgroundColor: provenanceCalculated
                  ? 'rgba(31,61,44,0.12)'
                  : 'rgba(138,139,126,0.16)',
              }}
            >
              <Text
                style={{
                  ...KICKER,
                  fontSize: 9,
                  color: provenanceCalculated ? '#1F3D2C' : '#8A8B7E',
                }}
              >
                {HANDICAP_PROVENANCE_LABEL[provenance]}
              </Text>
            </View>
          )}
          <Text
            style={[TYPE.body, {
              color: '#5C6356',
              fontSize: 14,
              marginTop: 6,
              textTransform: 'capitalize',
            }]}
          >
            {profile?.skill_level ?? 'No skill level set'}
          </Text>
        </View>

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
              borderColor: showUsernameError ? '#A33A2A' : '#D9D2BF',
            }}
          />
          <Text
            style={[TYPE.body, {
              color: showUsernameError ? '#A33A2A' : '#8A8B7E',
              fontSize: 11,
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open My Bag"
          onPress={() => router.push('/(app)/bag')}
          style={{
            marginTop: 18,
            paddingVertical: 16,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#D9D2BF',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ ...KICKER, marginBottom: 2 }}>Equipment</Text>
            <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 16 }]}>
              My Bag
            </Text>
          </View>
          <Text style={[TYPE.bodyItalic, { color: '#1F3D2C', fontSize: 18 }]}>→</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay intro tour"
          onPress={() => router.navigate({ pathname: '/(app)', params: { replayTour: '1' } })}
          style={{
            marginTop: 18,
            paddingVertical: 16,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#D9D2BF',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ ...KICKER, marginBottom: 2 }}>Getting started</Text>
            <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 16 }]}>
              Replay intro tour
            </Text>
          </View>
          <Text style={[TYPE.bodyItalic, { color: '#1F3D2C', fontSize: 18 }]}>→</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Saving profile' : 'Save profile changes'}
          accessibilityState={{ disabled: saving || usernameInvalid }}
          onPress={save}
          disabled={saving || usernameInvalid}
          style={{
            marginTop: 18,
            backgroundColor: '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: saving || usernameInvalid ? 0.5 : 1,
          }}
        >
          <Text
            style={[TYPE.bodyBold, {
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }]}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </Pressable>

        <View
          style={{
            marginTop: 28,
            backgroundColor: '#FBF8F1',
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
            padding: 18,
          }}
        >
          {/* iOS: no donation CTAs — App Review 3.1.1 requires IAP or removal.
              A neutral website link (no payment framing) is allowed; donors
              find Ko-fi / GitHub Sponsors on the site. Android keeps them. */}
          {Platform.OS === 'ios' ? (
            <>
              <Text style={{ ...KICKER, marginBottom: 10 }}>OGA on the web</Text>
              <Text
                style={[TYPE.body, {
                  color: '#1C211C',
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 14,
                }]}
              >
                Your rounds sync to a free web dashboard. Sign in at oga.golf
                with the same account for bigger stats, strokes gained, and
                shot-pattern charts.
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open the OGA website"
                onPress={() => Linking.openURL('https://oga.golf')}
                style={{
                  borderWidth: 1,
                  borderColor: '#1F3D2C',
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text
                  style={[TYPE.bodyBold, {
                    color: '#1F3D2C',
                    fontSize: 13,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  }]}
                >
                  Website · oga.golf ↗
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ ...KICKER, marginBottom: 10 }}>OGA on the web</Text>
              <Text
                style={[TYPE.body, {
                  color: '#1C211C',
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 14,
                }]}
              >
                Your rounds sync to a free web dashboard. Sign in at oga.golf
                with the same account for bigger stats, strokes gained, and
                shot-pattern charts.
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open the OGA website"
                onPress={() => Linking.openURL('https://oga.golf')}
                style={{
                  borderWidth: 1,
                  borderColor: '#1F3D2C',
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text
                  style={[TYPE.bodyBold, {
                    color: '#1F3D2C',
                    fontSize: 13,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  }]}
                >
                  Website · oga.golf ↗
                </Text>
              </Pressable>
              <View style={{ height: 1, backgroundColor: '#D9D2BF', marginVertical: 18 }} />
              <Text style={{ ...KICKER, marginBottom: 10 }}>Support OGA</Text>
              <Text
                style={[TYPE.body, {
                  color: '#1C211C',
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 14,
                }]}
              >
                OGA is free and open source. If it helps your game,
                consider buying us a round.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Open Ko-fi sponsorship page"
                  onPress={() => Linking.openURL('https://ko-fi.com/nartana')}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#1F3D2C',
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderRadius: 2,
                  }}
                >
                  <Text
                    style={[TYPE.bodyBold, {
                      color: '#1F3D2C',
                      fontSize: 13,
                      fontWeight: '600',
                      letterSpacing: 0.3,
                    }]}
                  >
                    Ko-fi ↗
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Open GitHub Sponsors page"
                  onPress={() =>
                    Linking.openURL('https://github.com/sponsors/cner-smith')
                  }
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#1F3D2C',
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderRadius: 2,
                  }}
                >
                  <Text
                    style={[TYPE.bodyBold, {
                      color: '#1F3D2C',
                      fontSize: 13,
                      fontWeight: '600',
                      letterSpacing: 0.3,
                    }]}
                  >
                    GitHub ↗
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            // Next sign-in must not render this account's cached screens.
            clearScreenCache()
            supabase.auth.signOut()
          }}
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          onPress={() => setDeleteOpen(true)}
          style={{ paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ ...KICKER, color: '#A33A2A' }}>Delete account</Text>
        </Pressable>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteOpen}
        busy={deleting}
        onConfirm={deleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </View>
  )
}

const inputStyle = {
  ...TYPE.body,
  backgroundColor: '#FBF8F1',
  borderWidth: 1,
  borderColor: '#D9D2BF',
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: '#1C211C',
} as const

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
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(28,33,28,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <View
          style={{
            backgroundColor: '#FBF8F1',
            borderColor: '#9F9580',
            borderWidth: 1,
            borderRadius: 4,
            padding: 22,
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>Confirm delete</Text>
          <Text
            style={[TYPE.serif, {
              color: '#1C211C',
              fontSize: 22,
              lineHeight: 28,
              marginBottom: 10,
            }]}
          >
            {phase === 'confirm' ? 'Delete your OGA account?' : 'Type to confirm'}
          </Text>

          {phase === 'confirm' ? (
            <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
              This will permanently delete your account and all rounds, shots,
              and saved data. This cannot be undone.
            </Text>
          ) : (
            <>
              <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, lineHeight: 20, marginBottom: 14 }]}>
                Type{' '}
                <Text style={[TYPE.bodyBold, { fontWeight: '700', color: '#1C211C' }]}>{DELETE_PHRASE}</Text>{' '}
                below to permanently delete your account.
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={DELETE_PHRASE}
                placeholderTextColor="#8A8B7E"
                style={{ ...inputStyle, marginBottom: 22 }}
                accessibilityLabel="Type delete my account to confirm"
              />
            </>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              disabled={busy}
              style={{
                borderWidth: 1,
                borderColor: '#D9D2BF',
                borderRadius: 2,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: busy ? 0.5 : 1,
              }}
            >
              {/* regular weight — secondary Cancel, must not compete with the
                  destructive Delete action (#598 review). */}
              <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13 }]}>Cancel</Text>
            </Pressable>

            {phase === 'confirm' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue to type-to-confirm step"
                onPress={() => setPhase('type')}
                style={{
                  backgroundColor: '#A33A2A',
                  borderRadius: 2,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }]}>
                  Continue
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                onPress={onConfirm}
                disabled={busy || !matches}
                style={{
                  backgroundColor: '#A33A2A',
                  borderRadius: 2,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  opacity: busy || !matches ? 0.5 : 1,
                }}
              >
                <Text style={[TYPE.bodyBold, { color: '#F2EEE5', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }]}>
                  {busy ? 'Deleting…' : 'Delete account'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

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
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 2,
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
      }}
    >
      <Text
        style={[TYPE.body, {
          color: active ? '#F2EEE5' : '#1C211C',
          fontSize: 12,
          fontWeight: active ? '500' : '400',
          textTransform: 'capitalize',
        }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
