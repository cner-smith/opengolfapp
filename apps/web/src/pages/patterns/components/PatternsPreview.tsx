import { Link } from 'react-router-dom'
import { MIN_SAMPLES_FOR_STATS as MIN_SHOTS, clubNoun, type Club } from '@oga/core'

// #1076: Shot Patterns before the player has a pattern. Empty = no aimed shot
// at all (a marked-up example 7-iron); Progress = this club is under the
// 5-shot rule. Both lead into the same "How your pattern is built".

const HAND = 'Kalam, cursive'
const SANS = 'Epilogue, sans-serif'
const APP_STORE_URL = 'https://apps.apple.com/us/app/oga-open-golf-app/id6785314918'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.opengolf.oga'
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five']

const tile: React.CSSProperties = {
  border: '1px solid #1C211C',
  borderRadius: 3,
  boxShadow: '2px 2px 0 #1C211C',
  background: '#FBF8F1',
  overflow: 'hidden',
}

function ExampleStamp({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <span
      className={className}
      style={{
        position: 'absolute',
        border: '1px solid #7A5F24',
        background: '#F3E6C2',
        color: '#7A5F24',
        fontFamily: '"Inconsolata", monospace',
        fontSize: 11,
        letterSpacing: '0.16em',
        padding: '2px 8px',
        transform: 'rotate(-2deg)',
        ...style,
      }}
    >
      EXAMPLE
    </span>
  )
}

