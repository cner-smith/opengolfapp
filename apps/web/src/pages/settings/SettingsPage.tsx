import { useEffect, useState } from 'react'
import {
  FACILITIES,
  GOALS,
  SKILL_LEVELS,
  type Facility,
  type Goal,
  type SkillLevel,
} from '@oga/core'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'

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
  short_game: 'Short Game',
  putting: 'Putting',
  sim: 'Sim',
}

export function SettingsPage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [skill, setSkill] = useState<SkillLevel | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [saved, setSaved] = useState(false)
  const unit = profile?.distance_unit ?? 'yards'

  useEffect(() => {
    setUsername(profile?.username ?? '')
    setHandicap(profile?.handicap_index?.toString() ?? '')
    setSkill((profile?.skill_level as SkillLevel | null) ?? null)
    setGoal((profile?.goal as Goal | null) ?? null)
    setFacilities((profile?.facilities ?? []) as Facility[])
  }, [
    profile?.username,
    profile?.handicap_index,
    profile?.skill_level,
    profile?.goal,
    profile?.facilities,
  ])

  function toggleFacility(f: Facility) {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  async function setUnit(value: 'yards' | 'meters') {
    setError(null)
    try {
      await updateProfile.mutateAsync({ distance_unit: value })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function saveProfile() {
    setError(null)
    setSaved(false)
    const trimmed = username.trim()
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
        username: trimmed || null,
        handicap_index: numericHandicap,
        skill_level: skill,
        goal,
        facilities,
      })
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Profile
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Settings
        </h1>
      </div>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Profile
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="kicker">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="kicker">Handicap index</span>
            <input
              type="number"
              inputMode="decimal"
              min={-10}
              max={54}
              step={0.1}
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={saveProfile}
              disabled={updateProfile.isPending}
              className="bg-caddie-accent text-caddie-accent-ink"
              style={{
                border: 'none',
                borderRadius: 2,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                opacity: updateProfile.isPending ? 0.5 : 1,
              }}
            >
              {updateProfile.isPending ? 'Saving…' : 'Save profile'}
            </button>
            {saved && (
              <span className="text-caddie-pos" style={{ fontSize: 12 }}>
                Saved.
              </span>
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Skill level
        </div>
        <ChipRow>
          {SKILL_LEVELS.map((s) => (
            <Chip
              key={s}
              label={SKILL_LABELS[s]}
              active={skill === s}
              onClick={() => setSkill(skill === s ? null : s)}
            />
          ))}
        </ChipRow>
      </section>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Goal
        </div>
        <ChipRow>
          {GOALS.map((g) => (
            <Chip
              key={g}
              label={GOAL_LABELS[g]}
              active={goal === g}
              onClick={() => setGoal(goal === g ? null : g)}
            />
          ))}
        </ChipRow>
      </section>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Facilities
        </div>
        <ChipRow>
          {FACILITIES.map((f) => (
            <Chip
              key={f}
              label={FACILITY_LABELS[f]}
              active={facilities.includes(f)}
              onClick={() => toggleFacility(f)}
            />
          ))}
        </ChipRow>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}
        >
          Practice plans use your available facilities to pick drills
          you can actually run.
        </p>
      </section>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Units
        </div>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {UNIT_OPTIONS.map((opt) => {
            const active = unit === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUnit(opt.value)}
                disabled={updateProfile.isPending}
                style={{
                  background: active ? '#1F3D2C' : '#EBE5D6',
                  color: active ? '#F2EEE5' : '#1C211C',
                  border: 'none',
                  borderRadius: 2,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  opacity: updateProfile.isPending ? 0.5 : 1,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}
        >
          Switches the display of distances throughout the app.
          Stored values stay in yards/feet — only formatting changes.
        </p>
      </section>

      <section
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 18,
          marginBottom: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          Support OGA
        </div>
        <p
          className="text-caddie-ink"
          style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 14, maxWidth: 520 }}
        >
          OGA is free and open source. If it helps your game,
          consider buying us a round.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://ko-fi.com/nartana"
            target="_blank"
            rel="noreferrer"
            className="text-caddie-accent"
            style={{
              border: '1px solid #1F3D2C',
              borderRadius: 2,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              textDecoration: 'none',
            }}
          >
            Ko-fi ↗
          </a>
          <a
            href="https://github.com/sponsors/cner-smith"
            target="_blank"
            rel="noreferrer"
            className="text-caddie-accent"
            style={{
              border: '1px solid #1F3D2C',
              borderRadius: 2,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              textDecoration: 'none',
            }}
          >
            GitHub Sponsors ↗
          </a>
        </div>
      </section>

      {error && (
        <p className="text-caddie-neg" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}
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
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? '#1F3D2C' : '#EBE5D6',
        color: active ? '#F2EEE5' : '#1C211C',
        border: 'none',
        borderRadius: 2,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
