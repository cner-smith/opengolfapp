import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Mapbox from '@rnmapbox/maps'
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg'
import { decodePolyline, type GeoPoint } from '@oga/core'
import { getGreenOutlines } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { haptic } from '../../../lib/haptics'
import { TYPE } from '../../../lib/typography'
import { Primary, Secondary } from '../../paper/Dock'
import { P } from '../../paper/tokens'
import { saveDrawnOutline } from './greenData'

// Fix this green (#1504, owner pick A: tap points; click path in the
// fix-green mock). The app's satellite map: one finger taps a point, two move
// and zoom (Mapbox's own gestures), a point drags, and tapping the first point
// closes the shape. Our outline shows dashed underneath. Saved, the outline is
// the player's own at once; private for now (#1505).

const OURS = '#FBF8F1'
const YOURS = '#FFD666'
const FIRST = '#B5521F'
/** Fewer is rarely a green; the mock's bar. */
const MIN_POINTS = 4

const coord = (p: GeoPoint): [number, number] => [p.lng, p.lat]

function pointOf(e: unknown): GeoPoint | null {
  const c = (e as { geometry?: { coordinates?: unknown } } | null)?.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  const [lng, lat] = c as number[]
  // Android sends NaN for a point dragged off the map (as HoleMap guards).
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : null
}

/** Full screen over the round, in its own modal (Android back = Cancel, or Done once saved). */
export function GreenRedraw(p: Parameters<typeof Redraw>[0]) {
  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={p.onClose}>
      <Redraw {...p} />
    </Modal>
  )
}

function Redraw({
  holeNumber,
  ours,
  pin,
  survey,
  onSave,
  onClose,
}: {
  holeNumber: number
  ours: GeoPoint[]
  pin: GeoPoint | null
  /** The survey's name for the saved screen's source line, or null with none. */
  survey: string | null
  /** Resolves to an error to show, or null once saved. */
  onSave: (drawn: GeoPoint[]) => Promise<string | null>
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const [pts, setPts] = useState<GeoPoint[]>([])
  const [closed, setClosed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<GeoPoint[] | null>(null)

  const bounds = useMemo(() => {
    const lats = ours.map((p) => p.lat)
    const lngs = ours.map((p) => p.lng)
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
      paddingTop: 70,
      paddingBottom: 70,
      paddingLeft: 50,
      paddingRight: 50,
    }
  }, [ours])

  const oursShape = useMemo(
    () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: ours.map(coord) } }),
    [ours],
  )
  const yoursShape = useMemo(() => {
    const ring = closed ? [...pts, pts[0]!] : pts
    const features: GeoJSON.Feature[] = []
    if (closed) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring.map(coord)] } })
    if (ring.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring.map(coord) } })
    return { type: 'FeatureCollection' as const, features }
  }, [pts, closed])

  if (saved) return <Saved ring={saved} pin={pin} survey={survey} onDone={onClose} />

  const tap = (e: unknown) => {
    const p = pointOf(e)
    if (!p || closed) return
    haptic('press')
    setError(null)
    setPts((cur) => [...cur, p])
  }
  const n = pts.length
  const hint = closed ? 'Closed · Save when happy' : n >= 3 ? 'Tap the first point to close' : 'Tap around the edge'
  const save = async () => {
    setSaving(true)
    const err = await onSave(pts)
    setSaving(false)
    if (err) return setError(err)
    haptic('success')
    setSaved([...pts, pts[0]!])
  }

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: P.raised, zIndex: 40 }}>
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12} style={{ width: 70, paddingTop: 4 }}>
          <Text style={[TYPE.body, { fontSize: 16, color: P.forest }]}>Cancel</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[TYPE.serif, { fontSize: 22, color: P.ink }]}>Hole {holeNumber} green</Text>
          <Text style={[TYPE.body, { fontSize: 14, color: P.inkDim }]}>{hint}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Mapbox.MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Satellite} scaleBarEnabled={false} pitchEnabled={false} rotateEnabled={false} onPress={tap}>
          <Mapbox.Camera defaultSettings={{ bounds, pitch: 0 }} maxZoomLevel={20} />
          <Mapbox.ShapeSource id="redraw-ours" shape={oursShape}>
            <Mapbox.LineLayer id="redraw-ours-line" style={{ lineColor: OURS, lineWidth: 2, lineOpacity: 0.85, lineDasharray: [2, 2] }} />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource id="redraw-yours" shape={yoursShape}>
            <Mapbox.FillLayer id="redraw-yours-fill" filter={['==', ['geometry-type'], 'Polygon']} style={{ fillColor: YOURS, fillOpacity: 0.18 }} />
            <Mapbox.LineLayer id="redraw-yours-line" filter={['==', ['geometry-type'], 'LineString']} style={{ lineColor: YOURS, lineWidth: 3, lineJoin: 'round' }} />
          </Mapbox.ShapeSource>
          {pts.map((p, i) => {
            const big = i === 0 && n >= 3 && !closed
            return (
              <Mapbox.PointAnnotation
                // The annotation is a snapshot: a size change needs a remount.
                key={`p${i}-${big ? 'b' : 's'}`}
                id={`redraw-p${i}`}
                coordinate={coord(p)}
                draggable
                onDragStart={() => haptic('grab')}
                onDragEnd={(e: unknown) => {
                  const q = pointOf(e)
                  if (q) setPts((cur) => cur.map((x, j) => (j === i ? q : x)))
                }}
                onSelected={() => {
                  if (!big) return
                  haptic('confirm')
                  setClosed(true)
                }}
              >
                <View style={{ width: big ? 24 : 16, height: big ? 24 : 16, borderRadius: 12, backgroundColor: i === 0 ? FIRST : YOURS, borderWidth: 2, borderColor: P.ink }} />
              </Mapbox.PointAnnotation>
            )
          })}
        </Mapbox.MapView>
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(28,33,28,.78)', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', gap: 10 }}>
          <Text style={[TYPE.body, { fontSize: 13, color: OURS }]}>┅ ours</Text>
          <Text style={[TYPE.body, { fontSize: 13, color: YOURS }]}>━ yours</Text>
        </View>
      </View>
      <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 10 }}>
        {error ? (
          <Text style={[TYPE.body, { fontSize: 14, color: P.neg, textAlign: 'center' }]}>{error}</Text>
        ) : (
          <Text style={[TYPE.body, { fontSize: 14, color: P.inkDim, textAlign: 'center' }]}>Drag to move · pinch to zoom · drag a point to fix it</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Secondary
            label="Undo"
            disabled={n === 0 || saving}
            onPress={() => (closed ? setClosed(false) : setPts((cur) => cur.slice(0, -1)))}
          />
          <Secondary
            label="Start over"
            disabled={n === 0 || saving}
            onPress={() => {
              setPts([])
              setClosed(false)
            }}
          />
          <Primary label={saving ? 'Saving…' : n < MIN_POINTS ? `Save (${MIN_POINTS - n} more)` : 'Save'} disabled={n < MIN_POINTS || saving} onPress={() => void save()} />
        </View>
      </View>
    </View>
  )
}

