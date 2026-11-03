import { useEffect, useMemo, useState } from 'react'
import {
  CANONICAL_CLUBS_BY_CATEGORY,
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  clubCategoryFor,
  formatClubLabel,
  type ClubCategory,
} from '@oga/core'
import type { UserClub } from '../../hooks/useUserBag'

// My bag's two forms: a club's inline edit (with Bench it / Delete) and Add club.

export interface AddClubDraft {
  name: string
  category: ClubCategory
  clubType: string
  loft: string
  typicalDistance: string
}

export const EMPTY_DRAFT: AddClubDraft = {
  name: '',
  category: 'iron',
  clubType: '7i',
  loft: '',
  typicalDistance: '',
}

export function ClubEditForm({
  club,
  saving,
  onCancel,
  onSave,
  onBench,
  onDelete,
}: {
  club: UserClub
  saving: boolean
  onCancel: () => void
  onBench: () => void
  onDelete: () => void
  onSave: (patch: {
    name: string
    loft: number | null
    typicalDistance: number | null
  }) => void
}) {
  const [name, setName] = useState(club.name)
  const [loft, setLoft] = useState(club.loft != null ? String(club.loft) : '')
  const [typical, setTypical] = useState(
    club.typical_distance_yards != null
      ? String(club.typical_distance_yards)
      : '',
  )
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setName(club.name)
    setLoft(club.loft != null ? String(club.loft) : '')
    setTypical(
      club.typical_distance_yards != null
        ? String(club.typical_distance_yards)
        : '',
    )
  }, [club.id, club.name, club.loft, club.typical_distance_yards])

  function parseNumOrNull(s: string): number | null {
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  function submit() {
    setLocalError(null)
    if (!name.trim()) {
      setLocalError('Name is required')
      return
    }
    if (loft && !Number.isFinite(Number(loft))) {
      setLocalError('Loft must be a number')
      return
    }
    if (typical && !Number.isFinite(Number(typical))) {
      setLocalError('Typical distance must be a number')
      return
    }
    onSave({
      name: name.trim(),
      loft: parseNumOrNull(loft),
      typicalDistance: parseNumOrNull(typical),
    })
  }

  return (
    <div
      style={{
        padding: '4px 0 18px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={fieldStyle}
        />
      </label>
      <div style={{ display: 'flex', gap: 12 }}>
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}
        >
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Loft (°)</span>
          <input
            value={loft}
            onChange={(e) => setLoft(e.target.value)}
            inputMode="decimal"
            placeholder="optional"
            style={fieldStyle}
          />
        </label>
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}
        >
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Typical distance (yd)</span>
          <input
            value={typical}
            onChange={(e) => setTypical(e.target.value)}
            inputMode="numeric"
            placeholder="optional"
            style={fieldStyle}
          />
        </label>
      </div>
      {localError && (
        <div className="text-caddie-neg" style={{ fontSize: 13 }}>
          {localError}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 3 }}>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="key key-primary"
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="key" style={{ fontSize: 13, fontWeight: 500 }}>
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onBench} className="text-caddie-ink hover:underline" style={{ fontSize: 13, fontWeight: 600, minHeight: 44 }}>
          Bench it
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${club.name}`}
          className="text-caddie-neg hover:underline"
          style={{ fontSize: 13, minHeight: 44 }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function AddClubForm({
  draft,
  onChange,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  draft: AddClubDraft
  onChange: (d: AddClubDraft) => void
  onCancel: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  const canonicalOptions = useMemo(
    () => CANONICAL_CLUBS_BY_CATEGORY[draft.category],
    [draft.category],
  )
  // Custom mode lets the user enter a free-text club_type for non-utility
  // categories (e.g. an "attack wedge" the canonical wedge list doesn't
  // mention). Toggled by the "Other…" key.
  const [customMode, setCustomMode] = useState(false)
  const showFreeText = draft.category === 'utility' || customMode

  // When category changes, jump club_type to the first canonical option
  // for that category if the current type doesn't fit. Skip for utility.
  // Switching category also resets custom mode so the user starts from
  // canonical options for the new category.
  useEffect(() => {
    setCustomMode(false)
    if (draft.category === 'utility') return
    if (!canonicalOptions.includes(draft.clubType)) {
      onChange({ ...draft, clubType: canonicalOptions[0] ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.category])

  return (
    <div className="paper-tile" style={{ marginTop: 22, padding: 18 }}>
      <h2 className="font-serif text-caddie-ink" style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500, marginBottom: 12 }}>
        Add a club
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div role="group" aria-label="Category" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Category</span>
          <Keys>
            {CLUB_CATEGORIES.map((c) => (
              <OptionKey
                key={c}
                label={CLUB_CATEGORY_LABELS[c]}
                active={draft.category === c}
                onClick={() => onChange({ ...draft, category: c })}
              />
            ))}
          </Keys>
        </div>
        <div role="group" aria-label="Club type" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Club type</span>
          {showFreeText ? (
            <input
              value={draft.clubType}
              aria-label="Club type"
              onChange={(e) => onChange({ ...draft, clubType: e.target.value })}
              placeholder="e.g. chipper, attack wedge, 1.5 hybrid"
              style={fieldStyle}
            />
          ) : (
            <Keys>
              {canonicalOptions.map((c) => (
                <OptionKey
                  key={c}
                  label={formatClubLabel({ club_type: c })}
                  active={draft.clubType === c}
                  onClick={() => onChange({ ...draft, clubType: c })}
                />
              ))}
              <OptionKey
                label="Other…"
                active={false}
                onClick={() => {
                  setCustomMode(true)
                  onChange({ ...draft, clubType: '' })
                }}
              />
            </Keys>
          )}
          {customMode && draft.category !== 'utility' && (
            <button
              type="button"
              onClick={() => {
                setCustomMode(false)
                onChange({ ...draft, clubType: canonicalOptions[0] ?? '' })
              }}
              className="text-caddie-ink-dim"
              style={{
                fontSize: 12,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                padding: 0,
                marginTop: 2,
              }}
            >
              ← Back to {CLUB_CATEGORY_LABELS[draft.category]} list
            </button>
          )}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Display name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="e.g. 7 Iron, Stealth Driver, 60° Lob"
            style={fieldStyle}
          />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Loft (°)</span>
            <input
              value={draft.loft}
              onChange={(e) => onChange({ ...draft, loft: e.target.value })}
              inputMode="decimal"
              placeholder="optional"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Typical distance (yd)</span>
            <input
              value={draft.typicalDistance}
              onChange={(e) => onChange({ ...draft, typicalDistance: e.target.value })}
              inputMode="numeric"
              placeholder="optional"
              style={fieldStyle}
            />
          </label>
        </div>
        {error && <div className="text-caddie-neg" style={{ fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingBottom: 3 }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="key key-primary"
            style={{
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Add to bag <span className="font-serif italic" style={{ marginLeft: 4 }}>→</span>
          </button>
          <button type="button" onClick={onCancel} className="key" style={{ fontSize: 13, fontWeight: 500 }}>
            Cancel
          </button>
        </div>
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 12 }}>
        Files under {CLUB_CATEGORY_LABELS[clubCategoryFor(draft.clubType)].toLowerCase()} for the club type you chose.
      </div>
    </div>
  )
}

// A paper field: raised face, ink edge (mobile bag.tsx inputStyle).
const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#FBF8F1',
  color: '#1C211C',
  border: '1px solid #1C211C',
  borderRadius: 3,
  padding: '8px 10px',
  fontSize: 14,
}

function Keys({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap" style={{ gap: '10px 6px', paddingBottom: 3 }}>
      {children}
    </div>
  )
}

// An option key, latched while chosen (mobile bag.tsx Chip).
function OptionKey({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="key set-key" style={{ fontWeight: active ? 600 : 500 }}>
      {label}
    </button>
  )
}
