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
          className="bg-caddie-bg text-caddie-ink"
          style={{
            width: '100%',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            padding: '8px 10px',
            fontSize: 14,
          }}
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
            className="bg-caddie-bg text-caddie-ink"
            style={{
              width: '100%',
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '8px 10px',
              fontSize: 14,
            }}
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
            className="bg-caddie-bg text-caddie-ink"
            style={{
              width: '100%',
              border: '1px solid #D9D2BF',
              borderRadius: 2,
              padding: '8px 10px',
              fontSize: 14,
            }}
          />
        </label>
      </div>
      {localError && (
        <div className="text-caddie-neg" style={{ fontSize: 13 }}>
          {localError}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 2,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-caddie-ink-dim"
          style={{ fontSize: 13 }}
        >
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onBench} className="text-caddie-ink-dim hover:underline" style={{ fontSize: 13 }}>
          Bench it
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${club.name}`}
          className="text-caddie-neg hover:underline"
          style={{ fontSize: 13 }}
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
  // mention). Toggled by the "Custom…" sentinel option in the dropdown.
  const [customMode, setCustomMode] = useState(false)
  const CUSTOM_VALUE = '__custom__'
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
    <div
      style={{
        marginTop: 22,
        padding: 18,
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
      }}
    >
      <h2 className="font-serif text-caddie-ink" style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500, marginBottom: 12 }}>
        Add a club
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Category</span>
          <select
            value={draft.category}
            onChange={(e) =>
              onChange({ ...draft, category: e.target.value as ClubCategory })
            }
            style={{
              width: '100%',
            padding: '8px 10px',
              fontSize: 14,
              border: '1px solid #D9D2BF',
              background: '#FBF8F1',
              borderRadius: 2,
            }}
          >
            {CLUB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CLUB_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Club type</span>
          {showFreeText ? (
            <input
              value={draft.clubType}
              onChange={(e) => onChange({ ...draft, clubType: e.target.value })}
              placeholder="e.g. chipper, attack wedge, 1.5 hybrid"
              style={{
                width: '100%',
            padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            />
          ) : (
            <select
              value={
                canonicalOptions.includes(draft.clubType)
                  ? draft.clubType
                  : canonicalOptions[0] ?? ''
              }
              onChange={(e) => {
                if (e.target.value === CUSTOM_VALUE) {
                  setCustomMode(true)
                  onChange({ ...draft, clubType: '' })
                  return
                }
                onChange({ ...draft, clubType: e.target.value })
              }}
              style={{
                width: '100%',
            padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            >
              {canonicalOptions.map((c) => (
                <option key={c} value={c}>
                  {formatClubLabel({ club_type: c })}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Other…</option>
            </select>
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
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Display name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="e.g. 7 Iron, Stealth Driver, 60° Lob"
            style={{
              width: '100%',
            padding: '8px 10px',
              fontSize: 14,
              border: '1px solid #D9D2BF',
              background: '#FBF8F1',
              borderRadius: 2,
            }}
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
              style={{
                width: '100%',
            padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>Typical distance (yd)</span>
            <input
              value={draft.typicalDistance}
              onChange={(e) => onChange({ ...draft, typicalDistance: e.target.value })}
              inputMode="numeric"
              placeholder="optional"
              style={{
                width: '100%',
            padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            />
          </label>
        </div>
        {error && <div className="text-caddie-neg" style={{ fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="bg-caddie-accent text-caddie-accent-ink"
            style={{
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 2,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            Add to bag <span className="font-serif italic" style={{ marginLeft: 4 }}>→</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-caddie-ink-dim"
            style={{ fontSize: 13 }}
          >
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