/** "Yours now": the saved shape, north up, with the pin. */
function Saved({ ring, pin, survey, onDone }: { ring: GeoPoint[]; pin: GeoPoint | null; survey: string | null; onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const S = 300
  const kx = Math.cos((ring[0]!.lat * Math.PI) / 180)
  const xs = ring.map((p) => p.lng * kx)
  const ys = ring.map((p) => -p.lat)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const s = (0.85 * S) / Math.max(x1 - x0, y1 - y0, 1e-9)
  const at = (p: GeoPoint) => [S / 2 + (p.lng * kx - (x0 + x1) / 2) * s, S / 2 + (-p.lat - (y0 + y1) / 2) * s] as const
  const flag = pin ? at(pin) : null
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: P.raised, zIndex: 40, paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: insets.bottom + 16, gap: 12 }}>
      <Text style={[TYPE.serif, { fontSize: 26, color: P.ink }]}>Green · your outline</Text>
      <Svg width={S} height={S} style={{ alignSelf: 'center' }}>
        <Polygon points={ring.map((p) => at(p).join(',')).join(' ')} fill="#E3E8D6" stroke={P.ink} strokeWidth={2} />
        {flag && flag[0] > 0 && flag[0] < S && flag[1] > 34 && flag[1] < S && (
          <>
            <Line x1={flag[0]} y1={flag[1]} x2={flag[0]} y2={flag[1] - 34} stroke={P.ink} strokeWidth={2} />
            <Rect x={flag[0]} y={flag[1] - 34} width={20} height={14} fill="#B5321F" />
            <Circle cx={flag[0]} cy={flag[1]} r={3} fill={P.ink} />
          </>
        )}
      </Svg>
      <Text style={[TYPE.body, { fontSize: 17, color: P.ink }]}>Yours now. The slope map follows your outline straight away.</Text>
      <Text style={[TYPE.body, { fontSize: 13, color: P.inkDim }]}>{survey ? `${survey} · your outline` : 'Your outline'}</Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row' }}>
        <Primary label="Done" onPress={onDone} />
      </View>
    </View>
  )
}