// A 14-handicap's 7-iron, 24 shots at a 150 yd flag (geometry from the v2 mock).
function SampleChart() {
  return (
    <svg viewBox="0 0 612 470" width="100%" style={{ display: 'block', height: 'auto' }}>
    <rect x="0" y="0" width="612" height="470" fill="#F2EEE5"/>
    <line x1="419.33" y1="0" x2="419.33" y2="470" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="0" y1="101.66" x2="612" y2="101.66" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="192.66" y1="0" x2="192.66" y2="470" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="0" y1="328.33" x2="612" y2="328.33" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="532.66" y1="0" x2="532.66" y2="470" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="79.33" y1="0" x2="79.33" y2="470" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="0" y1="441.66" x2="612" y2="441.66" stroke="#EBE5D6" strokeWidth="1"/>
    <line x1="306" y1="0" x2="306" y2="470" stroke="#9F9580" strokeWidth="1" strokeOpacity=".55"/>
    <line x1="0" y1="215" x2="612" y2="215" stroke="#9F9580" strokeWidth="1" strokeOpacity=".55"/>
    <text x="5" y="210" fontFamily={SANS} fontSize="10" fill="#8A8B7E">left</text>
    <text x="607" y="210" fontFamily={SANS} fontSize="10" fill="#8A8B7E" textAnchor="end">right</text>
    <ellipse cx="374" cy="260.33" rx="153.97" ry="128.31" fill="rgba(31,61,44,.10)" stroke="#1F3D2C" strokeWidth="1.5"/>
    <circle cx="283.3" cy="320.4" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="318.5" cy="280.7" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="512.3" cy="212.7" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="429.5" cy="157.2" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="478.3" cy="148.1" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="315.1" cy="276.2" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="182.5" cy="382.7" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="270.9" cy="193.5" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="395.5" cy="315.9" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="413.7" cy="306.8" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="530.4" cy="177.6" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="328.7" cy="443.9" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="474.9" cy="210.5" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="206.3" cy="250.1" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="505.5" cy="137.9" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="430.7" cy="99.4" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="436.3" cy="372.5" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="196.1" cy="315.9" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="415.9" cy="287.5" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="423.9" cy="319.3" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="491.9" cy="195.7" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="333.2" cy="204.8" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="276.5" cy="302.3" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <circle cx="325.3" cy="337.4" r="5.7" fill="#1C211C" fillOpacity=".42"/>
    <line x1="306" y1="215" x2="374" y2="260.33" stroke="#353430" strokeWidth="1.3" strokeDasharray="4 3"/>
    <circle cx="374" cy="260.33" r="2.6" fill="#1F3D2C"/>
    <circle cx="306" cy="215" r="5.5" fill="#A66A1F" stroke="#FBF8F1" strokeWidth="2"/>
    <circle cx="238" cy="215" r="6.5" fill="none" stroke="#353430" strokeWidth="1.2" strokeDasharray="2.5 2.5"/>
    <text x="10.0" y="69.2" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">you aimed here</text>
    <path d="M85.6 75.2 Q219.2 93.8 295.8 204.8" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M295.2 197.8 L295.8 204.8 L289.5 201.8" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="10.0" y="439.3" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">aim here instead</text>
    <text x="10.0" y="460.0" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">— 6 yd left</text>
    <path d="M92.8 420.6 Q201.3 353.3 233.5 229.7" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M228.5 234.7 L233.5 229.7 L235.3 236.5" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="602.0" y="26.0" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">two shots in three</text>
    <text x="602.0" y="46.7" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">land in this ring</text>
    <path d="M573.2 52.7 Q559.6 130.3 489.4 166.0" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M496.4 166.3 L489.4 166.0 L493.2 160.1" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="602.0" y="460.0" fontFamily={HAND} fontSize="18" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">on average 6 right, 4 short</text>
    <path d="M503.0 440.0 Q472.4 333.3 380.8 270.5" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M383.8 276.9 L380.8 270.5 L387.8 271.1" fill="none" stroke="#353430" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Start → aim → finish, measured along the line you meant.
function BuiltDiagram() {
  return (
    <svg viewBox="0 0 420 240" width="100%" style={{ display: 'block', height: 'auto' }}>
    <rect width="420" height="240" fill="#F2EEE5"/>
    <line x1="235.20" y1="218" x2="198.30" y2="58.20" stroke="#A66A1F" strokeWidth="1.6" strokeDasharray="5 4"/>
    <line x1="198.30" y1="58.20" x2="192.90" y2="34.81" stroke="#A66A1F" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="2 4"/>
    <path d="M235.20 218 Q272.88 148.59 258.57 79.18" fill="none" stroke="#1C211C" strokeOpacity=".35" strokeWidth="1.2"/>
    <line x1="205.95" y1="91.33" x2="258.57" y2="79.18" stroke="#353430" strokeWidth="1.2"/>
    <line x1="206.85" y1="95.22" x2="205.05" y2="87.43" stroke="#353430" strokeWidth="1.2"/>
    <line x1="259.47" y1="83.08" x2="257.67" y2="75.28" stroke="#353430" strokeWidth="1.2"/>
    <line x1="184.66" y1="61.35" x2="192.31" y2="94.48" stroke="#353430" strokeWidth="1.2"/>
    <line x1="189.53" y1="60.22" x2="179.79" y2="62.47" stroke="#353430" strokeWidth="1.2"/>
    <line x1="197.18" y1="93.35" x2="187.44" y2="95.60" stroke="#353430" strokeWidth="1.2"/>
    <circle cx="205.95" cy="91.33" r="1.8" fill="#353430"/>
    <circle cx="235.20" cy="218" r="5" fill="#FBF8F1" stroke="#1C211C" strokeWidth="1.6"/>
    <circle cx="198.30" cy="58.20" r="11" fill="none" stroke="#A66A1F" strokeWidth="1" strokeOpacity=".6"/>
    <circle cx="198.30" cy="58.20" r="5.5" fill="#A66A1F" stroke="#FBF8F1" strokeWidth="2"/>
    <circle cx="258.57" cy="79.18" r="5" fill="#1C211C"/>
    <text x="247.2" y="222.0" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">you hit from here</text>
    <text x="184.3" y="32.2" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">your aim: a spot,</text>
    <text x="184.3" y="47.2" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">at a distance</text>
    <text x="268.6" y="61.2" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">it finished here</text>
    <text x="268.6" y="76.2" fontFamily={HAND} fontSize="13.5" fill="#5C6356" textAnchor="start" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">(your next shot)</text>
    <text x="234.3" y="103.3" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="middle" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">6 right</text>
    <text x="180.7" y="84.7" fontFamily={HAND} fontSize="15" fill="#353430" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">4 short</text>
    <text x="223.4" y="168.1" fontFamily={HAND} fontSize="14" fill="#5C6356" textAnchor="end" stroke="#FBF8F1" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">the line you meant</text>
    </svg>
  )
}

const ANSWERS = [
  ['Where do my misses go?', 'Right, and a touch short'],
  ['How far does it really go?', '146 yd is a typical 7-iron'],
  ['Where should I aim?', '6 yd left of your target'],
  ['And if I aim there?', '15 of 24 on the green, not 9'],
] as const

export function PatternsEmpty() {
  return (
    <div>
      <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,1.25fr)_minmax(0,1fr)]" style={{ gap: 32, alignItems: 'start' }}>
        <div style={{ ...tile, position: 'relative' }}>
          <SampleChart />
          {/* Over the chart's corner only when wide: scaled down, the chart's
              "you aimed here" note runs under it, so narrow puts it in the caption. */}
          <ExampleStamp className="hidden lg:block" style={{ left: 14, top: 14 }} />
          <div className="text-caddie-ink-dim" style={{ position: 'relative', fontSize: 13, padding: '10px 14px', borderTop: '1px solid #D9D2BF' }}>
            A 14-handicap’s 7-iron · 24 shots aimed at a 150 yd flag · the dashed line runs from the aim to the average finish
            <ExampleStamp className="lg:hidden" style={{ position: 'static', display: 'inline-block', marginLeft: 8 }} />
          </div>
        </div>
        <div>
          <h2 className="font-serif text-caddie-ink" style={{ fontSize: 26, lineHeight: '32px', fontStyle: 'italic', fontWeight: 500, marginBottom: 14 }}>
            Your misses have a shape.
          </h2>
          <dl style={{ borderTop: '1px solid #D9D2BF' }}>
            {ANSWERS.map(([q, a]) => (
              <div key={q} style={{ padding: '7px 0', borderBottom: '1px solid #D9D2BF' }}>
                <dt className="text-caddie-ink-dim" style={{ fontSize: 13 }}>{q}</dt>
                <dd className="font-serif text-caddie-ink" style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 500 }}>{a}</dd>
              </div>
            ))}
          </dl>
          <Link
            to="/rounds/new?mode=live"
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 flex items-center justify-center"
            style={{ marginTop: 18, padding: '15px 16px', borderRadius: 2, fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', gap: 8 }}
          >
            Track shot patterns on your next round →
          </Link>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 12 }}>
            Aim on the course in the OGA app for <a href={APP_STORE_URL} className="underline">iPhone</a> or{' '}
            <a href={PLAY_STORE_URL} className="underline">Android</a>, or place aims on a past round{' '}
            <Link to="/rounds" className="underline">here</Link>.
          </p>
          <a href="#how-pattern-built" className="font-semibold text-caddie-accent underline" style={{ display: 'inline-block', marginTop: 10, fontSize: 14 }}>
            How your pattern is built ↓
          </a>
        </div>
      </div>
      <PatternExplainer />
    </div>
  )
}

