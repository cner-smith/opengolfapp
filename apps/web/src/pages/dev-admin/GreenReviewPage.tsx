import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Review queue for flagged green outlines (#1376). Types mirror
// vite-plugins/dev-green-review.ts (not imported: that file is in the node tsconfig).
interface Pt {
  lat: number
  lng: number
}
interface FlaggedGreen {
  holeId: string
  course: string
  state: string | null
  number: number
  ring: Pt[]
  areaM2: number
  source: string
  score: number | null
  reason: string | null
  pin: Pt | null
  hasGrid: boolean
}
interface GreenContext {
  bbox: [number, number, number, number]
  layers: string[]
  credit: string
  osm: Pt[][]
  osmError?: string
}

// The outliner's flag codes (#1375) in plain words. Anything else (an importer's
// own sentence, e.g. "nearest green, 12 m from the pin") shows as written.
const REASONS: Record<string, string> = {
  start_moved: 'The pin was not on green grass, so the start was moved to a nearby green patch.',
  start_off_line: 'No nearby patch lines up with the hole; the start may be on the wrong thing.',
  start_unchecked: 'No tee or hole line to check the direction against.',
  solidity: 'Ragged shape, or bites out of it.',
  shade_edge: 'Shade or trees along more than a fifth of the edge; a shadow may cut it.',
  area_small: 'Under 150 m², small for a green.',
  area_large: 'Over 1,500 m², big for a green.',
  trace_disagree: 'Disagrees with the OSM trace (overlap under 70%).',
  no_nir: 'The photo has no infrared, so water and shade went unchecked.',
  no_mask: 'The model found no outline.',
  no_image: 'No photo was available.',
}
const reasonWords = (r: string | null) =>
  (r ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => REASONS[c] ?? c)

const PX = 800
const OSM_COLOR = '#ffd400'
const MODEL_COLOR = '#22d3ee'
const DRAW_COLOR = '#ff4fd8'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json()
  // Raw message on purpose, like the ops dashboard: dev-only, and the raw text is
  // what makes a failure diagnosable.
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return body as T
}

