import { useEffect, useState } from 'react'
import type { Database } from '@oga/supabase'
import { toUserMessage } from '../../lib/errors'
import {
  useDeleteHole,
  useDeleteHoleTee,
  useUpsertHoleTees,
  useUpsertHoles,
} from '../../hooks/useCourseEditor'
import { CourseMapPicker } from './CourseMapPicker'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

interface EditableHole {
  id: string | null
  number: number
  par: number
  yards: string
  stroke_index: string
  tee_lat: number | null
  tee_lng: number | null
  pin_lat: number | null
  pin_lng: number | null
}

function toEditable(h: HoleRow): EditableHole {
  return {
    id: h.id,
    number: h.number,
    par: h.par,
    yards: h.yards != null ? String(h.yards) : '',
    stroke_index: h.stroke_index != null ? String(h.stroke_index) : '',
    tee_lat: h.tee_lat,
    tee_lng: h.tee_lng,
    pin_lat: h.pin_lat,
    pin_lng: h.pin_lng,
  }
}

// A hole_tees row's columns are individually nullable — display blank
// ("inherits base") whether that's because no override row exists at all,
// or because the row exists but this particular field wasn't set. Both
// read the same on save: an unchanged blank never gets written.
interface EditableHoleTee {
  overrideId: string | null
  holeId: string
  number: number
  par: string
  yards: string
  strokeIndex: string
  teeLat: number | null
  teeLng: number | null
  hasOverride: boolean
  // The base holes row's values — shown as each input's placeholder (not
  // the literal word "base") so the override, when present, is directly
  // comparable against what it's replacing without switching tabs.
  basePar: string
  baseYards: string
  baseStrokeIndex: string
}

function seedTeeRows(
  baseRows: EditableHole[],
  holeTees: HoleTeeRow[],
  courseTeeId: string,
): EditableHoleTee[] {
  return baseRows
    .filter((r): r is EditableHole & { id: string } => r.id != null)
    .map((r) => {
      const override = holeTees.find((ht) => ht.hole_id === r.id && ht.course_tee_id === courseTeeId)
      return {
        overrideId: override?.id ?? null,
        holeId: r.id,
        number: r.number,
        par: override?.par != null ? String(override.par) : '',
        yards: override?.yards != null ? String(override.yards) : '',
        strokeIndex: override?.stroke_index != null ? String(override.stroke_index) : '',
        teeLat: override?.tee_lat ?? r.tee_lat,
        teeLng: override?.tee_lng ?? r.tee_lng,
        hasOverride: override != null,
        basePar: String(r.par),
        baseYards: r.yards || '—',
        baseStrokeIndex: r.stroke_index || '—',
      }
    })
}

const cellInput: React.CSSProperties = {
  border: '1px solid #D9D2BF',
  borderRadius: 2,
  padding: '6px 8px',
  fontSize: 13,
  width: '100%',
}

const cellInputError: React.CSSProperties = {
  ...cellInput,
  border: '1px solid #A33A2A',
  backgroundColor: '#F1DCD7',
}

// Stroke index must be a permutation of 1..holeCount — each hole gets a
// distinct difficulty rank, nothing beyond the course's hole count. Blank
// entries aren't flagged (not every hole needs a value yet), but anything
// entered must be in range and not collide with another hole's value.
function findStrokeIndexIssues(
  entries: Array<{ number: number; strokeIndex: number | null }>,
  holeCount: number,
): Map<number, string> {
  const issues = new Map<number, string>()
  const holesByValue = new Map<number, number[]>()
  for (const e of entries) {
    if (e.strokeIndex == null) continue
    if (!Number.isInteger(e.strokeIndex) || e.strokeIndex < 1 || e.strokeIndex > holeCount) {
      issues.set(e.number, `Stroke index must be 1–${holeCount}`)
      continue
    }
    const holes = holesByValue.get(e.strokeIndex) ?? []
    holes.push(e.number)
    holesByValue.set(e.strokeIndex, holes)
  }
  for (const [value, holeNumbers] of holesByValue) {
    if (holeNumbers.length < 2) continue
    for (const n of holeNumbers) {
      issues.set(n, `Stroke index ${value} used on holes ${holeNumbers.join(', ')}`)
    }
  }
  return issues
}

