import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Declared here, not imported from vite-plugins/dev-admin-api: that file lives
// in the tsconfig.node.json project (it imports node:http and vite), and
// pulling it into the app program breaks `pnpm typecheck`. Same reason
// src/hooks/useCourseEditor.ts declares its own types instead of importing
// dev-course-api's. Field names must match that plugin's interfaces exactly.
interface PendingCourse {
  id: string
  name: string
  city: string | null
  state: string | null
  created_by: string | null
  created_at: string
}
interface PendingPanel {
  total: number
  rows: PendingCourse[]
}
interface CrawlerPanel {
  byStatus: Record<string, number>
  oldestCrawledAt: string | null
  errors: { id: string; error_message: string | null }[]
}
interface Delta {
  current: number
  prior: number
}
interface UsagePanel {
  profiles: Delta
  rounds: Delta
  activeUsers: Delta
}
interface QualityPanel {
  missingState: number
  missingCoords: number
  oddHoleCount: number
}
type Panel<T> = T | { error: string }
interface AdminStats {
  projectRef: string
  isDevProject: boolean
  pending: Panel<PendingPanel>
  crawler: Panel<CrawlerPanel>
  usage: Panel<UsagePanel>
  quality: Panel<QualityPanel>
}

function isError<T>(p: Panel<T>): p is { error: string } {
  return typeof p === 'object' && p !== null && 'error' in p
}

function useAdminStats() {
  return useQuery({
    queryKey: ['dev-admin', 'stats'],
    queryFn: async (): Promise<AdminStats> => {
      const res = await fetch('/api/dev-admin/stats')
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      return body as AdminStats
    },
  })
}

function useCourseAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch(
        action === 'approve' ? `/api/dev-admin/courses/${id}/approve` : `/api/dev-admin/courses/${id}`,
        { method: action === 'approve' ? 'POST' : 'DELETE' },
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      return body
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev-admin', 'stats'] }),
  })
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: '1px solid #e5e2dc',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <h2 className="font-serif text-caddie-ink" style={{ fontSize: 16, fontWeight: 500 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function PanelBody<T>({ panel, render }: { panel: Panel<T>; render: (data: T) => React.ReactNode }) {
  if (isError(panel)) {
    // Raw message on purpose — this page is dev-only, so toUserMessage's
    // reason for existing (keeping PostgREST internals from end users) does
    // not apply, and the raw text is what makes a broken query diagnosable.
    return (
      <div style={{ fontSize: 13, color: '#b4291f', fontFamily: 'monospace' }}>{panel.error}</div>
    )
  }
  return <>{render(panel)}</>
}

function DeltaStat({ label, delta }: { label: string; delta: Delta }) {
  const change = delta.current - delta.prior
  const sign = change > 0 ? '+' : ''
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span className="text-caddie-ink-mute">{label}</span>
      <span className="text-caddie-ink">
        {delta.current}{' '}
        <span className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
          ({sign}
          {change} vs prior 7d)
        </span>
      </span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span className="text-caddie-ink-mute">{label}</span>
      <span className="text-caddie-ink">{value}</span>
    </div>
  )
}

export default function AdminDashboardPage() {
  const stats = useAdminStats()
  const action = useCourseAction()

  if (stats.isLoading) {
    return (
      <div style={{ padding: 32 }} className="text-caddie-ink-mute">
        Loading…
      </div>
    )
  }
  if (stats.isError || !stats.data) {
    return (
      <div style={{ padding: 32, color: '#b4291f' }}>
        {stats.error instanceof Error ? stats.error.message : 'Failed to load stats'}
      </div>
    )
  }

  const { projectRef, isDevProject, pending, crawler, usage, quality } = stats.data

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          background: isDevProject ? '#eef3ee' : '#b4291f',
          color: isDevProject ? undefined : '#fff',
        }}
        className={isDevProject ? 'text-caddie-ink' : undefined}
      >
        {isDevProject
          ? `Reading dev project (${projectRef})`
          : `PRODUCTION (${projectRef}) — writes here are live, and the Course Editor is pointed here too`}
      </div>

      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 24, fontWeight: 500 }}>
        Ops Dashboard
      </h1>

      <Card title="Pending courses">
        <PanelBody<PendingPanel>
          panel={pending}
          render={(d) => (
            <>
              <Row label="Awaiting review" value={d.total} />
              {d.rows.length === 0 ? (
                <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
                  Nothing pending.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {d.rows.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '6px 0',
                        fontSize: 13,
                      }}
                    >
                      <span className="text-caddie-ink">
                        {c.name}
                        <span className="text-caddie-ink-mute">
                          {' '}
                          — {c.city ?? '—'}, {c.state ?? '—'}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="text-caddie-ink-mute">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          disabled={action.isPending || stats.isFetching}
                          onClick={() => action.mutate({ id: c.id, action: 'approve' })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={action.isPending || stats.isFetching}
                          onClick={() => {
                            if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return
                            action.mutate({ id: c.id, action: 'reject' })
                          }}
                        >
                          Reject
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {action.isError && (
                <div style={{ fontSize: 13, color: '#b4291f' }}>
                  {action.error instanceof Error ? action.error.message : 'Action failed'}
                </div>
              )}
            </>
          )}
        />
      </Card>

      <Card title="Crawler health">
        <PanelBody<CrawlerPanel>
          panel={crawler}
          render={(d) => (
            <>
              {Object.entries(d.byStatus).map(([status, n]) => (
                <Row key={status} label={status} value={n} />
              ))}
              <Row
                label="Oldest sweep"
                value={d.oldestCrawledAt ? new Date(d.oldestCrawledAt).toLocaleDateString() : '—'}
              />
              {d.errors.map((e) => (
                <div key={e.id} style={{ fontSize: 12, color: '#b4291f', fontFamily: 'monospace' }}>
                  {e.id}: {e.error_message ?? 'no message'}
                </div>
              ))}
            </>
          )}
        />
      </Card>

      <Card title="Usage — last 7 days">
        <PanelBody<UsagePanel>
          panel={usage}
          render={(d) => (
            <>
              <DeltaStat label="New profiles" delta={d.profiles} />
              <DeltaStat label="Rounds logged" delta={d.rounds} />
              <DeltaStat label="Users who logged a round" delta={d.activeUsers} />
              <div className="text-caddie-ink-mute" style={{ fontSize: 12, marginTop: 4 }}>
                Profiles are written at onboarding, not at signup — anyone who signs up and
                abandons onboarding is not counted here.
              </div>
            </>
          )}
        />
      </Card>

      <Card title="Data quality">
        <PanelBody<QualityPanel>
          panel={quality}
          render={(d) => (
            <>
              <Row label="Courses missing state" value={d.missingState} />
              <Row label="Courses missing coordinates" value={d.missingCoords} />
              <Row
                label="Courses with partial hole geometry (excludes zero-hole courses)"
                value={d.oddHoleCount}
              />
            </>
          )}
        />
      </Card>
    </div>
  )
}
