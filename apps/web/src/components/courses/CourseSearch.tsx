import { useEffect, useMemo, useState } from 'react'
import { formatLocation } from '@oga/core'
import {
  useCourseSearch,
  useCreateManualCourse,
  useImportApiCourse,
} from '../../hooks/useCourses'

interface CourseSearchProps {
  selectedCourseId: string | null
  onSelect: (courseId: string, courseName: string) => void
}

interface GpsState {
  status: 'idle' | 'pending' | 'ok' | 'denied'
  lat?: number
  lng?: number
}

export function CourseSearch({ selectedCourseId, onSelect }: CourseSearchProps) {
  const [query, setQuery] = useState('')
  const [creatingManual, setCreatingManual] = useState(false)
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const search = useCourseSearch(query)
  const importApi = useImportApiCourse()

  const apiResults = search.data?.api ?? []
  const localResults = search.data?.local ?? []
  const noMatches =
    !search.isLoading &&
    query.trim().length > 0 &&
    apiResults.length === 0 &&
    localResults.length === 0

  // Capture GPS once when the search box is opened so manual + API
  // imports can stamp the user's tee location on hole 1.
  useEffect(() => {
    if (gps.status !== 'idle') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps({ status: 'denied' })
      return
    }
    setGps({ status: 'pending' })
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          status: 'ok',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setGps({ status: 'denied' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    )
  }, [gps.status])

  const gpsCoords = gps.status === 'ok' ? { lat: gps.lat!, lng: gps.lng! } : null

  async function handleSelectApi(id: string, name: string, location: string) {
    const course = await importApi.mutateAsync({
      apiId: id,
      fallbackName: name,
      fallbackLocation: location,
      gpsTeeCoords: gpsCoords,
    })
    onSelect(course.id, course.name)
    setQuery('')
  }

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <input
        type="text"
        placeholder="Search courses…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-caddie-surface text-caddie-ink"
        style={{
          border: '1px solid #D9D2BF',
          borderRadius: 2,
          padding: '10px 12px',
          fontSize: 14,
        }}
      />

      {query.trim().length > 0 && !creatingManual && (
        <div
          className="bg-caddie-surface"
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {search.isLoading && (
            <div
              className="text-caddie-ink-mute"
              style={{ padding: 14, fontSize: 13 }}
            >
              Searching…
            </div>
          )}

          {!search.isLoading && localResults.length > 0 && (
            <SearchGroup label="Already imported">
              {localResults.map((c) => (
                <SearchRow
                  key={c.id}
                  selected={selectedCourseId === c.id}
                  title={c.name}
                  subtitle={c.location ?? undefined}
                  onClick={() => {
                    onSelect(c.id, c.name)
                    setQuery('')
                  }}
                />
              ))}
            </SearchGroup>
          )}

          {!search.isLoading && apiResults.length > 0 && (
            <SearchGroup label="OpenGolfAPI">
              {apiResults.map((r) => (
                <SearchRow
                  key={r.id}
                  selected={false}
                  title={r.name}
                  subtitle={formatLocation(r) || undefined}
                  busy={importApi.isPending}
                  onClick={() => handleSelectApi(r.id, r.name, formatLocation(r))}
                />
              ))}
            </SearchGroup>
          )}

          {noMatches && (
            <button
              type="button"
              onClick={() => setCreatingManual(true)}
              className="block w-full text-left text-caddie-accent transition-colors hover:bg-caddie-bg"
              style={{ padding: '14px 14px', fontSize: 14, fontWeight: 500 }}
            >
              Course not found?{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                Add it →
              </span>
            </button>
          )}

          {search.error && (
            <div
              className="text-caddie-neg"
              style={{ padding: 14, fontSize: 12 }}
            >
              {(search.error as Error).message}
            </div>
          )}
        </div>
      )}

      {importApi.error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {(importApi.error as Error).message}
        </div>
      )}

      {creatingManual && (
        <ManualCourseForm
          initialName={query}
          gpsCoords={gpsCoords}
          onCancel={() => setCreatingManual(false)}
          onCreated={(course) => {
            onSelect(course.id, course.name)
            setCreatingManual(false)
            setQuery('')
          }}
        />
      )}
    </div>
  )
}

function SearchGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="kicker"
        style={{
          padding: '10px 14px 6px',
          borderBottom: '1px solid #D9D2BF',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function SearchRow({
  title,
  subtitle,
  selected,
  busy,
  onClick,
}: {
  title: string
  subtitle?: string
  selected: boolean
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="block w-full text-left transition-colors hover:bg-caddie-bg disabled:opacity-50"
      style={{
        padding: '12px 14px',
        backgroundColor: selected ? 'rgba(31,61,44,0.08)' : 'transparent',
        borderTop: '1px solid #D9D2BF',
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{ fontSize: 15, fontWeight: 500 }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          className="text-caddie-ink-mute"
          style={{ fontSize: 12, marginTop: 2 }}
        >
          {subtitle}
        </div>
      )}
    </button>
  )
}

interface ManualCourseFormProps {
  initialName: string
  gpsCoords: { lat: number; lng: number } | null
  onCancel: () => void
  onCreated: (course: { id: string; name: string }) => void
}

function ManualCourseForm({
  initialName,
  gpsCoords,
  onCancel,
  onCreated,
}: ManualCourseFormProps) {
  const create = useCreateManualCourse()
  const [name, setName] = useState(initialName)
  const [location, setLocation] = useState('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(() =>
    new Array(18).fill(4) as number[],
  )

  const visiblePars = useMemo(() => pars.slice(0, holeCount), [pars, holeCount])

  function cyclePar(idx: number) {
    setPars((prev) => {
      const next = prev.slice()
      const cur = next[idx] ?? 4
      next[idx] = cur === 3 ? 4 : cur === 4 ? 5 : 3
      return next
    })
  }

  async function submit() {
    if (!name.trim()) return
    const course = await create.mutateAsync({
      name,
      location: location || null,
      pars: visiblePars,
      gpsTeeCoords: gpsCoords,
    })
    onCreated({ id: course.id, name: course.name })
  }

  return (
    <div
      className="bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div className="kicker">Add course</div>
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        <input
          type="text"
          placeholder="Course name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-caddie-bg text-caddie-ink"
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 14,
          }}
        />
        <input
          type="text"
          placeholder="City, State (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-caddie-bg text-caddie-ink"
          style={{
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 14,
          }}
        />
      </div>

      <div className="flex" style={{ gap: 8 }}>
        <HoleCountChip
          label="18 holes"
          active={holeCount === 18}
          onClick={() => setHoleCount(18)}
        />
        <HoleCountChip
          label="9 holes"
          active={holeCount === 9}
          onClick={() => setHoleCount(9)}
        />
      </div>

      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          Par per hole — tap to cycle 3/4/5
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${holeCount === 18 ? 9 : 9}, 1fr)`,
            gap: 8,
          }}
        >
          {visiblePars.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => cyclePar(idx)}
              className="text-caddie-ink"
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                className="kicker tabular"
                style={{ fontSize: 9 }}
              >
                {idx + 1}
              </span>
              <span
                className="font-serif tabular"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: '#EBE5D6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#1C211C',
                }}
              >
                {p}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="text-caddie-ink-mute"
        style={{ fontSize: 12 }}
      >
        {gpsCoords
          ? `GPS captured (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}) — set as hole 1 tee.`
          : 'GPS unavailable — hole coords left blank.'}
      </div>

      {create.error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {(create.error as Error).message}
        </div>
      )}

      <div className="flex" style={{ gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          className="text-caddie-ink-dim"
          style={{
            background: 'transparent',
            border: '1px solid #D9D2BF',
            borderRadius: 2,
            padding: '10px 14px',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending || !name.trim()}
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{
            borderRadius: 2,
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {create.isPending ? 'Creating…' : 'Create course'}{' '}
          {!create.isPending && (
            <span className="font-serif" style={{ fontStyle: 'italic' }}>
              →
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

function HoleCountChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
        color: active ? '#F2EEE5' : '#1C211C',
        border: 'none',
        borderRadius: 2,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}
