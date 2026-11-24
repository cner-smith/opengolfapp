import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodePolyline, MIN_OUTLINE_POINTS, type GeoPoint } from '@oga/core'
import { saveMyGreenOutline } from '@oga/supabase'
import { createMap, mapboxgl } from '../../../lib/mapbox'
import { supabase } from '../../../lib/supabase'
import { toUserMessage } from '../../../lib/errors'
import { P } from '../map/PaperChrome'

// Fix this green on the web (#1504; the phone's twin, same words). The round
// view's panel becomes the redraw panel and the map takes the clicks: a click
// adds a point, drag and scroll move the map, a point drags, clicking the
// first point closes. Z undo · Esc cancel · Enter save. Saved, the outline is
// the player's own at once (private for now, #1505).

const serif: CSSProperties = { fontFamily: 'var(--caddie-serif)', fontStyle: 'italic', fontWeight: 500 }
const sans: CSSProperties = { fontFamily: 'var(--caddie-sans)' }
const OURS = '#FBF8F1'
const YOURS = '#FFD666'
const FIRST = '#B5521F'
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const line = (pts: GeoPoint[]): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } })

export interface GreenRedrawProps {
  holeNumber: number
  /** The green_maps hole id the outline is saved under. */
  greenId: string
  ours: GeoPoint[]
  gridSource: string | null
  flownOn: string | null
  /** Panel beside the map (desktop) or under it. */
  wide: boolean
  onClose: () => void
}

