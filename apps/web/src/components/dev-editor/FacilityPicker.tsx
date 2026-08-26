import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchFacilities } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'
import {
  useCreateFacility,
  useEditorFacility,
  useUpdateCourse,
  useUpdateFacility,
} from '../../hooks/useCourseEditor'

type CourseRow = Database['public']['Tables']['courses']['Row']

const inputStyle: React.CSSProperties = {
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '8px 10px',
  fontSize: 13,
  width: '100%',
}

// Facility search is read-only (SELECT is open to everyone per RLS), so this
// goes through the plain anon `supabase` client — same as CourseSearch —
// rather than the dev-only /api/dev/* backend.
function useFacilitySearch(query: string) {
  return useQuery({
    queryKey: ['facilities', 'search', query],
    enabled: query.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await searchFacilities(supabase, query)
      if (error) throw error
      return data ?? []
    },
  })
}

export function FacilityPicker({ course }: { course: CourseRow }) {
  const facility = useEditorFacility(course.facility_id ?? undefined)
  const updateCourse = useUpdateCourse()
  const updateFacility = useUpdateFacility()
  const createFacility = useCreateFacility()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const search = useFacilitySearch(query)

  function link(facilityId: string | null) {
    updateCourse.mutate({
      id: course.id,
      patch: { facility_id: facilityId, unit_name: facilityId ? course.unit_name : null, unit_order: facilityId ? course.unit_order : null },
    })
    setQuery('')
  }

  return (
    <div
      className="bg-caddie-surface"
      style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="kicker">Facility</div>

      {course.facility_id && facility.data ? (
        <FacilityFields
          facility={facility.data}
          unitName={course.unit_name}
          unitOrder={course.unit_order}
          onUnlink={() => link(null)}
          onSaveUnit={(unitName, unitOrder) =>
            updateCourse.mutate({ id: course.id, patch: { unit_name: unitName, unit_order: unitOrder } })
          }
          onSaveFacility={(patch) => updateFacility.mutate({ id: facility.data!.id, patch })}
          saving={updateCourse.isPending || updateFacility.isPending}
        />
      ) : (
        <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
          Not linked to a facility (standalone course).
        </div>
      )}

      {(updateCourse.error || updateFacility.error) && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(updateCourse.error ?? updateFacility.error)}
        </div>
      )}

      {!creating ? (
        <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Search facilities to link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-caddie-accent"
            style={{ background: 'transparent', border: 'none', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            + New facility
          </button>
        </div>
      ) : (
        <NewFacilityForm
          busy={createFacility.isPending}
          error={createFacility.error as Error | null}
          onCancel={() => setCreating(false)}
          onSubmit={async (vals) => {
            // createFacility.error is already passed to NewFacilityForm above;
            // the try/catch just stops the rejection from becoming an
            // unhandled promise warning (onSubmit is invoked from onClick).
            try {
              const created = await createFacility.mutateAsync(vals)
              link(created.id)
              setCreating(false)
            } catch {
              // handled via createFacility.error
            }
          }}
        />
      )}

      {query.trim() && (
        <div style={{ border: '1px solid #D9D2BF', borderRadius: 2, maxHeight: 200, overflowY: 'auto' }}>
          {search.isLoading && (
            <div className="text-caddie-ink-mute" style={{ padding: 10, fontSize: 12 }}>
              Searching…
            </div>
          )}
          {(search.data ?? []).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => link(f.id)}
              className="block w-full text-left hover:bg-caddie-bg"
              style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid #D9D2BF' }}
            >
              {f.name}
              {f.city && <span className="text-caddie-ink-mute"> — {f.city}{f.state ? `, ${f.state}` : ''}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type FacilityRow = Database['public']['Tables']['facilities']['Row']
type FacilityUpdate = Database['public']['Tables']['facilities']['Update']

function FacilityFields({
  facility,
  unitName,
  unitOrder,
  onUnlink,
  onSaveUnit,
  onSaveFacility,
  saving,
}: {
  facility: FacilityRow
  unitName: string | null
  unitOrder: number | null
  onUnlink: () => void
  onSaveUnit: (unitName: string | null, unitOrder: number | null) => void
  onSaveFacility: (patch: FacilityUpdate) => void
  saving: boolean
}) {
  const [name, setName] = useState(facility.name)
  const [city, setCity] = useState(facility.city ?? '')
  const [state, setState] = useState(facility.state ?? '')
  const [country, setCountry] = useState(facility.country ?? '')
  const [website, setWebsite] = useState(facility.website ?? '')
  const [address, setAddress] = useState(facility.address ?? '')
  const [unit, setUnit] = useState(unitName ?? '')
  const [order, setOrder] = useState(unitOrder != null ? String(unitOrder) : '')

  useEffect(() => {
    setName(facility.name)
    setCity(facility.city ?? '')
    setState(facility.state ?? '')
    setCountry(facility.country ?? '')
    setWebsite(facility.website ?? '')
    setAddress(facility.address ?? '')
  }, [facility.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="grid grid-cols-2" style={{ gap: 8 }}>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Facility name" />
        <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        <input style={inputStyle} value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
        <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
        <input style={inputStyle} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
        <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
      </div>
      <div className="grid grid-cols-2" style={{ gap: 8 }}>
        <input style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit name (e.g. North Course)" />
        <input style={inputStyle} value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Unit order" type="number" />
      </div>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <button type="button" onClick={onUnlink} className="text-caddie-neg" style={{ background: 'transparent', border: 'none', fontSize: 12 }}>
          Unlink from facility
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            onSaveFacility({
              name: name.trim(),
              city: city.trim() || null,
              state: state.trim() || null,
              country: country.trim() || null,
              website: website.trim() || null,
              address: address.trim() || null,
            })
            onSaveUnit(unit.trim() || null, order.trim() === '' ? null : Number(order))
          }}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{ borderRadius: 2, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
        >
          {saving ? 'Saving…' : 'Save facility'}
        </button>
      </div>
    </div>
  )
}

function NewFacilityForm({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  error: Error | null
  onCancel: () => void
  onSubmit: (vals: { name: string; city: string | null; state: string | null; website: string | null; address: string | null }) => void
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  return (
    <div style={{ border: '1px dashed #D9D2BF', borderRadius: 2, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="grid grid-cols-3" style={{ gap: 8 }}>
        <input style={inputStyle} placeholder="Facility name" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={inputStyle} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input style={inputStyle} placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
      </div>
      {error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(error)}
        </div>
      )}
      <div className="flex" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ border: '1px solid #D9D2BF', background: 'transparent', borderRadius: 2, padding: '8px 12px', fontSize: 12 }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => onSubmit({ name: name.trim(), city: city.trim() || null, state: state.trim() || null, website: null, address: null })}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{ borderRadius: 2, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
        >
          {busy ? 'Creating…' : 'Create & link'}
        </button>
      </div>
    </div>
  )
}