export default function GreenReviewPage() {
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['dev-admin', 'greens'],
    queryFn: () => call<{ total: number; rows: FlaggedGreen[] }>('/api/dev-admin/greens'),
  })
  const [selected, setSelected] = useState<string | null>(null)
  const rows = list.data?.rows ?? []
  const item = rows.find((r) => r.holeId === selected) ?? rows[0] ?? null

  const ctx = useQuery({
    queryKey: ['dev-admin', 'greens', item?.holeId, 'context'],
    queryFn: () => call<GreenContext>(`/api/dev-admin/greens/${item!.holeId}/context`),
    enabled: !!item,
    staleTime: Infinity,
  })

  const [drawing, setDrawing] = useState(false)
  const [drawn, setDrawn] = useState<Pt[]>([])
  const [showLines, setShowLines] = useState(true)
  useEffect(() => {
    setDrawing(false)
    setDrawn([])
  }, [item?.holeId])

  const act = useMutation({
    mutationFn: ({
      kind,
      holeId,
      ring,
    }: {
      kind: 'accept' | 'reject' | 'redraw'
      holeId: string
      ring?: Pt[]
    }) =>
      kind === 'accept'
        ? call(`/api/dev-admin/greens/${holeId}/accept`, { method: 'POST' })
        : kind === 'reject'
          ? call(`/api/dev-admin/greens/${holeId}`, { method: 'DELETE' })
          : call(`/api/dev-admin/greens/${holeId}/outline`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ring }),
            }),
    onSuccess: (_d, v) => {
      const i = rows.findIndex((r) => r.holeId === v.holeId)
      setSelected(rows[i + 1]?.holeId ?? rows[i - 1]?.holeId ?? null)
      return qc.invalidateQueries({ queryKey: ['dev-admin', 'greens'], exact: true })
    },
  })

  if (list.isLoading)
    return (
      <div style={{ padding: 32 }} className="text-caddie-ink-mute">
        Loading…
      </div>
    )
  if (list.isError)
    return <div style={{ padding: 32, color: '#b4291f' }}>{(list.error as Error).message}</div>

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 13 }}>
        <Link to="/dev/admin" className="text-caddie-ink-dim">
          ← Ops Dashboard
        </Link>
      </div>
      <h1 className="font-serif text-caddie-ink" style={{ fontSize: 24, fontWeight: 500 }}>
        Flagged green outlines
      </h1>
      <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
        {list.data!.total === rows.length
          ? `${rows.length} to review`
          : `${rows.length} of ${list.data!.total} to review`}
      </div>
      {rows.length === 0 ? (
        <div className="text-caddie-ink-dim">Nothing flagged.</div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <ul
            style={{
              flex: '0 1 300px',
              minWidth: 240,
              maxHeight: 760,
              overflowY: 'auto',
              borderTop: '1px solid var(--caddie-line)',
            }}
          >
            {rows.map((r) => (
              <li key={r.holeId}>
                <button
                  type="button"
                  onClick={() => setSelected(r.holeId)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--caddie-line)',
                    background: r.holeId === item?.holeId ? 'var(--caddie-surface-2)' : undefined,
                  }}
                >
                  <div className="text-caddie-ink" style={{ fontSize: 14 }}>
                    {r.course} <span className="text-caddie-ink-mute">#{r.number}</span>
                  </div>
                  <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
                    {r.source} · {Math.round(r.areaM2)} m² · {r.reason}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {item && (
            <div
              style={{
                flex: '1 1 560px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minWidth: 0,
              }}
            >
              <div>
                <div className="font-serif text-caddie-ink" style={{ fontSize: 18 }}>
                  {item.course}
                  {item.state ? `, ${item.state}` : ''} · hole {item.number}
                </div>
                <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
                  {item.source} outline, {Math.round(item.areaM2)} m²
                  {item.score != null ? ` · model confidence ${item.score.toFixed(2)}` : ''}
                  {item.hasGrid ? ' · has a height grid' : ''}
                </div>
                <ul
                  style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc', fontSize: 14 }}
                  className="text-caddie-ink"
                >
                  {reasonWords(item.reason).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>

              <Photo
                item={item}
                ctx={ctx.data}
                error={ctx.isError ? (ctx.error as Error).message : null}
                drawing={drawing}
                drawn={drawn}
                setDrawn={setDrawn}
                showLines={showLines}
              />

              <div
                className="text-caddie-ink-mute"
                style={{ fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}
              >
                <span>
                  <Swatch c={MODEL_COLOR} /> {item.source} outline
                </span>
                <span>
                  <Swatch c={OSM_COLOR} dashed /> OSM{' '}
                  {ctx.data
                    ? ctx.data.osmError
                      ? `(failed: ${ctx.data.osmError})`
                      : ctx.data.osm.length
                        ? ''
                        : '(none nearby)'
                    : ''}
                </span>
                {item.pin && <span>+ pin</span>}
                {drawing && (
                  <span>
                    <Swatch c={DRAW_COLOR} /> your outline
                  </span>
                )}
                <label style={{ marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={showLines}
                    onChange={(e) => setShowLines(e.target.checked)}
                  />{' '}
                  Show outlines
                </label>
              </div>
              {ctx.data && (
                <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
                  Photo: {ctx.data.credit}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {drawing ? (
                  <>
                    <Btn
                      primary
                      disabled={drawn.length < 3 || act.isPending}
                      onClick={() =>
                        act.mutate({ kind: 'redraw', holeId: item.holeId, ring: drawn })
                      }
                    >
                      Save outline
                    </Btn>
                    <Btn onClick={() => setDrawn([])} disabled={!drawn.length}>
                      Clear
                    </Btn>
                    <Btn
                      onClick={() => {
                        setDrawing(false)
                        setDrawn([])
                      }}
                    >
                      Cancel
                    </Btn>
                    <span className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
                      Drag one loop around the putting surface; it closes by itself.
                    </span>
                  </>
                ) : (
                  <>
                    <Btn
                      primary
                      disabled={act.isPending}
                      onClick={() => act.mutate({ kind: 'accept', holeId: item.holeId })}
                    >
                      Accept
                    </Btn>
                    <Btn disabled={act.isPending} onClick={() => setDrawing(true)}>
                      Redraw
                    </Btn>
                    <Btn
                      disabled={act.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove the outline for ${item.course} #${item.number}? The green will have no outline.`,
                          )
                        )
                          act.mutate({ kind: 'reject', holeId: item.holeId })
                      }}
                    >
                      Reject
                    </Btn>
                  </>
                )}
              </div>
              {act.isError && (
                <div style={{ fontSize: 13, color: '#b4291f' }}>{(act.error as Error).message}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Photo({
  item,
  ctx,
  error,
  drawing,
  drawn,
  setDrawn,
  showLines,
}: {
  item: FlaggedGreen
  ctx: GreenContext | undefined
  error: string | null
  drawing: boolean
  drawn: Pt[]
  setDrawn: (p: Pt[]) => void
  showLines: boolean
}) {
  const svg = useRef<SVGSVGElement>(null)
  const pen = useRef<Pt[] | null>(null)
  if (error) return <div style={{ color: '#b4291f', fontSize: 13 }}>{error}</div>
  if (!ctx)
    return (
      <div
        className="text-caddie-ink-mute"
        style={{
          aspectRatio: '1',
          maxWidth: 720,
          background: 'var(--caddie-surface-2)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        Loading photo…
      </div>
    )

  const [w, s, e, n] = ctx.bbox
  const x = (p: Pt) => ((p.lng - w) / (e - w)) * PX
  const y = (p: Pt) => ((n - p.lat) / (n - s)) * PX
  const pts = (ring: Pt[]) => ring.map((p) => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const at = (ev: React.PointerEvent): Pt => {
    const r = svg.current!.getBoundingClientRect()
    return {
      lng: w + ((ev.clientX - r.left) / r.width) * (e - w),
      lat: n - ((ev.clientY - r.top) / r.height) * (n - s),
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        aspectRatio: '1',
        background: '#222',
      }}
    >
      {ctx.layers.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ))}
      {!ctx.layers.length && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#eee',
          }}
        >
          {ctx.credit}
        </div>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${PX} ${PX}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: drawing ? 'none' : undefined,
          cursor: drawing ? 'crosshair' : undefined,
        }}
        onPointerDown={(ev) => {
          if (!drawing) return
          ev.currentTarget.setPointerCapture(ev.pointerId)
          pen.current = [at(ev)]
          setDrawn(pen.current)
        }}
        onPointerMove={(ev) => {
          if (!pen.current) return
          const p = at(ev)
          const q = pen.current[pen.current.length - 1]!
          // ~3 screen px between points: about 0.3 m at the usual zoom.
          const r = svg.current!.getBoundingClientRect()
          if (
            Math.hypot(
              ((p.lng - q.lng) / (e - w)) * r.width,
              ((p.lat - q.lat) / (n - s)) * r.height,
            ) < 3
          )
            return
          pen.current = [...pen.current, p]
          setDrawn(pen.current)
        }}
        onPointerUp={() => (pen.current = null)}
        onPointerCancel={() => (pen.current = null)}
      >
        {showLines && (
          <>
            {ctx.osm.map((ring, i) => (
              <polygon
                key={i}
                points={pts(ring)}
                fill="none"
                stroke={OSM_COLOR}
                strokeWidth={2}
                strokeDasharray="8 5"
              />
            ))}
            <polygon points={pts(item.ring)} fill="none" stroke={MODEL_COLOR} strokeWidth={2} />
          </>
        )}
        {item.pin && (
          <path
            d={`M${x(item.pin) - 8},${y(item.pin)}h16M${x(item.pin)},${y(item.pin) - 8}v16`}
            stroke="#fff"
            strokeWidth={2}
          />
        )}
        {drawn.length > 1 && (
          <polygon points={pts(drawn)} fill="none" stroke={DRAW_COLOR} strokeWidth={2} />
        )}
      </svg>
    </div>
  )
}

function Swatch({ c, dashed }: { c: string; dashed?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 18,
        height: 0,
        borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${c}`,
        verticalAlign: 'middle',
      }}
    />
  )
}

function Btn({
  primary,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      style={{
        padding: '8px 14px',
        fontSize: 14,
        border: '1px solid var(--caddie-line-strong)',
        background: primary ? 'var(--caddie-accent)' : 'var(--caddie-surface)',
        color: primary ? 'var(--caddie-accent-ink)' : 'var(--caddie-ink)',
        opacity: p.disabled ? 0.5 : 1,
      }}
    />
  )
}
