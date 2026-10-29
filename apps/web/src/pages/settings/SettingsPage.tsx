import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FACILITIES,
  GOALS,
  HANDICAP_PROVENANCE_LABEL,
  SKILL_LEVELS,
  type Facility,
  type Goal,
  type SkillLevel,
} from '@oga/core'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'
import { useUserBag } from '../../hooks/useUserBag'
import { useHandicapMeta } from '../../hooks/useHandicapMeta'
import { useCountUp } from '../../hooks/useCountUp'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Rocker } from '../../components/ui/Rocker'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'
import './settings.css'

const UNIT_OPTIONS = [
  { value: 'yards', label: 'Yards' },
  { value: 'meters', label: 'Metres' },
] as const
const HAND_OPTIONS = [
  { value: 'right', label: 'Right-handed' },
  { value: 'left', label: 'Left-handed' },
] as const
const ON_OFF = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  casual: 'Casual',
  developing: 'Developing',
  competitive: 'Competitive',
}

const GOAL_LABELS: Record<Goal, string> = {
  break_100: 'Break 100',
  break_90: 'Break 90',
  break_80: 'Break 80',
  break_70s: 'Break 70s',
  scratch: 'Scratch',
}

const FACILITY_LABELS: Record<Facility, string> = {
  range: 'Range',
  short_game: 'Short game area',
  putting: 'Putting green',
  sim: 'Simulator',
}

// Mirrors the server-side username constraint: alphanumerics, hyphen,
// underscore; 3–32 chars. Empty string is also valid (username is
// nullable). Inlined rather than lifted to @oga/core because it has
// only two callers (web + mobile profile screens) — under the
// 3-caller extraction rule.
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/
const USERNAME_HELPER =
  '3–32 characters. Letters, numbers, - and _ only.'

// Typed to confirm the irreversible account delete, as on mobile.
const DELETE_PHRASE = 'delete my account'

