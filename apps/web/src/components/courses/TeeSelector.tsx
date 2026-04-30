import { useState } from 'react'
import { useCourseTees, useCreateCourseTee } from '../../hooks/useCourses'
import { useUnits } from '../../hooks/useUnits'

interface TeeRow {
  id: string
  tee_color: string
  course_rating: number | null
  slope_rating: number | null
  total_yards: number | null
  par: number | null
}

interface Props {
  courseId: string
  selectedTeeId: string | null
  onSelect: (teeId: string, teeColor: string) => void
}

export function TeeSelector({ courseId, selectedTeeId, onSelect }: Props) {
  const tees = useCourseTees(courseId)
  const createTee = useCreateCourseTee()
  const { toDisplay } = useUnits()
  const [adding, setAdding] = useState(false)

  const rows = (tees.data ?? []) as TeeRow[]

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {tees.isLoading && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
          Loading tees…
        </div>
      )}
      {!tees.isLoading && rows.length === 0 && !adding && (
        <div
          className="text-caddie-ink-mute"
          style={{
            border: '1px dashed #D9D2BF',
            borderRadius: 2,
            padding: 14,
            fontSize: 13,
          }}
        >
          No tees on file. Add one to enable handicap differential.
        </div>
      )}
      {rows.map((t) => {
        const active = selectedTeeId === t.id
        const hasRating = t.course_rating != null && t.slope_rating != null
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id, t.tee_color)}
            className="flex items-baseline justify-between"
            style={{
              background: active ? '#1F3D2C' : '#FBF8F1',
              color: active ? '#F2EEE5' : '#1C211C',
              border: `1px solid ${active ? '#1F3D2C' : '#D9D2BF'}`,
              borderRadius: 2,
              padding: '12px 14px',
              cursor: 'pointer',
              gap: 14,
              textAlign: 'left',
            }}
          >
            <span
              className="font-serif"
              style={{
                fontSize: 17,
                fontWeight: 500,
                fontStyle: 'italic',
                textTransform: 'capitalize',
              }}
            >
              {t.tee_color}
            </span>
            <span
              className="font-mono uppercase tabular"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                color: active ? 'rgba(242,238,229,0.75)' : '#5C6356',
              }}
            >
              {hasRating
                ? `${t.course_rating?.toFixed(1)} / ${t.slope_rating}`
                : 'No rating'}
              {t.total_yards != null ? ` · ${toDisplay(t.total_yards)}` : ''}
            </span>
          </button>
        )
      })}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="font-mono uppercase text-caddie-ink-dim hover:text-caddie-ink"
          style={{
            background: 'transparent',
            border: '1px dashed #D9D2BF',
            borderRadius: 2,
            padding: '10px 14px',
            fontSize: 11,
            letterSpacing: '0.14em',
          }}
        >
          + Add tee
        </button>
      ) : (
        <AddTeeForm
          courseId={courseId}
          busy={createTee.isPending}
          error={createTee.error as Error | null}
          onCancel={() => setAdding(false)}
          onSubmit={async (vals) => {
            const tee = await createTee.mutateAsync({
              course_id: courseId,
              tee_color: vals.color,
              course_rating: vals.rating,
              slope_rating: vals.slope,
              total_yards: vals.yards,
            })
            if (tee) onSelect(tee.id, tee.tee_color)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function AddTeeForm({
  courseId: _courseId,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  courseId: string
  busy: boolean
  error: Error | null
  onCancel: () => void
  onSubmit: (vals: {
    color: string
    rating: number | null
    slope: number | null
    yards: number | null
  }) => void
}) {
  const [color, setColor] = useState('white')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [yards, setYards] = useState('')

  function commit() {
    if (!color.trim()) return
    onSubmit({
      color: color.trim(),
      rating: rating ? Number(rating) : null,
      slope: slope ? parseInt(slope, 10) : null,
      yards: yards ? parseInt(yards, 10) : null,
    })
  }

  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="kicker">Add tee</div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: 8 }}
      >
        <Field label="Color">
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Rating">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="71.2"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Slope">
          <input
            type="number"
            inputMode="numeric"
            min={55}
            max={155}
            placeholder="124"
            value={slope}
            onChange={(e) => setSlope(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Yards">
          <input
            type="number"
            inputMode="numeric"
            placeholder="6450"
            value={yards}
            onChange={(e) => setYards(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
      {error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {error.message}
        </div>
      )}
      <div className="flex justify-end" style={{ gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: '1px solid #D9D2BF',
            background: 'transparent',
            borderRadius: 2,
            padding: '8px 12px',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={busy || !color.trim()}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{
            borderRadius: 2,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {busy ? 'Saving…' : 'Add tee'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        className="font-mono uppercase text-caddie-ink-mute"
        style={{ fontSize: 9, letterSpacing: '0.14em' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '8px 10px',
  fontSize: 13,
  color: '#1C211C',
}
