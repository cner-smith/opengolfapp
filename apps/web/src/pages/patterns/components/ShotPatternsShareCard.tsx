import { clubNoun, ringExtent, type Club, type DispersionPoint, type DispersionStats } from '@oga/core'
import { AMBER, PencilRing, screenRing } from './chartParts'

// Off-screen 1200×630 social share card (Twitter/Facebook OG size), laid out
// like a yardage-book page: the pattern in pencil on the left with its key,
// the page's finding on the right. Inline styles so the rasteriser needs no
// stylesheet. Stats only: no username, email or avatar ever reaches this card.
const CARD_W = 1200
const CARD_H = 630

const C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  line: '#D9D2BF',
  cross: '#9F9580',
  ink: '#1C211C',
  inkDim: '#5C6356',
  inkMute: '#8A8B7E',
  accent: '#1F3D2C',
} as const

const SERIF = '"Fraunces", Georgia, serif'
const SANS = 'Epilogue, system-ui, sans-serif'
const HAND = 'Kalam, cursive'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The plot panel, and the aim inside it.
const PX = 40
const PY = 40
const PW = 520
const PH = 550
const AX = PX + PW / 2
const AY = 300

interface ShotPatternsShareCardProps {
  points: DispersionPoint[]
  stats: DispersionStats
  club: Club
  /** The page's finding sentence, so the card says what the page says. */
  finding: string
  /** The recorded shape's verdict ("Mostly draws", "Mixed", "—"). */
  shape: string
  toDisplay: (yards: number, decimals?: number) => string
}

export function ShotPatternsShareCard({ points, stats, club, finding, shape, toDisplay }: ShotPatternsShareCardProps) {
  const pair = (a: number, b: number) => `${toDisplay(a).replace(/ (yd|m)$/, '')} × ${toDisplay(b)}`
  return (
    <div style={{ position: 'relative', width: CARD_W, height: CARD_H, backgroundColor: C.bg, color: C.ink, fontFamily: SANS }}>
      {/* The rasteriser embeds only the fonts its HTML elements name (it does
          not look inside the svg), so this wrapper names Kalam for the plot's
          handwritten labels. */}
      <div style={{ fontFamily: HAND }}>
        <Plot points={points} stats={stats} />
      </div>
      <div style={{ position: 'absolute', left: 620, top: 40, width: 520, bottom: 40, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 18, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 44, lineHeight: 1 }}>
            oga<span style={{ fontStyle: 'normal', color: C.accent }}>.</span>
          </div>
          <div style={{ fontSize: 20, color: C.inkDim }}>Shot pattern</div>
        </div>
        <div style={{ fontSize: 21, color: C.inkDim, marginTop: 26 }}>
          {cap(clubNoun(club))} · {stats.sampleSize} shots, measured from the aim
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 34, lineHeight: 1.22, marginTop: 14 }}>{finding}</div>
        <div style={{ display: 'flex', gap: 56, marginTop: 'auto' }}>
          <Stat label="Two in three" value={pair(stats.cone68.lateral * 2, stats.cone68.distance * 2)} />
          <Stat label="Shape" value={shape} />
        </div>
        <Legend />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 20, color: C.accent }}>oga.golf</div>
          <div style={{ fontSize: 17, color: C.inkMute }}>Free, open source golf tracking</div>
        </div>
      </div>
    </div>
  )
}