export function SettingsPage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  // Two error slots: the profile fields save on the button, the rest on tap,
  // so each error shows beside the control that raised it.
  const [error, setError] = useState<string | null>(null)
  const [tapError, setTapError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [skill, setSkill] = useState<SkillLevel | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [saved, setSaved] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const { bag } = useUserBag()
  const { data: handicapMeta } = useHandicapMeta()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const unit = profile?.distance_unit ?? 'yards'
  const playsLeftHanded = profile?.plays_left_handed ?? false
  const emailSummaries = profile?.email_round_summaries_enabled ?? true

  // Only validate non-empty values — username is nullable in the DB so
  // clearing it is allowed. `usernameTouched` keeps the error hidden
  // until the user has actually started typing, so the field doesn't
  // open in a red state when the page loads with a blank profile.
  const trimmedUsername = username.trim()
  const usernameInvalid =
    trimmedUsername !== '' && !USERNAME_PATTERN.test(trimmedUsername)
  const showUsernameError = usernameTouched && usernameInvalid

  // Hydrate form fields the first time profile loads. Refetches (our own
  // save, or background refresh) must not stomp on values the user is in
  // the middle of editing — saveProfile() is the single source of truth
  // for committing changes back to the server.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!profile || hydratedRef.current) return
    hydratedRef.current = true
    setUsername(profile.username ?? '')
    setHandicap(profile.handicap_index?.toString() ?? '')
    setSkill((profile.skill_level as SkillLevel | null) ?? null)
    setGoal((profile.goal as Goal | null) ?? null)
    setFacilities((profile.facilities ?? []) as Facility[])
  }, [profile])

  function toggleFacility(f: Facility) {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  async function setUnit(value: 'yards' | 'meters') {
    setTapError(null)
    try {
      await updateProfile.mutateAsync({ distance_unit: value })
    } catch (err) {
      setTapError(toUserMessage(err))
    }
  }

  async function setPlaysLeftHanded(value: boolean) {
    setTapError(null)
    try {
      await updateProfile.mutateAsync({ plays_left_handed: value })
    } catch (err) {
      setTapError(toUserMessage(err))
    }
  }

  async function setEmailSummaries(value: boolean) {
    setTapError(null)
    try {
      await updateProfile.mutateAsync({ email_round_summaries_enabled: value })
    } catch (err) {
      setTapError(toUserMessage(err))
    }
  }

  async function saveProfile() {
    setError(null)
    setSaved(false)
    if (usernameInvalid) {
      setUsernameTouched(true)
      setError(USERNAME_HELPER)
      return
    }
    const numericHandicap = handicap === '' ? null : Number(handicap)
    if (handicap !== '' && Number.isNaN(numericHandicap)) {
      setError('Handicap must be a number')
      return
    }
    if (numericHandicap != null && (numericHandicap < -10 || numericHandicap > 54)) {
      setError('Handicap must be between -10 and 54')
      return
    }
    try {
      await updateProfile.mutateAsync({
        username: trimmedUsername || null,
        handicap_index: numericHandicap,
        skill_level: skill,
        goal,
        facilities,
      })
      setSaved(true)
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  // delete_my_account removes the auth user and everything under it; the
  // session stays valid until sign-out, so sign out straight after. On
  // success the auth listener drops the user and the guard sends them to
  // /login. A failed delete keeps the dialog open with the reason.
  async function deleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    let deleted = false
    try {
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) throw rpcError
      deleted = true
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (err) {
      setDeleteError(deleted ? 'Your account is deleted. Reload the page to finish signing out.' : toUserMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  function closeDelete() {
    if (deleting) return
    setDeleteOpen(false)
    setDeleteText('')
    setDeleteError(null)
  }

  const toggleRow = (key: string) => setOpenRow((cur) => (cur === key ? null : key))
  const dirty =
    !!profile &&
    (trimmedUsername !== (profile.username ?? '') ||
      handicap !== (profile.handicap_index?.toString() ?? '') ||
      skill !== ((profile.skill_level as SkillLevel | null) ?? null) ||
      goal !== ((profile.goal as Goal | null) ?? null) ||
      [...facilities].sort().join() !== [...((profile.facilities ?? []) as Facility[])].sort().join())
  const facilitiesValue =
    facilities.length === 0
      ? 'None set'
      : facilities.length === FACILITIES.length
        ? 'All four'
        : FACILITIES.filter((f) => facilities.includes(f)).map((f) => FACILITY_LABELS[f]).join(', ')

  const hcp = profile?.handicap_index ?? null
  const caption = [
    hcp != null && handicapMeta ? HANDICAP_PROVENANCE_LABEL[handicapMeta.provenance] : null,
    profile?.skill_level ? SKILL_LABELS[profile.skill_level as SkillLevel] : null,
    profile?.username ? `@${profile.username}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const tapAlert = tapError ? (
    <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
      {tapError}
    </p>
  ) : null

  return (
    <div style={{ maxWidth: 680 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15, marginBottom: 18 }}
      >
        Profile
      </h1>

      {/* The one headline number: no tile, just the figure and what it is. */}
      <div style={{ minHeight: 54, marginBottom: 10 }}>
        {profile ? <Hero value={hcp} caption={caption} /> : null}
      </div>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 30, maxWidth: 520, textWrap: 'pretty' }}>
        Your plans and drills are pitched at your skill level and handicap
        {handicapMeta?.provenance === 'calculated' ? ', calculated from your rated rounds.' : '.'}
      </p>

      <Group title="Your game">
        <Row
          label="Username"
          value={trimmedUsername || 'Not set'}
          open={openRow === 'username'}
          onToggle={() => toggleRow('username')}
          first
        >
          <input
            type="text"
            value={username}
            aria-label="Username"
            onChange={(e) => {
              setUsername(e.target.value)
              setUsernameTouched(true)
            }}
            aria-invalid={showUsernameError || undefined}
            autoCapitalize="off"
            autoCorrect="off"
            style={{
              ...inputStyle,
              width: '100%',
              maxWidth: 320,
              borderColor: showUsernameError ? '#A33A2A' : '#1C211C',
            }}
          />
          <div style={{ fontSize: 12, marginTop: 6, color: showUsernameError ? '#A33A2A' : '#5C6356' }}>
            {USERNAME_HELPER}
          </div>
        </Row>
        <Row
          label="Handicap index"
          value={handicap === '' ? 'Not set' : handicap}
          serifValue={handicap !== ''}
          open={openRow === 'handicap'}
          onToggle={() => toggleRow('handicap')}
        >
          <input
            type="number"
            inputMode="decimal"
            aria-label="Handicap index"
            min={-10}
            max={54}
            step={0.1}
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          />
        </Row>
        <Row
          label="Skill level"
          value={skill ? SKILL_LABELS[skill] : 'Not set'}
          open={openRow === 'skill'}
          onToggle={() => toggleRow('skill')}
        >
          <ChipRow>
            {SKILL_LEVELS.map((s) => (
              <Chip key={s} label={SKILL_LABELS[s]} active={skill === s} onClick={() => setSkill(skill === s ? null : s)} />
            ))}
          </ChipRow>
        </Row>
        <Row
          label="Goal"
          value={goal ? GOAL_LABELS[goal] : 'Not set'}
          open={openRow === 'goal'}
          onToggle={() => toggleRow('goal')}
        >
          <ChipRow>
            {GOALS.map((g) => (
              <Chip key={g} label={GOAL_LABELS[g]} active={goal === g} onClick={() => setGoal(goal === g ? null : g)} />
            ))}
          </ChipRow>
        </Row>
        <Row
          label="Where you practice"
          value={facilitiesValue}
          open={openRow === 'facilities'}
          onToggle={() => toggleRow('facilities')}
        >
          <ChipRow>
            {FACILITIES.map((f) => (
              <Chip key={f} label={FACILITY_LABELS[f]} active={facilities.includes(f)} onClick={() => toggleFacility(f)} />
            ))}
          </ChipRow>
          <Hint>Plans only pick drills you can run where you practice.</Hint>
        </Row>
        {dirty || saved ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 3 }}>
            {dirty ? (
              <button
                type="button"
                onClick={saveProfile}
                disabled={updateProfile.isPending || usernameInvalid}
                className="key key-primary"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {updateProfile.isPending ? 'Saving…' : 'Save changes'}
              </button>
            ) : null}
            {saved && !dirty ? (
              <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                Saved.
              </span>
            ) : null}
          </div>
        ) : null}
        {error && (
          <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, paddingTop: 10 }}>
            {error}
          </p>
        )}
      </Group>

      <Group title="Clubs and distances">
        <NavLinkRow to="/settings/bag" label="My bag" value={bag.length > 0 ? `${bag.length} clubs in the bag` : ''} first />
        <Row
          label="Distances in"
          value={unit === 'meters' ? 'Metres' : 'Yards'}
          open={openRow === 'units'}
          onToggle={() => toggleRow('units')}
        >
          <TapRocker pending={updateProfile.isPending}>
            <Rocker label="Distances in" options={UNIT_OPTIONS} value={unit === 'meters' ? 'meters' : 'yards'} onChange={setUnit} />
          </TapRocker>
          <Hint>Changes how distances read. Your shots are stored the same either way.</Hint>
          {tapAlert}
        </Row>
        <Row
          label="You play"
          value={playsLeftHanded ? 'Left-handed' : 'Right-handed'}
          open={openRow === 'plays'}
          onToggle={() => toggleRow('plays')}
        >
          <TapRocker pending={updateProfile.isPending}>
            <Rocker
              label="You play"
              options={HAND_OPTIONS}
              value={playsLeftHanded ? 'left' : 'right'}
              onChange={(v) => setPlaysLeftHanded(v === 'left')}
            />
          </TapRocker>
          <Hint>Mirrors the shot shape and start-line buttons: a left-hander's draw curves the other way.</Hint>
          {tapAlert}
        </Row>
      </Group>

      <Group title="Email">
        <Row
          label="Round summary"
          value={emailSummaries ? 'On' : 'Off'}
          open={openRow === 'email'}
          onToggle={() => toggleRow('email')}
          first
        >
          <TapRocker pending={updateProfile.isPending}>
            <Rocker
              label="Round summary email"
              options={ON_OFF}
              value={emailSummaries ? 'on' : 'off'}
              onChange={(v) => setEmailSummaries(v === 'on')}
            />
          </TapRocker>
          <Hint>The morning after you play.</Hint>
          {tapAlert}
        </Row>
      </Group>

      <Group title="Your data">
        <NavLinkRow to="/rounds/import" label="Import rounds" sub="From Golf Pad, or a scorecard spreadsheet." first />
      </Group>

      <Group title="Support OGA">
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, lineHeight: 1.55, padding: '0 0 12px', maxWidth: 520 }}>
          OGA is free and open source. If it helps your game, consider buying us a round.
        </p>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 15 }}>
          <a
            href="https://ko-fi.com/nartana"
            target="_blank"
            rel="noreferrer"
            className="text-caddie-ink underline underline-offset-4 hover:opacity-80"
          >
            Ko-fi ↗
          </a>
          <a
            href="https://github.com/sponsors/cner-smith"
            target="_blank"
            rel="noreferrer"
            className="text-caddie-ink underline underline-offset-4 hover:opacity-80"
          >
            GitHub Sponsors ↗
          </a>
        </div>
      </Group>

      <Group title="Account">
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-caddie-ink hover:bg-caddie-surface"
          style={{ ...rowStyle, fontSize: 15, cursor: 'pointer' }}
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="text-caddie-neg hover:bg-caddie-surface"
          style={{ ...rowStyle, fontSize: 15, cursor: 'pointer', borderTop: '1px solid #D9D2BF' }}
        >
          Delete account
        </button>
      </Group>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your OGA account?"
        message="This permanently deletes your account and all your rounds, shots and saved data. It can't be undone."
        confirmLabel="Delete account"
        destructive
        busy={deleting}
        error={deleteError}
        confirmDisabled={deleteText.trim().toLowerCase() !== DELETE_PHRASE}
        onConfirm={deleteAccount}
        onCancel={closeDelete}
      >
        <label style={{ display: 'block', marginBottom: 22 }}>
          <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Type <b className="text-caddie-ink">{DELETE_PHRASE}</b> to confirm.
          </span>
          <input
            type="text"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            disabled={deleting}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={DELETE_PHRASE}
            style={{ ...inputStyle, width: '100%' }}
          />
        </label>
      </ConfirmDialog>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  width: '100%',
  minHeight: 52,
  padding: '12px 4px',
  textAlign: 'left',
}

// The handicap as Profile's hero (mobile profile.tsx; audit SHL-07): an
// italic Fraunces figure that counts up once a session, its name and where
// it comes from in a column beside it.
function Hero({ value, caption }: { value: number | null; caption: string }) {
  const shown = useCountUp(value, { onceKey: 'oga-profile-counted' })
  // A 40px line box sets the digits' baseline near its bottom, so the column
  // (flush to the bottom) puts its caption on that baseline, as mobile does.
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, paddingTop: 10 }}>
      {value == null ? (
        <span className="font-serif text-caddie-ink-dim" style={{ fontSize: 30, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.1 }}>
          No handicap yet
        </span>
      ) : (
        <span className="font-serif tabular text-caddie-ink" style={{ fontSize: 54, fontStyle: 'italic', fontWeight: 500, letterSpacing: '-1.5px', lineHeight: '40px' }}>
          {/* The counting figure is hidden from screen readers; they get the value once. */}
          <span aria-hidden="true">{shown!.toFixed(1)}</span>
          <span className="sr-only">{value.toFixed(1)}</span>
        </span>
      )}
      <span className="prof-rise" style={{ display: 'block', marginBottom: -3, minWidth: 0 }}>
        {value != null ? (
          <span className="text-caddie-ink" style={{ display: 'block', fontSize: 17, lineHeight: 1.3 }}>
            Handicap index
          </span>
        ) : null}
        {caption ? (
          <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 13, lineHeight: 1.4 }}>
            {caption}
          </span>
        ) : null}
      </span>
    </div>
  )
}

// Paper section head (mobile paper/Section.tsx SectionHead): one ink rule,
// then a Fraunces-italic title.
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32, borderTop: '1px solid #1C211C', paddingTop: 12 }}>
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2, paddingBottom: 4 }}
      >
        {title}
      </h2>
      {children}
    </section>
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
    <div style={{ borderTop: first ? 'none' : '1px solid #D9D2BF' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-caddie-surface"
        style={{ ...rowStyle, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-caddie-ink" style={{ fontSize: 15 }}>
          {label}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            className={serifValue ? 'font-serif text-caddie-ink' : 'text-caddie-ink-dim'}
            style={{ fontSize: serifValue ? 18 : 15, textAlign: 'right' }}
          >
            {value}
          </span>
          <Chevron open={open} />
        </span>
      </button>
      {open ? (
        <div className="prof-open">
          <div style={{ padding: '6px 4px 16px' }}>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="prof-chev" data-open={open} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M2 4.25 6 8.25l4-4" fill="none" stroke="#5C6356" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A row that goes somewhere: label (and a line under it) left, › right.
function NavLinkRow({ to, label, value, sub, first }: { to: string; label: string; value?: string; sub?: string; first?: boolean }) {
  return (
    <Link
      to={to}
      className="hover:bg-caddie-surface"
      style={{ ...rowStyle, borderTop: first ? 'none' : '1px solid #D9D2BF', textDecoration: 'none' }}
    >
      <span>
        <span className="text-caddie-ink" style={{ fontSize: 15, display: 'block' }}>
          {label}
        </span>
        {sub ? (
          <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
            {sub}
          </span>
        ) : null}
      </span>
      <span className="text-caddie-ink-dim" style={{ fontSize: 15 }}>
        {value} <span aria-hidden="true">›</span>
      </span>
    </Link>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-caddie-ink-dim" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 10 }}>
      {children}
    </div>
  )
}

// These rows save on tap; the rocker sits still while a save is in flight.
function TapRocker({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, maxWidth: 320, opacity: pending ? 0.6 : 1 }}>
      {children}
    </fieldset>
  )
}

// A paper field: raised face, ink edge (mobile profile.tsx inputStyle).
const inputStyle: React.CSSProperties = {
  background: '#FBF8F1',
  border: '1px solid #1C211C',
  borderRadius: 3,
  padding: '10px 12px',
  fontSize: 15,
  color: '#1C211C',
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap" style={{ gap: '10px 8px', paddingBottom: 3 }}>
      {children}
    </div>
  )
}

// An option key, latched (pressed in, well face) while chosen: never filled
// forest (DESIGN.md, mobile profile.tsx Chip).
function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="key set-key" style={{ fontWeight: active ? 600 : 500 }}>
      {label}
    </button>
  )
}
