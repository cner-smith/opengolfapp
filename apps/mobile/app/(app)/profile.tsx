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
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
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
import { useUserBag } from '../../hooks/useUserBag'
import { useUnitsContext } from '../../contexts/UnitsContext'
import { clearScreenCache } from '../../lib/screenCache'
import { getAimTilt, setAimTilt, type AimTilt } from '../../lib/aimTilt'
import { getLeftHand, setLeftHand } from '../../lib/leftHand'
import { getSoundsOn, setSoundsOn } from '../../lib/sounds'
import { getKeepScreenOn, setKeepScreenOn } from '../../lib/keepScreenOn'
import { readDiagLog } from '../../lib/db'
import { AppBar } from '../../components/ui/AppBar'
import { SectionHead } from '../../components/paper/Section'
import { PressableTouch } from '../../components/ui/PressableTouch'
import { FONT_CAP, P, R } from '../../components/paper/tokens'
import { HardShadow, Key, KeyText, PaperSurface } from '../../components/paper/Paper'
import { TYPE } from '../../lib/typography'
import { openWebImport, WEB_URL } from '../../lib/webLinks'

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

const SKILL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  casual: 'Casual',
  developing: 'Developing',
  competitive: 'Competitive',
}
const GOAL_LABEL: Record<string, string> = {
  break_100: 'Break 100',
  break_90: 'Break 90',
  break_80: 'Break 80',
  break_70s: 'Break 70s',
  scratch: 'Scratch',
}
const FACILITY_LABEL: Record<string, string> = {
  range: 'Range',
  short_game: 'Short game area',
  putting: 'Putting green',
  sim: 'Simulator',
}

