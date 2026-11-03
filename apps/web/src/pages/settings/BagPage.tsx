import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MIN_SAMPLES_FOR_STATS,
  bagGaps,
  clubTypicalDistance,
  distanceUnitAbbr,
  formatClubLabel,
  wholeDistance,
  type Club,
  type DistanceUnit,
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
import { useAuth } from '../../hooks/useAuth'
import { useUnits } from '../../hooks/useUnits'
import { useClubDispersion } from '../rounds/hooks/useClubDispersion'
import { toUserMessage } from '../../lib/errors'
import { AddClubForm, ClubEditForm, EMPTY_DRAFT, type AddClubDraft } from './BagForms'
import { GapChart, type BagRung } from './GapChart'

export function BagPage() {
  const allClubs = useAllUserClubs()
  const seedIfEmpty = useSeedBagIfEmpty()
  const upsertClub = useUpsertClub()
  const deleteClub = useDeleteClub()
  const updateOrder = useUpdateClubOrder()
  const resetBag = useResetBag()
  // Typical distance per row: measured from the player's shots once a club
  // has enough of them (the live wheel's rule), else the typed estimate (#1052).
  const { user } = useAuth()
  const { byClub } = useClubDispersion(user?.id)
  const { unit } = useUnits()

  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<AddClubDraft>(EMPTY_DRAFT)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<UserClub | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localOrder, setLocalOrder] = useState<UserClub[] | null>(null)
  // Single-row inline edit. Holds the id of the club currently being
  // edited; null when no row is in edit mode.
  const [editingId, setEditingId] = useState<string | null>(null)
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

  // Issue #154: avoid the spinner → empty list → clubs flash on first
  // visit. Treat the loaded-but-empty state as "still loading" while
  // the auto-seed mutation is pending or hasn't yet run; once seed
  // settles the query refetch surfaces the seeded rows.
  const isSeedingEmpty =
    !!allClubs.data &&
    allClubs.data.length === 0 &&
    (seedIfEmpty.isPending || (!seedIfEmpty.isSuccess && !seedIfEmpty.isError))

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

  // Type-count map drives duplicate-loft labelling on each row. Computed
  // once per render so two lobs (58° + 60°) read as "lw (58°)" and
  // "lw (60°)" instead of two identical "lw" rows.
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of clubs) m.set(c.club_type, (m.get(c.club_type) ?? 0) + 1)
    return m
  }, [clubs])

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

  const onSaveEdit = useCallback(
    (
      id: string,
      patch: { name: string; loft: number | null; typicalDistance: number | null },
    ) => {
      const c = clubsRef.current.find((x) => x.id === id)
      if (!c) return
      setError(null)
      upsertClub.mutate(
        {
          id: c.id,
          name: patch.name,
          club_type: c.club_type,
          loft: patch.loft,
          typical_distance_yards: patch.typicalDistance,
          sort_order: c.sort_order,
          in_bag: c.in_bag,
        },
        {
          onSuccess: () => setEditingId(null),
          onError: (err) => setError(toUserMessage(err)),
        },
      )
    },
    [upsertClub],
  )

  const toggleEdit = useCallback((id: string) => setEditingId((cur) => (cur === id ? null : id)), [])

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

  const ready = !allClubs.isLoading && !allClubs.isError && !isSeedingEmpty
  const inBag = clubs.filter((c) => c.in_bag)
  const benched = clubs.filter((c) => !c.in_bag)

  // Each in-bag club's number, in the bag's own order: the median of its
  // shots once it has enough (the live wheel's rule), else the typed estimate
  // (#1052); its range only when the number comes from shots.
  const rungs: BagRung[] = inBag.map((c) => {
    const d = byClub.get(c.club_type as Club)
    const typical = clubTypicalDistance(d?.medianDistanceYards, d?.sampleSize ?? 0, c.typical_distance_yards)
    return {
      clubType: c.club_type,
      typical,
      range: typical?.source === 'shots' ? (d?.range ?? null) : null,
      club: c,
    }
  })
  const bag = bagGaps(rungs, unit)
  // The gap printed on the rule above a card row: only between two
  // neighbouring rows that both have a number.
  const gapAbove = new Map<string, { yards: number; widest: boolean }>()
  for (const g of bag.gaps) {
    const a = inBag.indexOf(g.longer.club)
    const b = inBag.indexOf(g.shorter.club)
    if (g.kind === 'not measured' || Math.abs(a - b) !== 1) continue
    gapAbove.set(inBag[Math.max(a, b)]!.id, { yards: g.yards, widest: g === bag.widest })
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
        My bag
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 6, marginBottom: 22, textWrap: 'pretty' }}>
        {ready && clubs.length > 0
          ? `${inBag.length} club${inBag.length === 1 ? '' : 's'} in the bag${benched.length ? `, ${benched.length} on the bench` : ''}. Only clubs in the bag show when you log a shot.`
          : 'The clubs you carry. Only these show when you log a shot.'}
      </p>

      {error && (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{ border: '1px solid #A33A2A', borderRadius: 2, padding: '10px 12px', fontSize: 13, marginBottom: 18 }}
        >
          {error}
        </div>
      )}

      {(allClubs.isLoading || isSeedingEmpty) && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          Loading bag…
        </div>
      )}

      {allClubs.isError && (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{ border: '1px solid #A33A2A', borderRadius: 2, padding: '10px 12px', fontSize: 13, marginTop: 12 }}
        >
          Could not load bag: {toUserMessage(allClubs.error)}
        </div>
      )}

      {ready && inBag.length > 0 ? <GapChart bag={bag} unit={unit} /> : null}

      {ready && (
        // The yardage card: the bag top to bottom in its own order, the
        // number you'd pull each club for, and the gap on the rule between.
        <section
          aria-label="Yardage card"
          className="bg-caddie-surface px-3 sm:px-[18px]"
          style={{ border: '1px solid #9F9580', borderRadius: 2, paddingTop: 16, paddingBottom: 12 }}
        >
          <h2 className="font-serif text-caddie-ink" style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500 }}>
            Yardage card
          </h2>
          <div
            className="text-caddie-ink-dim"
            style={{
              display: 'grid',
              gridTemplateColumns: CARD_COLS,
              columnGap: 10,
              fontSize: 12,
              marginTop: 12,
              paddingBottom: 6,
              borderBottom: '1.5px solid #1C211C',
            }}
          >
            <span />
            <span>Club</span>
            <span style={{ textAlign: 'right' }}>Plays</span>
            <span style={{ textAlign: 'right' }}>Typical, {distanceUnitAbbr(unit)}</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={inBag.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {rungs.map((r, i) => (
                <SortableClubRow
                  key={r.club.id}
                  rung={r}
                  unit={unit}
                  shots={byClub.get(r.club.club_type as Club)?.sampleSize ?? 0}
                  first={i === 0}
                  gap={gapAbove.get(r.club.id) ?? null}
                  editing={editingId === r.club.id}
                  onToggleEdit={toggleEdit}
                  onSaveEdit={onSaveEdit}
                  saving={upsertClub.isPending}
                  onToggleInBag={onToggleInBag}
                  onDelete={onRequestDelete}
                  hasDuplicateType={(typeCounts.get(r.club.club_type) ?? 0) > 1}
                />
              ))}
            </SortableContext>
          </DndContext>
          {inBag.length === 0 && (
            <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 16, fontStyle: 'italic', padding: '18px 0' }}>
              Every club is on the bench. Put one back to start the card.
            </p>
          )}
          <p className="text-caddie-ink-dim" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 10, borderTop: '1px solid #D9D2BF', paddingTop: 10 }}>
            Typical is the middle of your shots once a club has {MIN_SAMPLES_FOR_STATS}; before that, your own estimate in
            italics. Plays is where two in three of its shots finish. The number on each rule is the gap between the two
            clubs. Drag ⠿ to set the order of the club wheel; open a club to edit it.
          </p>
        </section>
      )}

      {ready && benched.length > 0 && (
        <section style={{ marginTop: 28 }} aria-label="On the bench">
          <h2 className="font-serif text-caddie-ink" style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 500, marginBottom: 4 }}>
            On the bench
          </h2>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>
            Saved, but hidden from the shot logger.
          </p>
          {benched.map((c) => (
            <div key={c.id} className="flex items-center" style={{ gap: 14, padding: '10px 0', borderTop: '1px solid #D9D2BF' }}>
              <span className="text-caddie-ink" style={{ flex: 1, fontSize: 15 }}>
                {c.name}{' '}
                <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>
                  {formatClubLabel(c, { hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1 })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onToggleInBag(c.id)}
                className="text-caddie-ink hover:underline"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Put in bag
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(c.id)}
                aria-label={`Delete ${c.name}`}
                className="text-caddie-neg hover:underline"
                style={{ fontSize: 13 }}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
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
        <div className="flex items-center flex-wrap" style={{ gap: 18, marginTop: 22 }}>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="key key-primary"
            style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}
          >
            Add club <span className="font-serif italic" style={{ marginLeft: 4 }}>→</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-caddie-ink-dim hover:underline"
            style={{ fontSize: 13 }}
          >
            Reset to the default bag
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset to default bag?"
        message="This deletes every club you've added and seeds the default 14-club bag."
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

// handle | club | plays | typical
const CARD_COLS = '18px minmax(0,1fr) auto 64px'

interface SortableClubRowProps {
  rung: BagRung
  unit: DistanceUnit
  /** The club's aimed shots, for the meta line. */
  shots: number
  first: boolean
  /** The gap to the row above, printed on the rule between them. */
  gap: { yards: number; widest: boolean } | null
  editing: boolean
  saving: boolean
  hasDuplicateType: boolean
  onToggleEdit: (id: string) => void
  onSaveEdit: (
    id: string,
    patch: { name: string; loft: number | null; typicalDistance: number | null },
  ) => void
  onToggleInBag: (id: string) => void
  onDelete: (id: string) => void
}

const SortableClubRow = memo(function SortableClubRow({
  rung,
  unit,
  shots,
  first,
  gap,
  editing,
  saving,
  hasDuplicateType,
  onToggleEdit,
  onSaveEdit,
  onToggleInBag,
  onDelete,
}: SortableClubRowProps) {
  const { club, typical, range } = rung
  const sortable = useSortable({ id: club.id })
  const putter = club.club_type === 'putter'
  const estimate = typical?.source === 'estimate'
  const meta = [
    formatClubLabel(club, { hasDuplicateType }),
    club.loft != null && club.club_type !== 'cw' && club.club_type !== 'custom_wedge' && !hasDuplicateType
      ? `${club.loft}°`
      : null,
    typical?.source === 'shots' ? `${shots} shots` : estimate ? 'your estimate' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      ref={sortable.setNodeRef}
      data-testid="bag-row"
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
        position: 'relative',
        borderTop: first ? 'none' : '1px solid #D9D2BF',
        background: sortable.isDragging ? '#EBE5D6' : undefined,
      }}
    >
      {gap && !first ? (
        // Centred on the rule, under the typical column.
        <span
          data-testid="bag-gap"
          className="font-serif tabular"
          style={{
            position: 'absolute',
            top: 0,
            right: 32,
            transform: 'translate(50%, -50%)',
            background: '#FBF8F1',
            padding: '0 5px',
            fontSize: 12,
            lineHeight: 1,
            fontWeight: gap.widest ? 600 : 400,
            color: gap.widest ? '#A66A1F' : '#5C6356',
          }}
        >
          {wholeDistance(gap.yards, unit)}
          <span className="sr-only"> {distanceUnitAbbr(unit)} gap{gap.widest ? ', the widest' : ''}</span>
        </span>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', columnGap: 10, alignItems: 'center' }}>
        <button
          type="button"
          aria-label={`Drag ${club.name} to reorder`}
          {...sortable.attributes}
          {...sortable.listeners}
          className="text-caddie-ink-mute"
          style={{ cursor: 'grab', fontSize: 13, padding: '4px 0' }}
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => onToggleEdit(club.id)}
          aria-expanded={editing}
          aria-label={`${club.name}${typical && !putter ? `, ${wholeDistance(typical.yards, unit)} ${distanceUnitAbbr(unit)}` : ''}. ${editing ? 'Close' : 'Edit'}`}
          className="hover:bg-caddie-bg"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto 64px',
            columnGap: 10,
            alignItems: 'center',
            padding: '9px 0 8px',
            textAlign: 'left',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span className="text-caddie-ink" style={{ display: 'block', fontSize: 15, lineHeight: 1.25 }}>
              {club.name}
            </span>
            <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 12, marginTop: 1 }}>
              {meta}
            </span>
          </span>
          <span className="font-serif tabular text-caddie-ink-dim" style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>
            {range && !putter ? `${wholeDistance(range.low, unit)}–${wholeDistance(range.high, unit)}` : ''}
          </span>
          <span
            className={`font-serif tabular ${estimate ? 'text-caddie-ink-dim' : 'text-caddie-ink'}`}
            style={{ fontSize: 28, lineHeight: 1, fontWeight: 500, textAlign: 'right', fontStyle: estimate ? 'italic' : 'normal' }}
          >
            {putter ? '' : typical ? (
              wholeDistance(typical.yards, unit)
            ) : (
              <span className="text-caddie-ink-mute" style={{ fontSize: 20 }}>
                –
              </span>
            )}
          </span>
        </button>
      </div>
      {editing && (
        <ClubEditForm
          club={club}
          saving={saving}
          onCancel={() => onToggleEdit(club.id)}
          onSave={(patch) => onSaveEdit(club.id, patch)}
          onBench={() => onToggleInBag(club.id)}
          onDelete={() => onDelete(club.id)}
        />
      )}
    </div>
  )
})