export function HolesEditor({
  courseId,
  holes,
  courseTees,
  holeTees,
  courseLocation,
}: {
  courseId: string
  holes: HoleRow[]
  courseTees: CourseTeeRow[]
  holeTees: HoleTeeRow[]
  courseLocation: { lat: number; lng: number } | null
}) {
  const [rows, setRows] = useState<EditableHole[]>(() => holes.map(toEditable))
  const [selectedTee, setSelectedTee] = useState<string>('base')
  const [teeRows, setTeeRows] = useState<EditableHoleTee[]>([])
  const [teeDirty, setTeeDirty] = useState<Set<number>>(new Set())
  const [focused, setFocused] = useState<number | null>(null)
  const [placing, setPlacing] = useState<'tee' | 'pin'>('tee')
  const upsert = useUpsertHoles()
  const del = useDeleteHole()
  const upsertHoleTees = useUpsertHoleTees()
  const deleteHoleTee = useDeleteHoleTee()

  // The tee whose data IS the base `holes` row, replacing the old unlabeled
  // "Base" concept — set via "Set as primary" in the Tees section below (or
  // automatically on a course's first tee). Courses with no primary tee yet
  // (none created, or none designated) fall back to the literal 'base'
  // sentinel so editing is never blocked on choosing one first.
  const primaryTee = courseTees.find((t) => t.is_primary) ?? null
  const isPrimarySelected = primaryTee != null && selectedTee === primaryTee.id

  useEffect(() => {
    setRows(holes.map(toEditable))
    setSelectedTee('base')
  }, [courseId])

  // Once a primary tee exists, it stands in for 'base' — auto-select it the
  // first time it becomes available (e.g. on load) rather than leaving the
  // editor sitting on the no-longer-shown 'base' sentinel. Only fires while
  // still on 'base' so it doesn't fight a deliberate switch to another tee.
  useEffect(() => {
    if (primaryTee && selectedTee === 'base') {
      setSelectedTee(primaryTee.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryTee?.id])

  // Re-seed whenever the selected tee changes — switching away from a tee
  // with unsaved edits discards them (rows in `teeDirty` are visually
  // marked, same tradeoff as the base table). The primary tee never gets
  // override rows — selecting it edits `rows` (base) directly, same as the
  // old 'base' sentinel did.
  useEffect(() => {
    if (selectedTee === 'base' || selectedTee === primaryTee?.id) {
      setTeeRows([])
      setTeeDirty(new Set())
      return
    }
    setTeeRows(seedTeeRows(rows, holeTees, selectedTee))
    setTeeDirty(new Set())
    // rows/holeTees intentionally excluded — only re-seed on an explicit
    // tee switch, not on every base-row edit or background refetch, so
    // in-progress tee edits aren't clobbered mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTee, primaryTee?.id])

  function updateRow(number: number, patch: Partial<EditableHole>) {
    setRows((prev) => prev.map((r) => (r.number === number ? { ...r, ...patch } : r)))
  }

  function updateTeeRow(number: number, patch: Partial<EditableHoleTee>) {
    setTeeRows((prev) => prev.map((r) => (r.number === number ? { ...r, ...patch } : r)))
    setTeeDirty((prev) => new Set(prev).add(number))
  }

  function addHole() {
    const used = new Set(rows.map((r) => r.number))
    let next = 1
    while (used.has(next) && next <= 18) next++
    setRows((prev) =>
      [...prev, { id: null, number: next, par: 4, yards: '', stroke_index: '', tee_lat: null, tee_lng: null, pin_lat: null, pin_lng: null }].sort(
        (a, b) => a.number - b.number,
      ),
    )
  }

  async function saveAll() {
    const payload = rows.map((r) => ({
      course_id: courseId,
      number: r.number,
      par: r.par,
      yards: r.yards.trim() === '' ? null : Number(r.yards),
      stroke_index: r.stroke_index.trim() === '' ? null : Number(r.stroke_index),
      tee_lat: r.tee_lat,
      tee_lng: r.tee_lng,
      pin_lat: r.pin_lat,
      pin_lng: r.pin_lng,
    }))
    const result = await upsert.mutateAsync({ courseId, holes: payload })
    setRows((prev) =>
      prev.map((r) => {
        const saved = result.data.find((d) => d.number === r.number)
        return saved ? { ...r, id: saved.id } : r
      }),
    )
  }

  async function saveTeeOverrides() {
    const dirtyRows = teeRows.filter((r) => teeDirty.has(r.number))
    if (dirtyRows.length === 0) return
    const payload = dirtyRows.map((r) => ({
      hole_id: r.holeId,
      course_tee_id: selectedTee,
      par: r.par.trim() === '' ? null : Number(r.par),
      yards: r.yards.trim() === '' ? null : Number(r.yards),
      stroke_index: r.strokeIndex.trim() === '' ? null : Number(r.strokeIndex),
      tee_lat: r.teeLat,
      tee_lng: r.teeLng,
    }))
    const { data } = await upsertHoleTees.mutateAsync({ courseId, rows: payload })
    setTeeRows((prev) =>
      prev.map((r) => {
        const saved = data.find((d) => d.hole_id === r.holeId && d.course_tee_id === selectedTee)
        return saved ? { ...r, overrideId: saved.id, hasOverride: true } : r
      }),
    )
    setTeeDirty(new Set())
  }

  async function clearOverride(row: EditableHoleTee) {
    if (!row.overrideId) return
    await deleteHoleTee.mutateAsync({ id: row.overrideId, courseId })
    const base = rows.find((r) => r.number === row.number)
    setTeeRows((prev) =>
      prev.map((r) =>
        r.number === row.number
          ? { ...r, overrideId: null, hasOverride: false, par: '', yards: '', strokeIndex: '', teeLat: base?.tee_lat ?? null, teeLng: base?.tee_lng ?? null }
          : r,
      ),
    )
    setTeeDirty((prev) => {
      const next = new Set(prev)
      next.delete(row.number)
      return next
    })
  }

  async function deleteRow(row: EditableHole) {
    if (row.id) {
      await del.mutateAsync({ id: row.id, courseId })
    }
    setRows((prev) => prev.filter((r) => r.number !== row.number))
    if (focused === row.number) setFocused(null)
  }

  const inTeeMode = selectedTee !== 'base' && !isPrimarySelected

  // Validate the stroke index set actually in play for the current mode —
  // in tee mode that's each hole's override where present, falling back to
  // the base value otherwise (matching what actually gets saved/used).
  const siIssues = inTeeMode
    ? findStrokeIndexIssues(
        rows
          .filter((r) => r.id != null)
          .map((r) => {
            const override = teeRows.find((t) => t.number === r.number)
            const overrideVal = override?.strokeIndex.trim()
            const strokeIndex =
              overrideVal ? Number(overrideVal) : r.stroke_index.trim() === '' ? null : Number(r.stroke_index)
            return { number: r.number, strokeIndex }
          }),
        rows.length,
      )
    : findStrokeIndexIssues(
        rows.map((r) => ({
          number: r.number,
          strokeIndex: r.stroke_index.trim() === '' ? null : Number(r.stroke_index),
        })),
        rows.length,
      )
  const hasSIIssues = siIssues.size > 0

  const focusedBaseRow = rows.find((r) => r.number === focused) ?? null
  const focusedTeeRow = teeRows.find((r) => r.number === focused) ?? null
  const teeMarkerSource = inTeeMode
    ? focusedTeeRow
      ? { lat: focusedTeeRow.teeLat, lng: focusedTeeRow.teeLng }
      : null
    : focusedBaseRow
      ? { lat: focusedBaseRow.tee_lat, lng: focusedBaseRow.tee_lng }
      : null
  const focusedMarkers = focusedBaseRow
    ? [
        teeMarkerSource?.lat != null && teeMarkerSource?.lng != null
          ? { id: 'tee', lat: teeMarkerSource.lat, lng: teeMarkerSource.lng, color: '#1F3D2C' }
          : null,
        // Pin is never tee-specific — always the base hole's pin, in both modes.
        focusedBaseRow.pin_lat != null && focusedBaseRow.pin_lng != null
          ? { id: 'pin', lat: focusedBaseRow.pin_lat, lng: focusedBaseRow.pin_lng, color: '#B23B3B' }
          : null,
      ].filter((m): m is { id: string; lat: number; lng: number; color: string } => m != null)
    : []

  return (
    <div
      className="bg-caddie-surface"
      style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="kicker">Holes ({rows.length})</div>
        {/* Always mounted (visibility, not conditional render) — toggling
            this button in/out of the DOM shrank the row and made the table
            below jump on every base/tee switch. */}
        <button
          type="button"
          onClick={addHole}
          disabled={rows.length >= 18}
          className="text-caddie-accent disabled:opacity-50"
          style={{
            fontSize: 12,
            background: 'transparent',
            border: 'none',
            visibility: inTeeMode ? 'hidden' : 'visible',
            pointerEvents: inTeeMode ? 'none' : 'auto',
          }}
        >
          + Add hole
        </button>
      </div>

      {courseTees.length > 0 && (
        <div>
          <div className="text-caddie-ink-mute" style={{ fontSize: 11, marginBottom: 6 }}>
            {inTeeMode
              ? `Editing tee overrides — blank shows the ${primaryTee ? primaryTee.tee_color : 'base'} value`
              : isPrimarySelected
                ? `Editing ${primaryTee!.tee_color} — this tee's data is the course's base, used when no other tee has an override`
                : 'Editing base values (no primary tee set — see Tees below)'}
          </div>
          <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
            {/* Only shown once no tee has been designated primary — once
                one is, it stands in for 'base' and this sentinel is
                unreachable via the UI. */}
            {!primaryTee && (
              <PlacingChip label="Base" active={selectedTee === 'base'} onClick={() => setSelectedTee('base')} />
            )}
            {courseTees.map((t) => (
              <PlacingChip
                key={t.id}
                label={t.is_primary ? `★ ${t.tee_color}` : t.tee_color}
                active={selectedTee === t.id}
                onClick={() => setSelectedTee(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr className="text-caddie-ink-mute" style={{ textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>#</th>
              <th style={{ padding: '4px 6px' }}>Par</th>
              <th style={{ padding: '4px 6px' }}>Yards</th>
              <th style={{ padding: '4px 6px' }}>Stroke idx</th>
              <th style={{ padding: '4px 6px' }} />
              <th style={{ padding: '4px 6px' }} />
            </tr>
          </thead>
          <tbody>
            {!inTeeMode &&
              rows.map((row) => (
                <tr key={row.number} style={{ borderTop: '1px solid #D9D2BF' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{row.number}</td>
                  <td style={{ padding: '4px 6px', width: 70 }}>
                    <input
                      style={cellInput}
                      type="number"
                      value={row.par}
                      onChange={(e) => updateRow(row.number, { par: Number(e.target.value) || 4 })}
                    />
                  </td>
                  <td style={{ padding: '4px 6px', width: 90 }}>
                    <input style={cellInput} value={row.yards} onChange={(e) => updateRow(row.number, { yards: e.target.value })} />
                  </td>
                  <td style={{ padding: '4px 6px', width: 90 }}>
                    <input
                      style={siIssues.has(row.number) ? cellInputError : cellInput}
                      title={siIssues.get(row.number)}
                      value={row.stroke_index}
                      onChange={(e) => updateRow(row.number, { stroke_index: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <button
                      type="button"
                      onClick={() => setFocused(focused === row.number ? null : row.number)}
                      className={focused === row.number ? 'text-caddie-accent' : 'text-caddie-ink-mute'}
                      style={{ background: 'transparent', border: 'none', fontSize: 12 }}
                    >
                      Map
                    </button>
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      className="text-caddie-neg"
                      style={{ background: 'transparent', border: 'none', fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

            {inTeeMode &&
              teeRows.map((row) => (
                <tr
                  key={row.number}
                  style={{ borderTop: '1px solid #D9D2BF', backgroundColor: teeDirty.has(row.number) ? 'rgba(31,61,44,0.06)' : undefined }}
                >
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{row.number}</td>
                  <td style={{ padding: '4px 6px', width: 70 }}>
                    <input
                      style={cellInput}
                      placeholder={row.basePar}
                      value={row.par}
                      onChange={(e) => updateTeeRow(row.number, { par: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: '4px 6px', width: 90 }}>
                    <input
                      style={cellInput}
                      placeholder={row.baseYards}
                      value={row.yards}
                      onChange={(e) => updateTeeRow(row.number, { yards: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: '4px 6px', width: 90 }}>
                    <input
                      style={siIssues.has(row.number) ? cellInputError : cellInput}
                      title={siIssues.get(row.number)}
                      placeholder={row.baseStrokeIndex}
                      value={row.strokeIndex}
                      onChange={(e) => updateTeeRow(row.number, { strokeIndex: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <button
                      type="button"
                      onClick={() => setFocused(focused === row.number ? null : row.number)}
                      className={focused === row.number ? 'text-caddie-accent' : 'text-caddie-ink-mute'}
                      style={{ background: 'transparent', border: 'none', fontSize: 12 }}
                    >
                      Map
                    </button>
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    {row.hasOverride && (
                      <button
                        type="button"
                        onClick={() => clearOverride(row)}
                        className="text-caddie-neg"
                        style={{ background: 'transparent', border: 'none', fontSize: 12 }}
                      >
                        Clear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {inTeeMode && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 11 }}>
          Faint numbers are the {primaryTee ? primaryTee.tee_color : 'base'} value. Only edited (highlighted)
          rows get saved as overrides.
        </div>
      )}
      {hasSIIssues && (
        <div className="text-caddie-neg" style={{ fontSize: 11 }}>
          Fix stroke index before saving: {[...new Set(siIssues.values())].join(' · ')}
        </div>
      )}

      {focusedBaseRow && (
        <div style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="kicker">
              Hole {focusedBaseRow.number} — tee (green marker) &amp; pin (red marker)
              {inTeeMode && ' — tee box is tee-specific, pin is not'}
            </div>
            <div className="flex" style={{ gap: 6 }}>
              <PlacingChip label="Set tee" active={placing === 'tee'} onClick={() => setPlacing('tee')} />
              <PlacingChip label="Set pin" active={placing === 'pin'} onClick={() => setPlacing('pin')} />
            </div>
          </div>
          {/* Keyed on hole number + mode so switching focus, or switching
              between base/tee, fully remounts the map (fresh init + camera
              fit) instead of trying to re-fit an already-fitted instance. */}
          <CourseMapPicker
            key={`${focusedBaseRow.number}-${selectedTee}`}
            markers={focusedMarkers}
            fallbackCenter={courseLocation ?? undefined}
            clickToPlaceId={placing}
            onMarkerMove={(id, point) => {
              if (id === 'pin') {
                updateRow(focusedBaseRow.number, { pin_lat: point.lat, pin_lng: point.lng })
                return
              }
              if (inTeeMode) {
                updateTeeRow(focusedBaseRow.number, { teeLat: point.lat, teeLng: point.lng })
              } else {
                updateRow(focusedBaseRow.number, { tee_lat: point.lat, tee_lng: point.lng })
              }
            }}
          />
          <div className="text-caddie-ink-mute" style={{ fontSize: 11, marginTop: 8 }}>
            Click the map to place the {placing}, or drag an existing pin.
            {!inTeeMode && ' "Re-fetch from OSM" below can set all holes at once instead.'}
          </div>
        </div>
      )}

      {(upsert.error || del.error || upsertHoleTees.error || deleteHoleTee.error) && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(upsert.error ?? del.error ?? upsertHoleTees.error ?? deleteHoleTee.error)}
        </div>
      )}

      <div className="flex" style={{ justifyContent: 'flex-end' }}>
        {inTeeMode ? (
          <button
            type="button"
            onClick={saveTeeOverrides}
            disabled={upsertHoleTees.isPending || teeDirty.size === 0 || hasSIIssues}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
            style={{ borderRadius: 2, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
          >
            {upsertHoleTees.isPending ? 'Saving…' : `Save ${teeDirty.size || ''} tee override${teeDirty.size === 1 ? '' : 's'}`.trim()}
          </button>
        ) : (
          <button
            type="button"
            onClick={saveAll}
            disabled={upsert.isPending || hasSIIssues}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
            style={{ borderRadius: 2, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
          >
            {upsert.isPending ? 'Saving…' : 'Save all holes'}
          </button>
        )}
      </div>
    </div>
  )
}

function PlacingChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
        color: active ? '#F2EEE5' : '#1C211C',
        border: 'none',
        borderRadius: 2,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  )
}