export function PatternExplainer() {
  return (
    <section id="how-pattern-built" style={{ borderTop: '1px solid #D9D2BF', paddingTop: 14, marginTop: 36, scrollMarginTop: 24 }}>
      <div className="kicker" style={{ marginBottom: 6 }}>How it works</div>
      <h2 className="font-serif text-caddie-ink" style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, marginBottom: 16 }}>
        How your pattern is built
      </h2>
      <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,420px)_minmax(0,1fr)]" style={{ gap: 32, alignItems: 'start' }}>
        <div style={tile}>
          <BuiltDiagram />
        </div>
        <div className="text-caddie-ink" style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 560 }}>
          <p style={{ marginBottom: 10 }}>
            <b>Aim at a spot, not just a line.</b> Put the aim where you want the ball to finish: the middle of the
            green, or the 150 marker on the right side of the fairway.
          </p>
          <p style={{ marginBottom: 10 }}>
            Playing a fade or a draw? Still aim where you want it to finish. Your pattern then shows how often the shape
            comes off: a fade that doesn’t turn shows up as a miss left.
          </p>
          <p style={{ marginBottom: 10 }}>
            For every shot OGA has three points: where you hit from, where you aimed, and where the ball finished. It
            measures the finish against your aim, along the line you meant to hit: how far left or right, and how far
            long or short.
          </p>
          <p style={{ marginBottom: 10 }}>
            After five or more shots with one club, that becomes your estimated pattern: the ring where about two shots
            in three finish, and your average miss.
          </p>
          <p style={{ marginBottom: 10 }}>
            It’s where the ball came to rest on the course, with roll, wind and lies included. A simulator or launch
            monitor measures carry and flight in the air, and OGA doesn’t, so your typical distance is total distance
            on real turf.
          </p>
          <p className="text-caddie-ink-dim" style={{ fontStyle: 'italic', fontSize: 14 }}>
            Bringing in launch-monitor data is something we’re looking at.
          </p>
        </div>
      </div>
    </section>
  )
}

// Under 5 aimed shots for this club: "N of 5", pips and what it unlocks, in
// place of the "need five shots" line.
export function PatternProgress({ club, shots }: { club: Club; shots: number }) {
  const n = Math.min(shots, MIN_SHOTS - 1)
  const left = MIN_SHOTS - n
  const noun = clubNoun(club)
  return (
    <div style={{ maxWidth: 480 }}>
      <div className="flex items-center" style={{ gap: 14, marginBottom: 10 }}>
        <span className="font-serif text-caddie-ink" style={{ fontSize: 17 }}>
          <span style={{ fontSize: 30, fontStyle: 'italic', fontWeight: 500 }}>{n}</span> of {MIN_SHOTS} shots
        </span>
        <span className="flex" style={{ gap: 5 }} aria-hidden>
          {Array.from({ length: MIN_SHOTS }, (_, i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', border: '1px solid #1C211C', background: i < n ? '#1C211C' : 'transparent' }} />
          ))}
        </span>
      </div>
      <p className="text-caddie-ink" style={{ fontSize: 15, lineHeight: 1.55 }}>
        {NUMBER_WORDS[left]} more aimed {left === 1 ? noun : `${noun}s`} and you get your own ring, your miss and your
        typical distance.{' '}
        <a href="#how-pattern-built" className="font-semibold text-caddie-accent underline">How a pattern is built ↓</a>
      </p>
    </div>
  )
}
