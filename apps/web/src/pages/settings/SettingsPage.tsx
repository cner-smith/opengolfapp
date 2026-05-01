import { useEffect, useState } from 'react'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'

const UNIT_OPTIONS: { value: 'yards' | 'meters'; label: string }[] = [
  { value: 'yards', label: 'Yards' },
  { value: 'meters', label: 'Metres' },
]

export function SettingsPage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [handicap, setHandicap] = useState('')
  const [saved, setSaved] = useState(false)
  const unit = profile?.distance_unit ?? 'yards'

  useEffect(() => {
    setUsername(profile?.username ?? '')
    setHandicap(profile?.handicap_index?.toString() ?? '')
  }, [profile?.username, profile?.handicap_index])

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
    try {
      await updateProfile.mutateAsync({
        username: trimmed || null,
        handicap_index: numericHandicap,
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
              type="text"
              inputMode="decimal"
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
