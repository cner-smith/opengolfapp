import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  CLUBS,
  DEFAULT_BAG,
  clubCategoryFor,
  type ClubCategory,
} from '@oga/core'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useAllUserClubs,
  useDeleteClub,
  useResetBag,
  useSeedBagIfEmpty,
  useUpdateClubOrder,
  useUpsertClub,
  type UserClub,
} from '../../hooks/useUserBag'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { toUserMessage } from '../../lib/errors'

interface AddClubDraft {
  name: string
  category: ClubCategory
  clubType: string
  loft: string
  typicalDistance: string
}

const EMPTY_DRAFT: AddClubDraft = {
  name: '',
  category: 'iron',
  clubType: '7i',
  loft: '',
  typicalDistance: '',
}

// Maps the picklist category to the canonical CLUBS subset that matches.
// Utility = "anything not covered above"; we let the user enter a free
// club_type value when they pick utility (mini driver, chipper, attack
// wedge, etc).
const CANONICAL_CLUBS_BY_CATEGORY: Record<ClubCategory, readonly string[]> = {
  driver: ['driver'],
  wood: CLUBS.filter((c) => /^[357]w$/.test(c)),
  hybrid: CLUBS.filter((c) => /^[345]h$/.test(c)),
  iron: CLUBS.filter((c) => /^[2-9]i$/.test(c)),
  wedge: ['pw', 'gw', 'sw', 'lw'],
  putter: ['putter'],
  utility: [],
}

