import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BlockType, PlanCategory } from '@oga/core'
import type { Database } from '@oga/supabase'
import { useDrills } from '../../hooks/useDrills'
import { toUserMessage } from '../../lib/errors'
import { BLOCK_TYPE_LABEL, CATEGORY_LABEL, FACILITY_LABEL, renderInstructions } from './drillDisplay'

type Drill = Database['public']['Tables']['drills']['Row']

const LINE = '#D9D2BF'

// Filter vocab: 'all' sentinel + the @oga/core enums. Category order mirrors a
// round — off the tee through the green — so the chips read as a shot progression.
const CATEGORIES: PlanCategory[] = ['off_tee', 'approach', 'around_green', 'putting']
const MODES: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

export function DrillLibraryPage() {
  const drillsQuery = useDrills()
  const [category, setCategory] = useState<PlanCategory | 'all'>('all')
  const [mode, setMode] = useState<BlockType | 'all'>('all')

  const drills = useMemo(() => drillsQuery.data ?? [], [drillsQuery.data])
  const filtered = useMemo(
    () =>
      drills.filter(
        (d) =>
          (category === 'all' || d.category === category) &&
          (mode === 'all' || d.drill_type === mode),
      ),
    [drills, category, mode],
  )

  return (
    <div>
      <Link
        to="/practice"
        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
        style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 18, display: 'inline-block' }}
      >
        ← Practice plan
      </Link>

      <div style={{ marginBottom: 24 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Drill library
        </div>
        <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
          The full set
        </h1>
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}>
          Every drill the plan generator can draw from. Each one explains the why,
          the how, and the rep target — no gimmicks.
        </p>
      </div>

      {/* Filters — category (the part of the game) then practice mode. */}
      <FilterRow
        label="Part of the game"
        active={category}
        all="all"
        options={CATEGORIES}
        labelFor={(c) => CATEGORY_LABEL[c]}
        onPick={setCategory}
      />
      <FilterRow
        label="Practice mode"
        active={mode}
        all="all"
        options={MODES}
        labelFor={(m) => BLOCK_TYPE_LABEL[m]}
        onPick={setMode}
      />

      {drillsQuery.isLoading ? (
        <div className="font-mono text-caddie-ink-dim" style={{ fontSize: 13, paddingTop: 24 }}>
          Loading drills…
        </div>
      ) : drillsQuery.error ? (
        <div
          className="text-caddie-neg"
          style={{ marginTop: 24, border: `1px solid ${LINE}`, borderRadius: 4, padding: '12px 14px', fontSize: 13 }}
        >
          {toUserMessage(drillsQuery.error)}
        </div>
      ) : (
        <>
          <div
            className="font-mono text-caddie-ink-mute"
            style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '24px 0 4px' }}
          >
            {filtered.length} drill{filtered.length === 1 ? '' : 's'}
          </div>
          {filtered.length === 0 ? (
            <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, fontStyle: 'italic', paddingTop: 16 }}>
              No drills match those filters.
            </p>
          ) : (
            <div style={{ maxWidth: 720 }}>
              {filtered.map((drill) => (
                <DrillCard key={drill.id} drill={drill} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  active,
  all,
  options,
  labelFor,
  onPick,
}: {
  label: string
  active: T | 'all'
  all: 'all'
  options: T[]
  labelFor: (value: T) => string
  onPick: (value: T | 'all') => void
}) {
  const chips: Array<{ value: T | 'all'; label: string }> = [
    { value: all, label: 'All' },
    ...options.map((o) => ({ value: o, label: labelFor(o) })),
  ]
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => {
          const selected = chip.value === active
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onPick(chip.value)}
              aria-pressed={selected}
              className={
                selected ? 'bg-caddie-accent text-caddie-accent-ink' : 'bg-caddie-surface text-caddie-ink-dim hover:text-caddie-ink'
              }
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.02em',
                padding: '6px 12px',
                borderRadius: 2,
                border: selected ? 'none' : `1px solid ${LINE}`,
                cursor: 'pointer',
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DrillCard({ drill }: { drill: Drill }) {
  const [open, setOpen] = useState(false)
  const facilities = drill.facility ?? []
  const instructions = drill.instructions?.trim() || drill.description?.trim() || ''
  const canExpand = instructions.length > 0

  return (
    <div style={{ borderBottom: `1px solid ${LINE}`, padding: '18px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>
        <div>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={`drill-detail-${drill.id}`}
              className="font-serif text-caddie-ink hover:opacity-80"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 19,
                fontStyle: 'italic',
                lineHeight: 1.2,
                textAlign: 'left',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              <span>{drill.name}</span>
              <span
                className="font-mono text-caddie-ink-mute"
                aria-hidden="true"
                style={{ fontSize: 15, fontStyle: 'normal', lineHeight: 1 }}
              >
                {open ? '−' : '+'}
              </span>
            </button>
          ) : (
            <div className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.2 }}>
              {drill.name}
            </div>
          )}
          {facilities.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {facilities.map((f) => (
                <span
                  key={f}
                  className="font-mono bg-caddie-surface-2 text-caddie-ink-dim"
                  style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2 }}
                >
                  {FACILITY_LABEL[f] ?? f}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right — duration + mode tag */}
        <div style={{ textAlign: 'right', minWidth: 72 }}>
          {drill.duration_min != null ? (
            <div className="font-serif text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1 }}>
              {drill.duration_min} min
            </div>
          ) : null}
          <div
            className="font-mono text-caddie-accent"
            style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: drill.duration_min != null ? 6 : 0 }}
          >
            {BLOCK_TYPE_LABEL[drill.drill_type as BlockType] ?? drill.drill_type}
          </div>
        </div>
      </div>

      {canExpand && open ? (
        <div id={`drill-detail-${drill.id}`} style={{ borderTop: `1px solid ${LINE}`, marginTop: 16, paddingTop: 16, maxWidth: 660 }}>
          {renderInstructions(instructions)}
          {drill.source ? (
            <div
              className="font-mono text-caddie-ink-mute"
              style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 14 }}
            >
              via{' '}
              {drill.source_url ? (
                <a href={drill.source_url} target="_blank" rel="noopener noreferrer" className="text-caddie-accent hover:opacity-80">
                  {drill.source}
                </a>
              ) : (
                drill.source
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
