import {
  Body,
  Bullet,
  Lede,
  Subkicker,
} from '../components/ArticlePrimitives'

export function StrokesGainedArticle() {
  return (
    <article
      id="strokes-gained"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Understanding the game · Strokes gained
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          marginBottom: 18,
        }}
      >
        Strokes gained, in plain English.
      </h2>

      <Lede>
        <em>Strokes gained</em> measures every shot against an
        expectation. Hit a shot from the same lie and distance as a pro
        might, beat the expected outcome, and you gained strokes; come
        up short, you lost some. Sum the deltas across a round and you
        get a precise read on where your strokes are actually coming
        from — or going.
      </Lede>
      <Body>
        Score alone tells you the result. Strokes gained tells you{' '}
        <em>why</em>. A 78 might be built on a great short game bailing
        out wayward irons, or it might be the iron play carrying a
        leaky putter. The overall score is identical; the work to fix
        it is not.
      </Body>

      <Subkicker>The four categories</Subkicker>
      <Body>Every shot fits in exactly one bucket:</Body>
      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0' }}>
        <Bullet term="Off the tee">
          Tee shots on par 4s and par 5s. Your driver swing,
          essentially.
        </Bullet>
        <Bullet term="Approach">
          Shots from outside 30 yards that aren't tee shots — the bulk
          of your iron and hybrid play.
        </Bullet>
        <Bullet term="Around the green">
          Shots from within 30 yards that are not on the green — chips,
          pitches, bunker shots.
        </Bullet>
        <Bullet term="Putting">
          Every shot taken from the green.
        </Bullet>
      </ul>

      <WorkedExample />

      <Subkicker>Reading the sign</Subkicker>
      <Body>
        Positive numbers mean you played better than the bracket
        baseline at your handicap. Negative means you lost strokes to
        that baseline. <em>+0.3 SG-Putting</em> means your putting gave
        you about a third of a stroke per round vs a typical player at
        your level. <em>−1.4 SG-Approach</em> means your irons are
        leaking 1.4 strokes a round.
      </Body>
      <Body>
        The forest in this app is always positive territory. The brick
        is where strokes leak. If a category sits at zero you are the
        average for your bracket — fine, not a leak.
      </Body>

      <Subkicker>What counts where</Subkicker>
      <SGCategoriesTable />
    </article>
  )
}

function WorkedExample() {
  return (
    <div
      style={{
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
        borderRadius: 4,
        padding: 22,
        marginTop: 18,
      }}
    >
      <div className="kicker" style={{ marginBottom: 12 }}>
        A worked example
      </div>
      <p
        className="font-serif text-caddie-ink"
        style={{ fontSize: 17, lineHeight: 1.55, marginBottom: 14 }}
      >
        You hit a 7-iron from <em>155 yards</em> in the fairway and end
        up <em>22 feet</em> from the hole on the green.
      </p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3"
        style={{ gap: 14, marginBottom: 14 }}
      >
        <ExampleRow
          label="Expected from 155 yd"
          value="2.86"
          note="Strokes a 10-handicap typically takes to hole out from there."
        />
        <ExampleRow
          label="Expected from 22 ft"
          value="1.97"
          note="What it usually takes to two-putt from that distance."
        />
        <ExampleRow
          label="Strokes gained"
          value="−0.11"
          note="2.86 − 1.97 − 1 (the shot you just hit)."
          tone="neg"
        />
      </div>
      <p
        className="text-caddie-ink-dim"
        style={{ fontSize: 13, lineHeight: 1.5 }}
      >
        Slightly below baseline. Hit it to <em>10 feet</em> instead and
        the number flips: 2.86 − 1.61 − 1 ={' '}
        <span className="font-serif" style={{ fontStyle: 'italic' }}>
          +0.25
        </span>{' '}
        — a quarter of a stroke gained on a single approach. Stack
        eighteen of those across a round and the difference is 4–5
        strokes.
      </p>
    </div>
  )
}

function ExampleRow({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: 'pos' | 'neg'
}) {
  const color =
    tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#1C211C'
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="font-serif tabular"
        style={{
          fontSize: 26,
          fontStyle: 'italic',
          fontWeight: 500,
          color,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      <div
        className="text-caddie-ink-dim"
        style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}
      >
        {note}
      </div>
    </div>
  )
}

function SGCategoriesTable() {
  const rows = [
    {
      cat: 'Off the tee',
      what: 'Tee shots on par 4s and par 5s.',
      example: 'Driver from the tee on a 410-yd hole.',
    },
    {
      cat: 'Approach',
      what: 'Anything outside 30 yd that isn’t a tee shot.',
      example: '155 yd 7-iron from the fairway. Tee shot on a par-3.',
    },
    {
      cat: 'Around the green',
      what: 'Inside 30 yd of the green, not on the putting surface.',
      example: 'Chip from the fringe; 20 yd flop from rough.',
    },
    {
      cat: 'Putting',
      what: 'Every shot played from the green.',
      example: '22-ft lag; 4-ft come-backer.',
    },
  ]
  return (
    <div style={{ borderTop: '1px solid #D9D2BF' }}>
      {rows.map((r) => (
        <div
          key={r.cat}
          className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_2fr]"
          style={{
            gap: 18,
            padding: '14px 0',
            borderBottom: '1px solid #D9D2BF',
            alignItems: 'baseline',
          }}
        >
          <div
            className="font-serif text-caddie-ink"
            style={{ fontSize: 17, fontWeight: 500 }}
          >
            {r.cat}
          </div>
          <div
            className="text-caddie-ink"
            style={{ fontSize: 14, lineHeight: 1.5 }}
          >
            {r.what}
          </div>
          <div
            className="text-caddie-ink-dim"
            style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}
          >
            {r.example}
          </div>
        </div>
      ))}
    </div>
  )
}
