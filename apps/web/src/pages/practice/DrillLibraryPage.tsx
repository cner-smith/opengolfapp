import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayLocalDate, type BlockType, type PlanCategory } from '@oga/core'
import type { Database } from '@oga/supabase'
import { useDrills, useLatestPracticePlan } from '../../hooks/useDrills'
import { toUserMessage } from '../../lib/errors'
import { BLOCK_TYPE_LABEL, CATEGORY_LABEL, FACILITY_LABEL, ModeSwatch, planSessions, renderInstructions } from './drillDisplay'

type Drill = Database['public']['Tables']['drills']['Row']

const LINE = '#D9D2BF'

// Category order mirrors a round, off the tee through the green, so the index
// reads as a shot progression.
const CATEGORIES: PlanCategory[] = ['off_tee', 'approach', 'around_green', 'putting']
const MODES: BlockType[] = ['warmup', 'blocked', 'random', 'skill_game', 'pressure_game', 'on_course']

// The drill library as a printed index: one section per part of the game,
// ruled breaks between them, each drill a line with its minutes on the right.
export function DrillLibraryPage() {
  const drillsQuery = useDrills()
  const planQuery = useLatestPracticePlan()
  const [category, setCategory] = useState<PlanCategory | 'all'>('all')
  const [mode, setMode] = useState<BlockType | 'all'>('all')
  const [sort, setSort] = useState<'az' | 'za'>('az')
  const [planOnly, setPlanOnly] = useState(false)

  // The drills in this week's plan. A plan past its last day isn't this week's.
  const plan = planQuery.data
  const planIds = useMemo(() => {
    if (!plan || (plan.valid_until && plan.valid_until < todayLocalDate())) return new Set<string>()
    return new Set(planSessions(plan.drills).flatMap((s) => s.blocks.map((b) => b.drill_id).filter((id): id is string => !!id)))
  }, [plan])

  const drills = useMemo(() => drillsQuery.data ?? [], [drillsQuery.data])
  const filtered = useMemo(() => {
    const dir = sort === 'az' ? 1 : -1
    return drills
      .filter(
        (d) =>
          (category === 'all' || d.category === category) &&
          (mode === 'all' || d.drill_type === mode) &&
          (!planOnly || planIds.has(d.id)),
      )
      .sort((a, b) => dir * a.name.localeCompare(b.name))
  }, [drills, category, mode, sort, planOnly, planIds])
  const groups = useMemo(() => {
    const out = CATEGORIES.map((c) => ({ key: c as string, title: CATEGORY_LABEL[c], drills: filtered.filter((d) => d.category === c) }))
    out.push({
      key: 'other',
      title: 'Anywhere',
      drills: filtered.filter((d) => !CATEGORIES.includes(d.category as PlanCategory)),
    })
    return out.filter((g) => g.drills.length > 0)
  }, [filtered])

  const showAll = () => {
    setCategory('all')
    setMode('all')
    setPlanOnly(false)
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/practice" className="text-caddie-ink-dim hover:text-caddie-ink" style={{ fontSize: 13, display: 'inline-block', marginBottom: 14 }}>
        ← Practice
      </Link>
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
        Drills
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginTop: 6, maxWidth: 600 }}>
        {drills.length > 0 ? `${drills.length} drills` : 'Every drill'} the plan can draw from, each with the why, the how
        and a rep target. Open one to read it.
      </p>

      {/* Filters as latched keys (mobile drills.tsx): this week's plan, part of the game and order, then
          the practice mode. On a phone each row scrolls sideways. */}
      <div style={{ marginTop: 18, paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="drl-keys">
          {planIds.size > 0 ? (
            <>
              <FilterKey on={planOnly} onClick={() => setPlanOnly((v) => !v)}>
                In this week's plan · {planIds.size}
              </FilterKey>
              <Divider />
            </>
          ) : null}
          <div role="group" aria-label="Part of the game" className="flex" style={{ gap: 6 }}>
            {(['all', ...CATEGORIES] as const).map((c) => (
              <FilterKey key={c} on={category === c} onClick={() => setCategory(c)}>
                {c === 'all' ? 'All' : CATEGORY_LABEL[c]}
              </FilterKey>
            ))}
          </div>
          <Divider />
          <button
            type="button"
            onClick={() => setSort((s) => (s === 'az' ? 'za' : 'az'))}
            className="key key-sm"
            aria-label={`Sort ${sort === 'az' ? 'Z to A' : 'A to Z'}`}
          >
            {sort === 'az' ? 'A to Z' : 'Z to A'}
          </button>
        </div>
        <div role="group" aria-label="Practice mode" className="drl-keys">
          {(['all', ...MODES] as const).map((m) => (
            <FilterKey key={m} on={mode === m} onClick={() => setMode(m)}>
              {m === 'all' ? 'Any mode' : BLOCK_TYPE_LABEL[m]}
            </FilterKey>
          ))}
        </div>
      </div>

      {drillsQuery.isLoading ? (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, paddingTop: 24 }}>
          Loading drills…
        </div>
      ) : drillsQuery.error ? (
        <div
          className="text-caddie-neg"
          role="alert"
          style={{ marginTop: 24, border: `1px solid ${LINE}`, borderRadius: 4, padding: '12px 14px', fontSize: 13 }}
        >
          {toUserMessage(drillsQuery.error)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ borderTop: '1.5px solid #1C211C', paddingTop: 16 }}>
          <p className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic' }}>
            {emptyLine(category, mode, planOnly)}
          </p>
          <button type="button" onClick={showAll} className="text-caddie-ink underline underline-offset-4" style={{ fontSize: 14, marginTop: 6 }}>
            Show every drill
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} style={{ borderTop: '1.5px solid #1C211C', marginBottom: 26 }}>
            <div className="flex items-baseline justify-between" style={{ padding: '10px 0 4px' }}>
              <h2 className="font-serif text-caddie-ink" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500 }}>
                {g.title}
              </h2>
              <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                {g.drills.length} drill{g.drills.length === 1 ? '' : 's'}
              </span>
            </div>
            {/* Two index columns from 1024 px; read down, then across. Each column is its own stack, so
                opening a drill only moves the lines under it. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 items-start" style={{ columnGap: 36 }}>
              {[g.drills.slice(0, Math.ceil(g.drills.length / 2)), g.drills.slice(Math.ceil(g.drills.length / 2))].map(
                (col, i) => (
                  <div key={i}>
                    {col.map((d) => (
                      <IndexLine key={d.id} drill={d} inPlan={planIds.has(d.id)} />
                    ))}
                  </div>
                ),
              )}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function emptyLine(category: PlanCategory | 'all', mode: BlockType | 'all', planOnly: boolean): string {
  const what = [
    mode === 'all' ? null : BLOCK_TYPE_LABEL[mode].toLowerCase(),
    'drills',
    category === 'all' ? null : `for ${CATEGORY_LABEL[category].toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' ')
  return planOnly ? `This week's plan has no ${what}.` : `No ${what} yet.`
}

function FilterKey({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="key key-sm">
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden style={{ flex: 'none', width: 1, height: 24, background: '#9F9580', margin: '0 6px' }} />
}

function IndexLine({ drill, inPlan }: { drill: Drill; inPlan: boolean }) {
  const [open, setOpen] = useState(false)
  const instructions = drill.instructions?.trim() || drill.description?.trim() || ''
  const canExpand = instructions.length > 0
  const type = drill.drill_type as BlockType
  const meta = [
    BLOCK_TYPE_LABEL[type] ?? drill.drill_type,
    ...(drill.facility ?? []).map((f) => FACILITY_LABEL[f] ?? f),
  ].join(' · ')

  return (
    <div style={{ borderTop: `1px solid ${LINE}`, padding: '9px 0 8px' }} data-testid="drill-line">
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        aria-expanded={canExpand ? open : undefined}
        aria-controls={canExpand ? `drill-detail-${drill.id}` : undefined}
        className="flex items-baseline w-full text-left group"
        style={{ cursor: canExpand ? 'pointer' : 'default', gap: 6 }}
      >
        <span
          className="font-serif text-caddie-ink group-hover:underline"
          style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.3 }}
        >
          {drill.name}
        </span>
        {/* Dot leaders out to the minutes, as in a printed index. */}
        <span aria-hidden style={{ flex: 1, minWidth: 16, borderBottom: '1px dotted #9F9580', transform: 'translateY(-4px)' }} />
        {drill.duration_min != null ? (
          <span className="font-serif tabular text-caddie-ink" style={{ fontSize: 17, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {drill.duration_min}
            <span className="font-sans text-caddie-ink-dim" style={{ fontSize: 12, marginLeft: 3 }}>
              min
            </span>
          </span>
        ) : null}
      </button>
      <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ModeSwatch type={type} />
        <span>
          {meta}
          {inPlan ? (
            <span className="text-caddie-ink" style={{ fontWeight: 600 }}>
              {' '}
              · In this week's plan
            </span>
          ) : null}
        </span>
      </div>
      {canExpand && open ? (
        // Opens by growing its row from 0fr to 1fr (index.css .drl-open).
        <div id={`drill-detail-${drill.id}`} className="drl-open">
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <div style={{ paddingTop: 10, paddingBottom: 6 }}>
              {renderInstructions(instructions)}
              {drill.source ? (
                <div className="text-caddie-ink-dim" style={{ fontSize: 12, marginTop: 12 }}>
                  From{' '}
                  {drill.source_url ? (
                    <a href={drill.source_url} target="_blank" rel="noopener noreferrer" className="text-caddie-ink underline">
                      {drill.source}
                    </a>
                  ) : (
                    drill.source
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