// Every shot and the 68% ring at one scale, on crosses every 10 yd (20 when
// the pattern is wide), with the aim at the cross of two faint pencil axes.
function Plot({ points, stats }: { points: DispersionPoint[]; stats: DispersionStats }) {
  const e = ringExtent(stats.ring68)
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    Math.abs(stats.ring68.cx) + e.x,
    Math.abs(stats.ring68.cy) + e.y,
    10,
  )
  const scale = 215 / (reach * 1.08)
  const px = (l: number) => AX + l * scale
  const py = (d: number) => AY - d * scale
  const step = 10 * scale >= 40 ? 10 : 20
  const crosses: [number, number][] = []
  for (let gx = -Math.floor((AX - PX - 20) / scale / step); px(gx * step) < PX + PW - 20; gx++) {
    for (let gy = -Math.floor((PY + PH - 20 - AY) / scale / step); py(gy * step) > PY + 20; gy++) {
      if (gx !== 0 && gy !== 0) crosses.push([px(gx * step), py(gy * step)])
    }
  }
  const ring = screenRing(stats.ring68, px, py, scale)
  const avg = { x: px(stats.avgLateralOffset), y: py(stats.avgDistanceOffset) }
  const label = { x: Math.min(ring.cx + e.x * scale * 0.72 + 8, PX + PW - 150), y: Math.min(ring.cy + e.y * scale * 0.78 + 14, PY + PH - 40) }
  const handLabel = { fontFamily: HAND, fontSize: 26, fill: C.inkDim }
  return (
    <svg width={CARD_W} height={CARD_H} style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect x={PX} y={PY} width={PW} height={PH} fill={C.surface} stroke={C.line} />
      <g stroke={C.cross} strokeOpacity={0.6} strokeWidth={1.4}>
        {crosses.map(([x, y]) => (
          <path key={`${x},${y}`} d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} />
        ))}
      </g>
      <g stroke={C.ink} strokeOpacity={0.25} strokeWidth={1.6} strokeLinecap="round">
        <line x1={AX} y1={PY + 30} x2={AX} y2={PY + PH - 20} />
        <line x1={PX + 30} y1={AY} x2={PX + PW - 30} y2={AY} />
      </g>
      <text x={AX + 10} y={PY + 52} {...handLabel}>long</text>
      <text x={AX + 10} y={PY + PH - 18} {...handLabel}>short</text>
      <text x={PX + 24} y={AY - 10} {...handLabel}>left</text>
      <text x={PX + PW - 24} y={AY - 10} textAnchor="end" {...handLabel}>right</text>

      <PencilRing r={ring} still k={1.1} />
      {points.map((p) => (
        <circle key={p.id} cx={px(p.lateralOffsetYards)} cy={py(p.distanceOffsetYards)} r={5.5} fill={C.ink} fillOpacity={0.65} />
      ))}
      <line x1={AX} y1={AY} x2={avg.x} y2={avg.y} stroke={AMBER} strokeWidth={2.4} />
      <Flag x={AX} y={AY} h={26} />
      <circle cx={avg.x} cy={avg.y} r={8.5} fill={C.surface} stroke={C.ink} strokeWidth={3} />
      <text x={label.x} y={label.y} fontFamily={HAND} fontSize={24} fill={C.inkDim}>two in three</text>
    </svg>
  )
}

function Flag({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - h} stroke={AMBER} strokeWidth={2.4} />
      <path d={`M${x} ${y - h}l${h * 0.6} ${h * 0.23}l${-h * 0.6} ${h * 0.23}Z`} fill={AMBER} />
    </g>
  )
}

// The key (#468), so the card reads on its own in a feed.
function Legend() {
  const item = { fontSize: 17, color: C.inkDim, display: 'flex', alignItems: 'center', gap: 8 } as const
  return (
    <div style={{ display: 'flex', gap: 26, margin: '34px 0 22px' }}>
      <span style={item}>
        <svg width={12} height={12}><circle cx={6} cy={6} r={5} fill={C.ink} fillOpacity={0.65} /></svg>a shot
      </span>
      <span style={item}>
        <svg width={18} height={18}><circle cx={9} cy={9} r={7} fill={C.surface} stroke={C.ink} strokeWidth={2.4} /></svg>average
      </span>
      <span style={item}>
        <svg width={16} height={22}><Flag x={2} y={21} h={19} /></svg>aim
      </span>
      <span style={item}>
        <svg width={38} height={24}><PencilRing r={{ cx: 19, cy: 12, rx: 16, ry: 9, rot: 0 }} still k={1.2} /></svg>two in three
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 19, color: C.inkDim, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 36, lineHeight: 1.1, color: C.ink }}>{value}</div>
    </div>
  )
}
