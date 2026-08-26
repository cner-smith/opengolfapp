import { useEffect, useState } from 'react'
import type { Database } from '@oga/supabase'
import { toUserMessage } from '../../lib/errors'
import { useUpdateCourse } from '../../hooks/useCourseEditor'
import { CourseMapPicker } from './CourseMapPicker'

type CourseRow = Database['public']['Tables']['courses']['Row']

const inputStyle: React.CSSProperties = {
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '10px 12px',
  fontSize: 14,
  width: '100%',
}

const labelStyle: React.CSSProperties = { fontSize: 11, marginBottom: 4 }

interface FieldState {
  name: string
  city: string
  state: string
  country: string
  external_id: string
  website: string
  address: string
  lat: string
  lng: string
}

function toFieldState(course: CourseRow): FieldState {
  return {
    name: course.name,
    city: course.city ?? '',
    state: course.state ?? '',
    country: course.country ?? '',
    external_id: course.external_id ?? '',
    website: course.website ?? '',
    address: course.address ?? '',
    lat: course.lat != null ? String(course.lat) : '',
    lng: course.lng != null ? String(course.lng) : '',
  }
}

export function CourseFieldsForm({ course }: { course: CourseRow }) {
  const [fields, setFields] = useState<FieldState>(() => toFieldState(course))
  const [justSaved, setJustSaved] = useState(false)
  const update = useUpdateCourse()

  // Course identity changed (navigated to a different course) — reset the
  // form instead of carrying over stale local edits.
  useEffect(() => {
    setFields(toFieldState(course))
    setJustSaved(false)
  }, [course.id])

  // Auto-hide the "Saved" confirmation a couple seconds after it appears.
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(false), 2500)
    return () => window.clearTimeout(t)
  }, [justSaved])

  function set<K extends keyof FieldState>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    // A field just changed — the "Saved" confirmation no longer reflects
    // what's on screen, so drop it rather than let it linger stale.
    setJustSaved(false)
  }

  function save() {
    update.mutate(
      {
        id: course.id,
        patch: {
          name: fields.name.trim(),
          city: fields.city.trim() || null,
          state: fields.state.trim() || null,
          country: fields.country.trim() || null,
          external_id: fields.external_id.trim() || null,
          website: fields.website.trim() || null,
          address: fields.address.trim() || null,
          lat: fields.lat.trim() === '' ? null : Number(fields.lat),
          lng: fields.lng.trim() === '' ? null : Number(fields.lng),
        },
      },
      { onSuccess: () => setJustSaved(true) },
    )
  }

  const lat = fields.lat.trim() === '' ? null : Number(fields.lat)
  const lng = fields.lng.trim() === '' ? null : Number(fields.lng)
  const markers = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
    ? [{ id: 'course', lat, lng }]
    : []

  return (
    <div
      className="bg-caddie-surface"
      style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="kicker">Course details</div>

      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Name</div>
          <input style={inputStyle} value={fields.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>External ID (OpenGolfAPI)</div>
          <input style={inputStyle} value={fields.external_id} onChange={(e) => set('external_id', e.target.value)} />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>City</div>
          <input style={inputStyle} value={fields.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>State</div>
          <input style={inputStyle} value={fields.state} onChange={(e) => set('state', e.target.value)} />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Country</div>
          <input style={inputStyle} value={fields.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. Scotland, UK" />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Website</div>
          <input style={inputStyle} value={fields.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Address</div>
          <input style={inputStyle} value={fields.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Latitude</div>
          <input style={inputStyle} value={fields.lat} onChange={(e) => set('lat', e.target.value)} placeholder="e.g. 55.9533" />
        </label>
        <label>
          <div className="text-caddie-ink-mute" style={labelStyle}>Longitude</div>
          <input style={inputStyle} value={fields.lng} onChange={(e) => set('lng', e.target.value)} placeholder="e.g. -3.1883" />
        </label>
      </div>

      {/* No geocoding API call — just a prefilled Google Maps search so the
          developer can copy the address/website back into the fields above
          by hand. */}
      <a
        href={`https://www.google.com/maps/search/${encodeURIComponent([fields.name, fields.city, fields.state].filter(Boolean).join(' '))}`}
        target="_blank"
        rel="noreferrer"
        className="text-caddie-accent"
        style={{ fontSize: 12 }}
      >
        Look up address/website on Google Maps →
      </a>

      <div>
        <div className="text-caddie-ink-mute" style={{ ...labelStyle, marginBottom: 8 }}>
          {markers.length === 0
            ? 'No location set — zoom/pan to the course and click the map to drop a pin (or type coordinates above).'
            : 'Drag the pin to fine-tune, or click elsewhere on the map to move it.'}
        </div>
        <CourseMapPicker
          markers={markers}
          clickToPlaceId="course"
          onMarkerMove={(_id, point) => {
            set('lat', String(point.lat))
            set('lng', String(point.lng))
          }}
        />
      </div>

      {update.error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(update.error)}
        </div>
      )}

      <div className="flex" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        {justSaved && (
          <span className="text-caddie-accent" style={{ fontSize: 12, fontWeight: 500 }}>
            ✓ Saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={update.isPending || !fields.name.trim()}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{ borderRadius: 2, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
        >
          {update.isPending ? 'Saving…' : 'Save course details'}
        </button>
      </div>
    </div>
  )
}
