import { useState } from 'react'
import type { Database } from '@oga/supabase'
import { toUserMessage } from '../../lib/errors'
import {
  useDeleteCourseTee,
  useSetPrimaryCourseTee,
  useSetPrimaryIfNone,
  useUpdateCourseTeeById,
  useUpsertCourseTee,
} from '../../hooks/useCourseEditor'

type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

const inputStyle: React.CSSProperties = {
  background: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '8px 10px',
  fontSize: 13,
  color: '#1C211C',
  width: '100%',
}

export function TeesEditor({ courseId, tees }: { courseId: string; tees: CourseTeeRow[] }) {
  const upsert = useUpsertCourseTee()
  const update = useUpdateCourseTeeById()
  const del = useDeleteCourseTee()
  const setPrimary = useSetPrimaryCourseTee()
  const setPrimaryIfNone = useSetPrimaryIfNone()
  const [adding, setAdding] = useState(false)
  const hasPrimary = tees.some((t) => t.is_primary)

  return (
    <div
      className="bg-caddie-surface"
      style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="kicker">Tees ({tees.length})</div>

      {tees.map((tee) => (
        <TeeRowEditor
          key={tee.id}
          tee={tee}
          isPrimary={tee.is_primary}
          onSetPrimary={() => setPrimary.mutate({ id: tee.id, courseId })}
          onSave={(patch) => update.mutate({ id: tee.id, courseId, patch })}
          onDelete={() => del.mutate({ id: tee.id, courseId })}
          saving={update.isPending}
        />
      ))}

      {(upsert.error || update.error || del.error || setPrimary.error || setPrimaryIfNone.error) && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(upsert.error ?? update.error ?? del.error ?? setPrimary.error ?? setPrimaryIfNone.error)}
        </div>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="font-mono uppercase text-caddie-ink-dim hover:text-caddie-ink"
          style={{ background: 'transparent', border: '1px dashed #D9D2BF', borderRadius: 2, padding: '10px 14px', fontSize: 11, letterSpacing: '0.14em' }}
        >
          + Add tee
        </button>
      ) : (
        <TeeRowEditor
          tee={null}
          willBecomePrimary={!hasPrimary}
          onSave={async (patch) => {
            const result = await upsert.mutateAsync({ courseId, tee: { ...patch, course_id: courseId } })
            setAdding(false)
            // Auto-promote to primary, but only if the course truly has no
            // primary tee yet — setPrimaryIfNone re-checks the database
            // itself rather than trusting this component's `tees` prop, so
            // a second tee added while an earlier "set primary" is still
            // in flight can't steal primary status from the existing one.
            const created = result.data[0]
            if (created) {
              setPrimaryIfNone.mutate({ id: created.id, courseId })
            }
          }}
          onCancel={() => setAdding(false)}
          saving={upsert.isPending}
        />
      )}
    </div>
  )
}

interface TeePatch {
  tee_color: string
  tee_name: string | null
  course_rating: number | null
  slope_rating: number | null
  total_yards: number | null
  par: number | null
}

function TeeRowEditor({
  tee,
  isPrimary,
  willBecomePrimary,
  onSetPrimary,
  onSave,
  onDelete,
  onCancel,
  saving,
}: {
  tee: CourseTeeRow | null
  isPrimary?: boolean
  willBecomePrimary?: boolean
  onSetPrimary?: () => void
  onSave: (patch: TeePatch) => void
  onDelete?: () => void
  onCancel?: () => void
  saving: boolean
}) {
  const [color, setColor] = useState(tee?.tee_color ?? '')
  const [name, setName] = useState(tee?.tee_name ?? '')
  const [rating, setRating] = useState(tee?.course_rating != null ? String(tee.course_rating) : '')
  const [slope, setSlope] = useState(tee?.slope_rating != null ? String(tee.slope_rating) : '')
  const [yards, setYards] = useState(tee?.total_yards != null ? String(tee.total_yards) : '')
  const [par, setPar] = useState(tee?.par != null ? String(tee.par) : '')

  function commit() {
    if (!color.trim()) return
    onSave({
      tee_color: color.trim().toLowerCase(),
      tee_name: name.trim() || null,
      course_rating: rating.trim() === '' ? null : Number(rating),
      slope_rating: slope.trim() === '' ? null : Number(slope),
      total_yards: yards.trim() === '' ? null : Number(yards),
      par: par.trim() === '' ? null : Number(par),
    })
  }

  return (
    <div
      style={{
        border: `1px solid ${isPrimary ? '#1F3D2C' : '#D9D2BF'}`,
        borderRadius: 2,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="grid grid-cols-3 sm:grid-cols-6" style={{ gap: 8 }}>
        <Field label="Color">
          <input style={inputStyle} value={color} onChange={(e) => setColor(e.target.value)} placeholder="white" />
        </Field>
        <Field label="Name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rating">
          <input style={inputStyle} type="number" step="0.1" value={rating} onChange={(e) => setRating(e.target.value)} />
        </Field>
        <Field label="Slope">
          <input style={inputStyle} type="number" value={slope} onChange={(e) => setSlope(e.target.value)} />
        </Field>
        <Field label="Yards">
          <input style={inputStyle} type="number" value={yards} onChange={(e) => setYards(e.target.value)} />
        </Field>
        <Field label="Par">
          <input style={inputStyle} type="number" value={par} onChange={(e) => setPar(e.target.value)} />
        </Field>
      </div>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {isPrimary ? (
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: '0.14em', color: '#1F3D2C', fontWeight: 600 }}
            >
              ★ Primary — this tee's data is the course default (edited in Holes as this tee)
            </span>
          ) : onSetPrimary ? (
            <button
              type="button"
              onClick={onSetPrimary}
              className="text-caddie-ink-mute hover:text-caddie-ink"
              style={{ background: 'transparent', border: 'none', fontSize: 11 }}
            >
              Set as primary
            </button>
          ) : willBecomePrimary ? (
            <span className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
              First tee on this course — becomes primary automatically
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex" style={{ gap: 8 }}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ border: '1px solid #D9D2BF', background: 'transparent', borderRadius: 2, padding: '8px 12px', fontSize: 12 }}>
              Cancel
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-caddie-neg" style={{ background: 'transparent', border: 'none', fontSize: 12 }}>
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={commit}
            disabled={saving || !color.trim()}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
            style={{ borderRadius: 2, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="font-mono uppercase text-caddie-ink-mute" style={{ fontSize: 9, letterSpacing: '0.14em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
