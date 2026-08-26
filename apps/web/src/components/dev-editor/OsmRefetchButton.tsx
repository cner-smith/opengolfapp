import { useState } from 'react'
import { toUserMessage } from '../../lib/errors'
import { useRefetchOsm } from '../../hooks/useCourseEditor'

export function OsmRefetchButton({
  courseId,
  lat,
  lng,
}: {
  courseId: string
  lat: number | null
  lng: number | null
}) {
  const [radius, setRadius] = useState('1200')
  const refetch = useRefetchOsm()

  const disabled = refetch.isPending || lat == null || lng == null

  return (
    <div
      className="bg-caddie-surface"
      style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="kicker">Re-fetch holes from OpenStreetMap</div>
      <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
        Wipes and replaces this course's holes with fresh tee/pin coordinates, par, and
        yardage from OSM — same logic as <code>pnpm import:osm</code>. Requires the course
        location to be set (drag the map above first).
      </div>
      <div className="flex" style={{ gap: 10, alignItems: 'flex-end' }}>
        <label>
          <div className="text-caddie-ink-mute" style={{ fontSize: 11, marginBottom: 4 }}>
            Search radius (meters)
          </div>
          <input
            style={{ border: '1px solid #D9D2BF', borderRadius: 2, padding: '8px 10px', fontSize: 13, width: 120 }}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            refetch.mutate({
              courseId,
              lat: lat ?? undefined,
              lng: lng ?? undefined,
              radius: Number(radius) || 1200,
            })
          }
          className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
          style={{ borderRadius: 2, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
        >
          {refetch.isPending ? 'Fetching…' : 'Re-fetch from OSM'}
        </button>
      </div>

      {refetch.error && (
        <div className="text-caddie-neg" style={{ fontSize: 12 }}>
          {toUserMessage(refetch.error)}
        </div>
      )}

      {refetch.data && (
        <div className="font-mono" style={{ fontSize: 11, lineHeight: 1.7, color: '#5C6356' }}>
          <div>{refetch.data.created ? 'Created course' : 'Updated course'}</div>
          <div>Imported {refetch.data.holesImported} holes ({refetch.data.greenMatches} green matches, {refetch.data.teeMatches} tee matches)</div>
          <div>Refs found: {refetch.data.refsFound.join(', ') || '—'}</div>
          {refetch.data.missingRefs.length > 0 && <div>Missing 1-18: {refetch.data.missingRefs.join(', ')}</div>}
          {refetch.data.missingParRefs.length > 0 && <div>No/invalid par (defaulted to 4): {refetch.data.missingParRefs.join(', ')}</div>}
          {refetch.data.missingYardsRefs.length > 0 && <div>No yardage: {refetch.data.missingYardsRefs.join(', ')}</div>}
          {refetch.data.wipedHoles > 0 && <div>Cleared {refetch.data.wipedHoles} existing hole rows first</div>}
        </div>
      )}
    </div>
  )
}
