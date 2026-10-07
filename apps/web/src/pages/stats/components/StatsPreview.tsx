import { Link } from 'react-router-dom'

// #1076: Stats before the player has a whole round (none at all, or only
// partial ones, #1078). The page's sections on a sample 14-handicap.

const SG = [
  { label: 'Off the tee', value: 0.42 },
  { label: 'Approach', value: -1.61 },
  { label: 'Around the green', value: 0.28 },
  { label: 'Putting', value: 0.53 },
] as const
const SG_MAX = 2 // half-track, strokes
const BANDS = [
  { label: '100–125 yd', value: -0.21 },
  { label: '125–150 yd', value: -0.68 },
  { label: '150–175 yd', value: -0.57 },
  { label: '175+ yd', value: -0.15 },
] as const
const BAND_MAX = 0.8

const QA = [
  ['Where do I lose strokes?', 'Tee, approach, short game, putting'],
  ['Compared with whom?', 'Golfers at your handicap, not tour pros'],
  ['What do I practise?', 'Your plan starts with the biggest leak'],
] as const

const fmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`
const tone = (v: number) => (v < 0 ? '#A33A2A' : '#1F3D2C')

export function StatsPreview() {
  return (
    <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,1.4fr)_minmax(0,1fr)]" style={{ gap: 32, alignItems: 'start' }}>
      <div
        style={{
          position: 'relative',
          border: '1px solid #1C211C',
          borderRadius: 3,
          boxShadow: '2px 2px 0 #1C211C',
          background: '#FBF8F1',
          padding: '24px 26px 20px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: 16,
            top: -12,
            border: '1px solid #7A5F24',
            background: '#F3E6C2',
            color: '#7A5F24',
            fontFamily: '"Inconsolata", monospace',
            fontSize: 11,
            letterSpacing: '0.16em',
            padding: '2px 8px',
            transform: 'rotate(-2deg)',
          }}
        >
          EXAMPLE
        </span>
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 19, lineHeight: '27px', maxWidth: 520, borderLeft: '2px solid #1C211C', paddingLeft: 14, marginBottom: 18 }}
        >
          <b style={{ fontStyle: 'italic', fontWeight: 500 }}>Approach.</b> Your biggest leak, about 1.6 strokes a round.
          Putting is the bright spot at +0.53.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,140px) minmax(0,1fr) 64px', columnGap: 8, rowGap: 20, alignItems: 'center', fontSize: 15 }}>
          {SG.map((s) => (
            <SGRow key={s.label} label={s.label} value={s.value} />
          ))}
          <span />
          <span className="text-center" style={{ fontFamily: 'Kalam, cursive', fontSize: 14, color: '#353430', marginTop: -12, whiteSpace: 'nowrap' }}>
            ↑ a typical 14-handicap
          </span>
          <span />
        </div>
        <div className="kicker" style={{ margin: '26px 0 12px' }}>Where the approach strokes go</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,110px) minmax(0,300px) 56px', columnGap: 10, rowGap: 10, alignItems: 'center', fontSize: 14 }}>
          {BANDS.map((b) => (
            <BandRow key={b.label} label={b.label} value={b.value} />
          ))}
        </div>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, paddingTop: 16 }}>
          Sample: a 14-handicap, last 10 rounds. The four bands add up to the −1.61 approach figure.
        </div>
      </div>
      <div>
        <h2 className="font-serif text-caddie-ink" style={{ fontSize: 26, lineHeight: '32px', fontStyle: 'italic', fontWeight: 500, marginBottom: 14 }}>
          Where does a round get away from you?
        </h2>
        <dl style={{ borderTop: '1px solid #D9D2BF' }}>
          {QA.map(([q, a]) => (
            <div key={q} style={{ padding: '7px 0', borderBottom: '1px solid #D9D2BF' }}>
              <dt className="text-caddie-ink-dim" style={{ fontSize: 13 }}>{q}</dt>
              <dd className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500 }}>{a}</dd>
            </div>
          ))}
        </dl>
        <Link
          to="/rounds/new?mode=past"
          className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 flex items-center justify-center"
          style={{ marginTop: 18, padding: '15px 16px', borderRadius: 2, fontSize: 16, fontWeight: 700, letterSpacing: '0.02em' }}
        >
          Log a round →
        </Link>
        <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 12 }}>
          Live in the app on the course, or a round you’ve already played, here.
        </p>
      </div>
    </div>
  )
}

function SGRow({ label, value }: { label: string; value: number }) {
  const pct = (Math.min(Math.abs(value), SG_MAX) / SG_MAX) * 50
  return (
    <>
      <span className="text-caddie-ink" style={{ fontWeight: value < 0 ? 700 : 400 }}>{label}</span>
      <span style={{ position: 'relative', height: 18 }}>
        <i style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 1, background: '#D9D2BF' }} />
        <i style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#9F9580' }} />
        <i style={{ position: 'absolute', top: 2, bottom: 2, left: value < 0 ? `${50 - pct}%` : '50%', width: `${pct}%`, background: tone(value) }} />
      </span>
      <b className="font-serif text-right" style={{ fontStyle: 'italic', fontWeight: 500, color: tone(value) }}>{fmt(value)}</b>
    </>
  )
}

function BandRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <span className="text-caddie-ink">{label}</span>
      <span style={{ position: 'relative', height: 10, background: '#EBE5D6' }}>
        <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(Math.abs(value) / BAND_MAX) * 100}%`, background: '#A33A2A' }} />
      </span>
      <b className="font-serif text-right" style={{ fontStyle: 'italic', fontWeight: 500, color: '#A33A2A' }}>{fmt(value)}</b>
    </>
  )
}
