import { useState } from 'react'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'

const UNIT_OPTIONS: { value: 'yards' | 'meters'; label: string }[] = [
  { value: 'yards', label: 'Yards' },
  { value: 'meters', label: 'Metres' },
]

export function SettingsPage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [error, setError] = useState<string | null>(null)
  const unit = profile?.distance_unit ?? 'yards'

  async function setUnit(value: 'yards' | 'meters') {
    setError(null)
    try {
      await updateProfile.mutateAsync({ distance_unit: value })
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
        {error && (
          <p className="text-caddie-neg" style={{ fontSize: 12, marginTop: 8 }}>
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