export function GreenRedraw(p: GreenRedrawProps) {
  const qc = useQueryClient()
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pts, setPts] = useState<GeoPoint[]>([])
  const [closed, setClosed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const closedRef = useRef(closed)
  closedRef.current = closed || saved

  useEffect(() => {
    if (!box.current) return
    const lngs = p.ours.map((q) => q.lng)
    const lats = p.ours.map((q) => q.lat)
    const map = createMap(
      {
        container: box.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        fitBoundsOptions: { padding: 60 },
        maxZoom: 21,
        dragRotate: false,
        pitchWithRotate: false,
        doubleClickZoom: false,
      },
      () => setFailed(true),
    )
    if (!map) return
    map.touchZoomRotate.disableRotation()
    map.on('load', () => {
      map.addSource('redraw-ours', { type: 'geojson', data: line(p.ours) })
      map.addLayer({ id: 'redraw-ours', type: 'line', source: 'redraw-ours', paint: { 'line-color': OURS, 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } })
      map.addSource('redraw-yours', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'redraw-yours-fill', type: 'fill', source: 'redraw-yours', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': YOURS, 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'redraw-yours-line', type: 'line', source: 'redraw-yours', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': YOURS, 'line-width': 3 }, layout: { 'line-join': 'round' } })
      setReady(true)
    })
    // Only a click on the map itself adds a point; a point's own click doesn't.
    map.on('click', (e) => {
      if (e.originalEvent.target !== map.getCanvas() || closedRef.current) return
      setError(null)
      setPts((c) => [...c, { lat: e.lngLat.lat, lng: e.lngLat.lng }])
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // The map is made once per redraw; `ours` doesn't change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The drawing and its points follow state.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const ring = closed ? [...pts, pts[0]!] : pts
    const features: GeoJSON.Feature[] = []
    if (closed) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring.map((q) => [q.lng, q.lat])] } })
    if (ring.length >= 2) features.push(line(ring))
    ;(map.getSource('redraw-yours') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
    const markers = pts.map((q, i) => {
      const big = i === 0 && pts.length >= 3 && !closed
      const el = document.createElement('div')
      const d = big ? 22 : 14
      el.style.cssText = `width:${d}px;height:${d}px;border-radius:50%;background:${i === 0 ? FIRST : YOURS};border:2px solid ${P.ink};cursor:${big ? 'pointer' : 'grab'}`
      if (big) el.title = 'Close the shape'
      const m = new mapboxgl.Marker({ element: el, draggable: !saved }).setLngLat([q.lng, q.lat]).addTo(map)
      let dragged = false
      m.on('dragstart', () => (dragged = true))
      m.on('dragend', () => {
        const ll = m.getLngLat()
        setPts((c) => c.map((x, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : x)))
      })
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (big && !dragged) setClosed(true)
        dragged = false
      })
      return m
    })
    return () => markers.forEach((m) => m.remove())
  }, [ready, pts, closed, saved])

  const n = pts.length
  const canSave = n >= MIN_OUTLINE_POINTS && !saving && !saved
  const undo = () => (closed ? setClosed(false) : setPts((c) => c.slice(0, -1)))
  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const { error: err } = await saveMyGreenOutline(supabase, p.greenId, encodePolyline([...pts, pts[0]!]))
    setSaving(false)
    if (err) return setError(toUserMessage(err))
    await qc.invalidateQueries({ queryKey: ['my-green-outlines'] })
    setClosed(true)
    setSaved(true)
  }
  const keys = useRef({ undo, save, close: p.onClose, saved })
  keys.current = { undo, save, close: p.onClose, saved }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = keys.current
      if (e.key === 'Escape') k.close()
      else if (k.saved) return
      else if (e.key === 'z' || e.key === 'Z') k.undo()
      else if (e.key === 'Enter') void k.save()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const surveyName = p.gridSource ? (p.gridSource.startsWith('3dep') ? 'USGS 3DEP lidar' : 'Lidar') : null
  const hint = closed ? 'Closed · Save when happy' : n >= 3 ? 'Click the first point to close' : 'Click around the edge'
  const kbd: CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 12, border: `1px solid ${P.inkDim}`, borderRadius: 3, padding: '0 4px' }

  return (
    <div
      data-testid="green-redraw"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'grid',
        gridTemplateColumns: p.wide ? 'minmax(300px, 400px) 1fr' : '1fr',
        gridTemplateRows: p.wide ? '1fr' : '1fr auto',
        background: P.chrome,
      }}
    >
      <div
        style={{
          order: p.wide ? 0 : 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '18px 18px 16px',
          borderRight: p.wide ? `1px solid ${P.ink}` : undefined,
          borderTop: p.wide ? undefined : `1px solid ${P.ink}`,
          overflow: 'auto',
          ...sans,
          fontSize: 14,
          color: P.ink,
        }}
      >
        {saved ? (
          <>
            <div style={{ ...serif, fontSize: 24 }}>Saved</div>
            <div style={{ fontSize: 16 }}>Yours now. The slope map follows your outline straight away.</div>
            <div style={{ color: P.inkDim, fontSize: 12.5 }}>{surveyName ? `${surveyName} · your outline` : 'Your outline'}</div>
            <div style={{ flex: 1 }} />
            <button type="button" className="key key-primary" onClick={p.onClose}>
              Back to the green
            </button>
          </>
        ) : (
          <>
            <div>
              <div style={{ ...serif, fontSize: 24 }}>Redraw hole {p.holeNumber}’s green</div>
              <div style={{ color: P.inkDim }}>{hint}</div>
            </div>
            <div style={{ color: P.inkDim, lineHeight: 1.6 }}>
              Drag to move, scroll to zoom, drag a point to fix it. <span style={kbd}>Z</span> undo · <span style={kbd}>Esc</span> cancel ·{' '}
              <span style={kbd}>Enter</span> save
            </div>
            <div>
              <b>The survey</b>
              <div style={{ color: P.inkDim }}>
                {surveyName
                  ? `${surveyName}${p.flownOn ? `, flown ${p.flownOn.slice(0, 4)}` : ''}. It covers the ground around the pin; a shape it doesn’t reach shows outline only.`
                  : 'No slope survey covers this green yet.'}
              </div>
            </div>
            {error && <div style={{ color: P.neg }}>{error}</div>}
            {failed && <div style={{ color: P.neg }}>The map didn’t load. Check your connection and try again.</div>}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" className="key" disabled={n === 0 || saving} onClick={undo}>
                Undo
              </button>
              <button
                type="button"
                className="key"
                disabled={n === 0 || saving}
                onClick={() => {
                  setPts([])
                  setClosed(false)
                }}
              >
                Start over
              </button>
              <button type="button" className="key" onClick={p.onClose}>
                Cancel
              </button>
              <button type="button" className="key key-primary" disabled={!canSave} onClick={() => void save()}>
                {saving ? 'Saving…' : n < MIN_OUTLINE_POINTS ? `Save (${MIN_OUTLINE_POINTS - n} more)` : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
      <div style={{ position: 'relative', minHeight: p.wide ? 0 : 360 }}>
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            background: 'rgba(28,33,28,.78)',
            borderRadius: 4,
            padding: '6px 9px',
            display: 'flex',
            gap: 10,
            pointerEvents: 'none',
            ...sans,
            fontSize: 13,
          }}
        >
          <span style={{ color: OURS }}>┅ ours</span>
          <span style={{ color: YOURS }}>━ yours</span>
        </div>
      </div>
    </div>
  )
}