// ---------- "After the round" (#1504 click path) ----------
// A green the player chose to fix later is a card on that round's page until
// it's done. On this phone only: a reminder, not data anyone else reads.
export type FixLater = { roundId: string; holeId: string; holeNumber: number }
const LATER_KEY = (userId: string) => `oga.green-fix-later.${userId}`

async function readFixLater(userId: string): Promise<FixLater[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(LATER_KEY(userId))) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function changeFixLater(userId: string, f: (l: FixLater[]) => FixLater[]) {
  const next = f(await readFixLater(userId))
  await AsyncStorage.setItem(LATER_KEY(userId), JSON.stringify(next)).catch(() => undefined)
}

const other = (roundId: string, holeId: string) => (x: FixLater) => !(x.roundId === roundId && x.holeId === holeId)
export const addFixLater = (userId: string, f: FixLater) => changeFixLater(userId, (l) => [...l.filter(other(f.roundId, f.holeId)), f])
export const dropFixLater = (userId: string, roundId: string, holeId: string) => changeFixLater(userId, (l) => l.filter(other(roundId, holeId)))

export const surveyName = (gridSource: string | null) => (gridSource ? (gridSource.startsWith('3dep') ? 'USGS 3DEP lidar' : 'Lidar') : null)

/** The round page's card for greens saved for after the round. */
export function GreenFixCard({ userId, roundId }: { userId: string; roundId: string }) {
  const [items, setItems] = useState<FixLater[]>([])
  const [notNow, setNotNow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<{ item: FixLater; ours: GeoPoint[]; survey: string | null } | null>(null)

  const reload = () => readFixLater(userId).then((l) => setItems(l.filter((x) => x.roundId === roundId)))
  useEffect(() => {
    void reload()
  }, [userId, roundId])

  const first = items[0]
  const start = async (item: FixLater) => {
    setError(null)
    const { data } = await getGreenOutlines(supabase, [item.holeId])
    const row = data?.[0]
    let ours: GeoPoint[] = []
    try {
      ours = row ? decodePolyline(row.outline) : []
    } catch {
      /* shown as below */
    }
    if (!row || ours.length < 4) return setError('Opening the green needs signal.')
    setOpen({ item, ours, survey: surveyName(row.grid_source) })
  }
  // The list updates once the redraw closes, so its "Yours now" screen stays up.
  const close = () => {
    setOpen(null)
    void reload()
  }

  return (
    <>
      {first && !notNow && (
        <View style={{ borderWidth: 1.5, borderColor: P.ink, borderRadius: 6, padding: 16, gap: 10, backgroundColor: P.raised, marginBottom: 16 }}>
          <Text style={[TYPE.serif, { fontSize: 21, color: P.ink }]}>
            {items.length} green{items.length > 1 ? 's' : ''} to fix
          </Text>
          <Text style={[TYPE.body, { fontSize: 15, color: P.inkDim }]}>Hole {first.holeNumber} · you said it looked off. About 30 seconds.</Text>
          {error && <Text style={[TYPE.body, { fontSize: 14, color: P.neg }]}>{error}</Text>}
          <View style={{ flexDirection: 'row' }}>
            <Primary label={`Redraw hole ${first.holeNumber}'s green`} onPress={() => void start(first)} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => setNotNow(true)} hitSlop={8}>
            <Text style={[TYPE.body, { fontSize: 14, color: P.inkDim, textAlign: 'center' }]}>Not now (it stays here)</Text>
          </Pressable>
        </View>
      )}
      {open && (
          <GreenRedraw
            holeNumber={open.item.holeNumber}
            ours={open.ours}
            pin={null}
            survey={open.survey}
            onSave={async (drawn) => {
              const r = await saveDrawnOutline(open.item.holeId, drawn)
              if ('error' in r) return r.error
              await dropFixLater(userId, roundId, open.item.holeId)
              return null
            }}
            onClose={close}
          />
      )}
    </>
  )
}