export default function ProfileTab() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { bag } = useUserBag()
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
  const [keepOn, setKeepOnState] = useState(true)
  useEffect(() => {
    void getKeepScreenOn().then(setKeepOnState)
  }, [])
  const chooseKeepOn = (on: boolean) => {
    setKeepOnState(on)
    void setKeepScreenOn(on)
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
  // One settings row open at a time; its editor sits under it.
  const [openRow, setOpenRow] = useState<string | null>(null)
  const toggleRow = (key: string) => setOpenRow((cur) => (cur === key ? null : key))

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

  const dirty =
    !!profile &&
    (trimmedUsername !== (profile.username ?? '') ||
      handicap !== (profile.handicap_index?.toString() ?? '') ||
      skill !== (profile.skill_level ?? null) ||
      goal !== (profile.goal ?? null) ||
      [...facilities].sort().join() !== [...(profile.facilities ?? [])].sort().join() ||
      unit !== (profile.distance_unit === 'meters' ? 'meters' : 'yards') ||
      playsLefty !== (profile.plays_left_handed === true) ||
      emailSummaries !== (profile.email_round_summaries_enabled ?? true))
  const facilitiesValue =
    facilities.length === 0
      ? 'None set'
      : facilities.length === FACILITIES.length
        ? 'All four'
        : FACILITIES.filter((f) => facilities.includes(f)).map((f) => FACILITY_LABEL[f] ?? f).join(', ')

  return (
    <PaperSurface style={{ flex: 1 }}>
      <AppBar title="Profile" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* The one headline number: no tile, just the figure and what it is. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 6 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 48, lineHeight: 54 }]}>
            {profile?.handicap_index ?? '—'}
          </Text>
          <View style={{ paddingBottom: 8, flex: 1 }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>
              Handicap index
            </Text>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>
              {[
                profile?.handicap_index != null ? HANDICAP_PROVENANCE_LABEL[provenance] : null,
                profile?.skill_level ? SKILL_LABEL[profile.skill_level] : null,
                profile?.username ? `@${profile.username}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginBottom: 22 }]}>
          Your plans and drills are pitched at your skill level and handicap
          {provenanceCalculated ? ', calculated from your rated rounds.' : '.'}
        </Text>

        <Group title="Your game">
          <Row label="Username" value={trimmedUsername || 'Not set'} open={openRow === 'username'} onToggle={() => toggleRow('username')} first>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              accessibilityLabel="Username"
              onChangeText={(v) => {
                setUsername(v)
                setUsernameTouched(true)
              }}
              style={{ ...inputStyle, borderColor: showUsernameError ? P.neg : P.ink }}
            />
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[TYPE.body, { color: showUsernameError ? P.neg : P.inkDim, fontSize: 12, marginTop: 6 }]}
            >
              {USERNAME_HELPER}
            </Text>
          </Row>
          <Row
            label="Handicap index"
            value={handicap === '' ? 'Not set' : handicap}
            serifValue={handicap !== ''}
            open={openRow === 'handicap'}
            onToggle={() => toggleRow('handicap')}
          >
            <TextInput
              keyboardType="decimal-pad"
              value={handicap}
              accessibilityLabel="Handicap index"
              onChangeText={setHandicap}
              style={{ ...inputStyle, width: 120 }}
            />
          </Row>
          <Row label="Skill level" value={skill ? SKILL_LABEL[skill] ?? skill : 'Not set'} open={openRow === 'skill'} onToggle={() => toggleRow('skill')}>
            <Chips>
              {SKILL_LEVELS.map((s) => (
                <Chip key={s} label={SKILL_LABEL[s] ?? s} active={skill === s} onPress={() => setSkill(s)} />
              ))}
            </Chips>
          </Row>
          <Row label="Goal" value={goal ? GOAL_LABEL[goal] ?? goal : 'Not set'} open={openRow === 'goal'} onToggle={() => toggleRow('goal')}>
            <Chips>
              {GOALS.map((g) => (
                <Chip key={g} label={GOAL_LABEL[g] ?? g} active={goal === g} onPress={() => setGoal(g)} />
              ))}
            </Chips>
          </Row>
          <Row label="Where you practice" value={facilitiesValue} open={openRow === 'facilities'} onToggle={() => toggleRow('facilities')}>
            <Chips>
              {FACILITIES.map((f) => (
                <Chip key={f} label={FACILITY_LABEL[f] ?? f} active={facilities.includes(f)} onPress={() => toggleFacility(f)} />
              ))}
            </Chips>
            <Hint>Plans only pick drills you can run where you practice.</Hint>
          </Row>
        </Group>

        <Group title="Clubs and distances">
          <NavRow label="My bag" value={bag.length > 0 ? `${bag.length} clubs in the bag` : ''} onPress={() => router.push('/(app)/bag')} first />
          <Row label="Distances in" value={unit === 'meters' ? 'Metres' : 'Yards'} open={openRow === 'units'} onToggle={() => toggleRow('units')}>
            <Chips>
              <Chip label="Yards" active={unit === 'yards'} onPress={() => setUnit('yards')} />
              <Chip label="Metres" active={unit === 'meters'} onPress={() => setUnit('meters')} />
            </Chips>
          </Row>
          <Row label="You play" value={playsLefty ? 'Left-handed' : 'Right-handed'} open={openRow === 'plays'} onToggle={() => toggleRow('plays')}>
            <Chips>
              <Chip label="Right-handed" active={!playsLefty} onPress={() => setPlaysLefty(false)} />
              <Chip label="Left-handed" active={playsLefty} onPress={() => setPlaysLefty(true)} />
            </Chips>
            <Hint>Mirrors the shot shape and start-line buttons: a left-hander’s draw curves the other way.</Hint>
          </Row>
        </Group>

        <Group title="Email">
          <Row label="Round summary" value={emailSummaries ? 'On' : 'Off'} open={openRow === 'email'} onToggle={() => toggleRow('email')} first>
            <Chips>
              <Chip label="On" active={emailSummaries} onPress={() => setEmailSummaries(true)} />
              <Chip label="Off" active={!emailSummaries} onPress={() => setEmailSummaries(false)} />
            </Chips>
            <Hint>The morning after you play.</Hint>
          </Row>
        </Group>

        {dirty ? (
          <Key
            accessibilityLabel={saving ? 'Saving profile' : 'Save profile changes'}
            tone="primary"
            onPress={save}
            disabled={saving || usernameInvalid}
            style={{ marginTop: -8, marginBottom: 28 }}
            faceStyle={{ minHeight: 50 }}
          >
            <KeyText tone="primary" bold size={15} disabled={saving || usernameInvalid}>
              {saving ? 'Saving…' : 'Save changes'}
            </KeyText>
          </Key>
        ) : null}

        <Group title="On this phone" note="These save straight away.">
          <Row label="Aim view" value={aimTilt === 60 ? 'Flyover' : 'Flat'} open={openRow === 'aim'} onToggle={() => toggleRow('aim')} first>
            <Chips>
              <Chip label="Flat" active={aimTilt === 0} onPress={() => chooseAimTilt(0)} />
              <Chip label="Flyover" active={aimTilt === 60} onPress={() => chooseAimTilt(60)} />
            </Chips>
          </Row>
          <Row label="Live round layout" value={leftHand ? 'Left-handed' : 'Right-handed'} open={openRow === 'layout'} onToggle={() => toggleRow('layout')}>
            <Chips>
              <Chip label="Right-handed" active={!leftHand} onPress={() => chooseLeftHand(false)} />
              <Chip label="Left-handed" active={leftHand} onPress={() => chooseLeftHand(true)} />
            </Chips>
          </Row>
          <Row label="Sounds" value={sounds ? 'On' : 'Off'} open={openRow === 'sounds'} onToggle={() => toggleRow('sounds')}>
            <Chips>
              <Chip label="On" active={sounds} onPress={() => chooseSounds(true)} />
              <Chip label="Off" active={!sounds} onPress={() => chooseSounds(false)} />
            </Chips>
          </Row>
          <Row label="Keep screen on" value={keepOn ? 'On' : 'Off'} open={openRow === 'keep'} onToggle={() => toggleRow('keep')}>
            <Chips>
              <Chip label="On" active={keepOn} onPress={() => chooseKeepOn(true)} />
              <Chip label="Off" active={!keepOn} onPress={() => chooseKeepOn(false)} />
            </Chips>
            <Hint>During a live round. After 20 seconds without a touch the screen goes black; the first tap only wakes it.</Hint>
          </Row>
        </Group>

        <Group title="Your data">
          <NavRow label="Import rounds on the web" value="↗" onPress={() => void openWebImport()} first />
        </Group>

        <Group title="Help">
          <NavRow
            label="Replay intro tour"
            onPress={() => router.navigate({ pathname: '/(app)', params: { replayTour: '1' } })}
            first
          />
          <NavRow label="Export diagnostic log" onPress={() => void exportDiagLog()} />
          <NavRow label="OGA on the web" value="oga.golf ↗" onPress={() => Linking.openURL(WEB_URL)} />
        </Group>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginTop: -16, marginBottom: 28 }]}>
          Your rounds sync to the web: sign in at oga.golf with the same account for bigger charts.
        </Text>

        {/* iOS: no donation CTAs — App Review 3.1.1 requires IAP or removal.
            A neutral website link (no payment framing) is allowed; donors
            find Ko-fi / GitHub Sponsors on the site. Android keeps them. */}
        {Platform.OS !== 'ios' && (
          <Group title="Support OGA" note="OGA is free and open source. If it helps your game, consider buying us a round.">
            <NavRow label="Ko-fi" value="↗" onPress={() => Linking.openURL('https://ko-fi.com/nartana')} first />
            <NavRow label="GitHub Sponsors" value="↗" onPress={() => Linking.openURL('https://github.com/sponsors/cner-smith')} />
          </Group>
        )}

        <Group title="Account">
          <NavRow
            label="Sign out"
            danger
            onPress={() => {
              // Next sign-in must not render this account's cached screens.
              clearScreenCache()
              supabase.auth.signOut()
            }}
            first
          />
          <NavRow label="Delete account" danger onPress={() => setDeleteOpen(true)} />
        </Group>
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

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <SectionHead title={title} style={{ marginBottom: note ? 2 : 0 }} />
      {note ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13, lineHeight: 19, marginBottom: 4 }]}>
          {note}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

// A settings row: plain label left, the current value right. Tapping opens
// its editor underneath (one at a time).
function Row({
  label,
  value,
  serifValue,
  open,
  onToggle,
  first,
  children,
}: {
  label: string
  value: string
  serifValue?: boolean
  open: boolean
  onToggle: () => void
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderColor: P.line }}>
      <PressableTouch
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={rowStyle}
      >
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Text
            maxFontSizeMultiplier={FONT_CAP}
            numberOfLines={1}
            style={[
              serifValue ? TYPE.serifUpright : TYPE.body,
              { color: serifValue ? P.ink : P.inkDim, fontSize: serifValue ? 18 : 15, flexShrink: 1, textAlign: 'right' },
            ]}
          >
            {value}
          </Text>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink45, fontSize: 16 }]}>
            {open ? '⌃' : '⌄'}
          </Text>
        </View>
      </PressableTouch>
      {open ? <View style={{ paddingBottom: 16 }}>{children}</View> : null}
    </View>
  )
}

function NavRow({
  label,
  value,
  danger,
  first,
  onPress,
}: {
  label: string
  value?: string
  danger?: boolean
  first?: boolean
  onPress: () => void
}) {
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[rowStyle, { borderTopWidth: first ? 0 : 1, borderColor: P.line }]}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: danger ? P.neg : P.ink, fontSize: 15 }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 15 }]}>
        {value ?? ''}
        {danger ? '' : '  ›'}
      </Text>
    </PressableTouch>
  )
}

function Chips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 8 }]}>
      {children}
    </Text>
  )
}

const rowStyle = {
  minHeight: 52,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  gap: 16,
  paddingVertical: 12,
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

// What the live round did on this phone (#1105), for a bug report.
async function exportDiagLog() {
  try {
    const file = new File(Paths.cache, 'oga-diagnostic-log.txt')
    file.write((await readDiagLog()) || '(empty)')
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'This device cannot share files.')
      return
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Diagnostic log' })
  } catch (err) {
    Alert.alert('Export failed', (err as Error).message)
  }
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
      <KeyText size={13} bold={active}>
        {label}
      </KeyText>
    </Key>
  )
}
