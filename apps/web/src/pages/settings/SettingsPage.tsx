import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FACILITIES,
  GOALS,
  SKILL_LEVELS,
  type Facility,
  type Goal,
  type SkillLevel,
} from '@oga/core'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'
import { useUserBag } from '../../hooks/useUserBag'
import { toUserMessage } from '../../lib/errors'

const UNIT_OPTIONS: { value: 'yards' | 'meters'; label: string }[] = [
  { value: 'yards', label: 'Yards' },
  { value: 'meters', label: 'Metres' },
]

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

  return (
    <div style={{ maxWidth: 680 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15, marginBottom: 6 }}
      >
        Settings
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginBottom: 28 }}>
        Your plans and drills are pitched at your skill level and handicap.
      </p>

      <Group title="Your game">
        <Row
          label="Username"
          value={trimmedUsername || 'Not set'}
          open={openRow === 'username'}
          onToggle={() => toggleRow('username')}
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
              borderColor: showUsernameError ? '#A33A2A' : '#D9D2BF',
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
          last
        >
          <ChipRow>
            {FACILITIES.map((f) => (
              <Chip key={f} label={FACILITY_LABELS[f]} active={facilities.includes(f)} onClick={() => toggleFacility(f)} />
            ))}
          </ChipRow>
          <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Plans only pick drills you can run where you practice.
          </div>
        </Row>
        {dirty || saved ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14 }}>
            {dirty ? (
              <button
                type="button"
                onClick={saveProfile}
                disabled={updateProfile.isPending || usernameInvalid}
                className="bg-caddie-accent text-caddie-accent-ink"
                style={{
                  border: 'none',
                  borderRadius: 2,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  cursor: updateProfile.isPending || usernameInvalid ? 'not-allowed' : 'pointer',
                  opacity: updateProfile.isPending || usernameInvalid ? 0.5 : 1,
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
        <Link
          to="/settings/bag"
          className="hover:bg-caddie-surface"
          style={{ ...rowStyle, borderBottom: '1px solid #D9D2BF', textDecoration: 'none' }}
        >
          <span className="text-caddie-ink" style={{ fontSize: 15 }}>
            My bag
          </span>
          <span className="text-caddie-ink-dim" style={{ fontSize: 15 }}>
            {bag.length > 0 ? `${bag.length} clubs in the bag` : ''} <span aria-hidden="true">›</span>
          </span>
        </Link>
        <Row
          label="Distances in"
          value={unit === 'meters' ? 'Metres' : 'Yards'}
          open={openRow === 'units'}
          onToggle={() => toggleRow('units')}
        >
          <ChipRow>
            {UNIT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={unit === opt.value}
                disabled={updateProfile.isPending}
                onClick={() => setUnit(opt.value)}
              />
            ))}
          </ChipRow>
          <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Changes how distances read. Your shots are stored the same either way.
          </div>
        </Row>
        <Row
          label="You play"
          value={playsLeftHanded ? 'Left-handed' : 'Right-handed'}
          open={openRow === 'plays'}
          onToggle={() => toggleRow('plays')}
          last
        >
          <ChipRow>
            {([false, true] as const).map((lefty) => (
              <Chip
                key={String(lefty)}
                label={lefty ? 'Left-handed' : 'Right-handed'}
                active={playsLeftHanded === lefty}
                disabled={updateProfile.isPending}
                onClick={() => setPlaysLeftHanded(lefty)}
              />
            ))}
          </ChipRow>
          <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Mirrors the shot shape and start-line buttons: a left-hander's draw curves the other way.
          </div>
        </Row>
      </Group>

      {tapError && (
        <p className="text-caddie-neg" role="alert" style={{ fontSize: 13, marginTop: -20, marginBottom: 24 }}>
          {tapError}
        </p>
      )}

      <Group title="Email">
        <label style={{ ...rowStyle, cursor: 'pointer' }}>
          <span>
            <span className="text-caddie-ink" style={{ fontSize: 15, display: 'block' }}>
              Round summary
            </span>
            <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
              The morning after you play.
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-caddie-ink-dim" style={{ fontSize: 15 }}>
              {emailSummaries ? 'On' : 'Off'}
            </span>
            <input
              type="checkbox"
              checked={emailSummaries}
              disabled={updateProfile.isPending}
              onChange={(e) => setEmailSummaries(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#1F3D2C' }}
            />
          </span>
        </label>
      </Group>

      <Group title="Support OGA">
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, lineHeight: 1.55, padding: '12px 0 10px', maxWidth: 520 }}>
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        className="font-serif text-caddie-ink"
        style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2, paddingBottom: 8, borderBottom: '1px solid #D9D2BF' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
  serifValue,
  open,
  onToggle,
  last,
  children,
}: {
  label: string
  value: string
  serifValue?: boolean
  open: boolean
  onToggle: () => void
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: last && !open ? 'none' : '1px solid #D9D2BF' }}>
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
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span
            className={serifValue ? 'font-serif text-caddie-ink' : 'text-caddie-ink-dim'}
            style={{ fontSize: serifValue ? 18 : 15, textAlign: 'right' }}
          >
            {value}
          </span>
          <span className="text-caddie-ink-dim" aria-hidden="true" style={{ fontSize: 13 }}>
            {open ? 'Done' : 'Edit'}
          </span>
        </span>
      </button>
      {open ? <div style={{ padding: '2px 4px 16px' }}>{children}</div> : null}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '10px 12px',
  fontSize: 14,
  color: '#1C211C',
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      {children}
    </div>
  )
}

function Chip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        opacity: disabled ? 0.5 : 1,
        background: active ? '#1F3D2C' : '#EBE5D6',
        color: active ? '#F2EEE5' : '#1C211C',
        border: 'none',
        borderRadius: 2,
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