export function BagPage() {
  const allClubs = useAllUserClubs()
  const seedIfEmpty = useSeedBagIfEmpty()
  const upsertClub = useUpsertClub()
  const deleteClub = useDeleteClub()
  const updateOrder = useUpdateClubOrder()
  const resetBag = useResetBag()

  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<AddClubDraft>(EMPTY_DRAFT)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<UserClub | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localOrder, setLocalOrder] = useState<UserClub[] | null>(null)
  // Set on drag-start, cleared after the order mutation settles. Guards
  // the localOrder<-server sync below so a refetch mid-drag (or a fast
  // second drag right after the first) can't stomp on what the user is
  // currently doing.
  const dragDirtyRef = useRef(false)

  useEffect(() => {
    if (
      allClubs.data &&
      allClubs.data.length === 0 &&
      !seedIfEmpty.isPending &&
      !seedIfEmpty.isSuccess
    ) {
      seedIfEmpty.mutate()
    }
  }, [allClubs.data, seedIfEmpty])

  useEffect(() => {
    if (allClubs.data && !updateOrder.isPending && !dragDirtyRef.current) {
      setLocalOrder(allClubs.data)
    }
  }, [allClubs.data, updateOrder.isPending])

  const clubs = localOrder ?? allClubs.data ?? []
  // Stable ref for callbacks below. Lookups by id always read the latest
  // array without forcing the callbacks to re-create on every render.
  const clubsRef = useRef(clubs)
  clubsRef.current = clubs

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const current = clubsRef.current
      const oldIdx = current.findIndex((c) => c.id === active.id)
      const newIdx = current.findIndex((c) => c.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return
      const reordered = arrayMove(current, oldIdx, newIdx)
      setLocalOrder(reordered)
      dragDirtyRef.current = true
      updateOrder.mutate(reordered.map((c) => c.id), {
        onSettled: () => {
          dragDirtyRef.current = false
        },
        onError: (err) => setError(toUserMessage(err)),
      })
    },
    [updateOrder],
  )

  // Stable id-based callbacks read the latest club from clubsRef so they
  // don't capture stale row data across refetches.
  const onToggleInBag = useCallback(
    (id: string) => {
      const c = clubsRef.current.find((x) => x.id === id)
      if (!c) return
      upsertClub.mutate(
        {
          id: c.id,
          name: c.name,
          club_type: c.club_type,
          loft: c.loft,
          typical_distance_yards: c.typical_distance_yards,
          sort_order: c.sort_order,
          in_bag: !c.in_bag,
        },
        { onError: (err) => setError(toUserMessage(err)) },
      )
    },
    [upsertClub],
  )

  const onRename = useCallback(
    (id: string, name: string) => {
      const c = clubsRef.current.find((x) => x.id === id)
      if (!c) return
      upsertClub.mutate(
        {
          id: c.id,
          name,
          club_type: c.club_type,
          loft: c.loft,
          typical_distance_yards: c.typical_distance_yards,
          sort_order: c.sort_order,
          in_bag: c.in_bag,
        },
        { onError: (err) => setError(toUserMessage(err)) },
      )
    },
    [upsertClub],
  )

  const onRequestDelete = useCallback(
    (id: string) => {
      const c = clubsRef.current.find((x) => x.id === id)
      if (c) setConfirmDelete(c)
    },
    [],
  )

  // Number coercion that rejects NaN/Infinity. Postgres `numeric`
  // accepts the literal string 'NaN' as a valid value, which would
  // corrupt downstream stat math.
  function parseNumOrNull(s: string): number | null {
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  async function submitAdd() {
    setError(null)
    if (!draft.name.trim()) {
      setError('Name is required')
      return
    }
    if (!draft.clubType.trim()) {
      setError('Club type is required')
      return
    }
    if (draft.loft && !Number.isFinite(Number(draft.loft))) {
      setError('Loft must be a number')
      return
    }
    if (draft.typicalDistance && !Number.isFinite(Number(draft.typicalDistance))) {
      setError('Typical distance must be a number')
      return
    }
    try {
      const maxSort = clubs.reduce((m, c) => Math.max(m, c.sort_order), -1)
      await upsertClub.mutateAsync({
        name: draft.name.trim(),
        club_type: draft.clubType.trim().toLowerCase(),
        loft: parseNumOrNull(draft.loft),
        typical_distance_yards: parseNumOrNull(draft.typicalDistance),
        sort_order: maxSort + 1,
        in_bag: true,
      })
      setDraft(EMPTY_DRAFT)
      setShowAdd(false)
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 720, padding: '32px 24px 48px' }}>
      <div className="kicker">Equipment</div>
      <h1
        className="font-serif italic text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, marginTop: 6, marginBottom: 12 }}
      >
        My bag.
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginBottom: 8 }}>
        Add the clubs you carry. Only these clubs appear when logging shots.
      </p>
      <p
        className="text-caddie-ink-mute"
        style={{ fontSize: 13, marginBottom: 24 }}
      >
        Benched clubs stay in your list but are hidden from the shot logger.
      </p>

      {error && (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}

      {allClubs.isLoading && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          Loading bag…
        </div>
      )}

      {allClubs.isError && (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{
            border: '1px solid #A33A2A',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 13,
            marginTop: 12,
          }}
        >
          Could not load bag: {toUserMessage(allClubs.error)}
        </div>
      )}

      {!allClubs.isLoading && !allClubs.isError && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={clubs.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div
              style={{
                borderTop: '1px solid #D9D2BF',
              }}
            >
              {clubs.map((c) => (
                <SortableClubRow
                  key={c.id}
                  club={c}
                  onToggleInBag={onToggleInBag}
                  onRename={onRename}
                  onDelete={onRequestDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAdd ? (
        <AddClubForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => {
            setShowAdd(false)
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
          onSubmit={submitAdd}
          submitting={upsertClub.isPending}
          error={error}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="bg-caddie-accent text-caddie-accent-ink"
          style={{
            marginTop: 22,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            borderRadius: 2,
          }}
        >
          Add club <span className="font-serif italic" style={{ marginLeft: 4 }}>→</span>
        </button>
      )}

      <div style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid #D9D2BF' }}>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="text-caddie-accent"
          style={{
            fontSize: 13,
            border: '1px solid #1F3D2C',
            background: 'transparent',
            padding: '8px 14px',
            borderRadius: 2,
          }}
        >
          Reset to default bag
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to default bag?"
        message="This deletes every club you've added and seeds the default 15-club bag."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          resetBag.mutate(undefined, {
            onError: (err) => setError(toUserMessage(err)),
          })
          setConfirmReset(false)
        }}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete ${confirmDelete.name}?` : ''}
        message="This removes the club permanently. You can re-add it any time."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDelete) {
            deleteClub.mutate(confirmDelete.id, {
              onError: (err) => setError(toUserMessage(err)),
            })
          }
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

interface SortableClubRowProps {
  club: UserClub
  onToggleInBag: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

const SortableClubRow = memo(function SortableClubRow({
  club,
  onToggleInBag,
  onRename,
  onDelete,
}: SortableClubRowProps) {
  const sortable = useSortable({ id: club.id })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(club.name)

  useEffect(() => setName(club.name), [club.name])

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  }

  function commitRename() {
    setEditing(false)
    if (name.trim() && name.trim() !== club.name) onRename(club.id, name.trim())
    else setName(club.name)
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid #D9D2BF',
        padding: '14px 4px',
      }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...sortable.attributes}
        {...sortable.listeners}
        className="text-caddie-ink-mute"
        style={{ cursor: 'grab', fontSize: 14, padding: '4px 8px' }}
      >
        ⠿
      </button>
      <div style={{ flex: 1 }}>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setName(club.name)
                setEditing(false)
              }
            }}
            autoFocus
            className="bg-transparent text-caddie-ink"
            style={{ fontSize: 15, border: '1px solid #D9D2BF', padding: '4px 6px', width: '100%' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-caddie-ink"
            style={{ fontSize: 15, textAlign: 'left' }}
          >
            {club.name}
          </button>
        )}
        <div
          className="font-mono uppercase text-caddie-ink-mute"
          style={{ fontSize: 10, letterSpacing: '0.14em', marginTop: 2 }}
        >
          {club.club_type}
          {club.loft != null ? ` · ${club.loft}°` : ''}
          {club.typical_distance_yards != null ? ` · ${club.typical_distance_yards} yd` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggleInBag(club.id)}
        title="Benched clubs stay in your list but won't show up when logging shots."
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          padding: '4px 10px',
          borderRadius: 2,
          border: '1px solid #D9D2BF',
          color: club.in_bag ? '#F2EEE5' : '#5C6356',
          background: club.in_bag ? '#1F3D2C' : 'transparent',
        }}
      >
        {club.in_bag ? 'In bag' : 'Benched'}
      </button>
      <button
        type="button"
        onClick={() => onDelete(club.id)}
        aria-label={`Delete ${club.name}`}
        className="text-caddie-neg hover:underline"
        style={{ fontSize: 12 }}
      >
        Delete
      </button>
    </div>
  )
})

function AddClubForm({
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

  // When category changes, jump club_type to the first canonical option
  // for that category if the current type doesn't fit. Skip for utility.
  useEffect(() => {
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
      <div className="kicker" style={{ marginBottom: 10 }}>
        New club
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Category</span>
          <select
            value={draft.category}
            onChange={(e) =>
              onChange({ ...draft, category: e.target.value as ClubCategory })
            }
            style={{
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
          <span className="kicker">Club type</span>
          {draft.category === 'utility' ? (
            <input
              value={draft.clubType}
              onChange={(e) => onChange({ ...draft, clubType: e.target.value })}
              placeholder="e.g. chipper, mini_driver, aw"
              style={{
                padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            />
          ) : (
            <select
              value={draft.clubType}
              onChange={(e) => onChange({ ...draft, clubType: e.target.value })}
              style={{
                padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            >
              {canonicalOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Display name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="e.g. 7 Iron, Stealth Driver, 60° Lob"
            style={{
              padding: '8px 10px',
              fontSize: 14,
              border: '1px solid #D9D2BF',
              background: '#FBF8F1',
              borderRadius: 2,
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span className="kicker">Loft (°)</span>
            <input
              value={draft.loft}
              onChange={(e) => onChange({ ...draft, loft: e.target.value })}
              inputMode="decimal"
              placeholder="optional"
              style={{
                padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span className="kicker">Typical distance (yd)</span>
            <input
              value={draft.typicalDistance}
              onChange={(e) => onChange({ ...draft, typicalDistance: e.target.value })}
              inputMode="numeric"
              placeholder="optional"
              style={{
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
      <div className="kicker" style={{ marginTop: 14, color: '#8A8B7E' }}>
        Hint
      </div>
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 4 }}>
        Category defaults to {CLUB_CATEGORY_LABELS[clubCategoryFor(draft.clubType)]} based
        on the club_type you chose.
      </div>
    </div>
  )
}

