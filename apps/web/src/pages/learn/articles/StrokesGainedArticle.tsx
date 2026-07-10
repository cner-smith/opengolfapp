import {
  Body,
  Bullet,
  Lede,
  SrcBody,
  SrcLabel,
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
        expectation. From every lie and distance there's an expected
        outcome — what a player at your level typically does from
        there. Beat it and you gained strokes; come up short, you lost
        some. Sum the deltas across a round and you get a precise read
        on where your strokes are actually coming from — or going.
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
          Shots from more than 30 yards out (measured to the edge of
          the green) that aren't par-4 or par-5 tee shots — a par-3
          tee shot counts as approach.
        </Bullet>
        <Bullet term="Around the green">
          Shots from within 30 yards of the green's edge that are not
          on the putting surface — chips, pitches, bunker shots.
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
        Green numbers are gained strokes; red is where they leak. If a
        category sits at zero you are the average for your bracket —
        fine, not a leak.
      </Body>

      <Subkicker>What counts where</Subkicker>
      <SGCategoriesTable />

      <Sources />
    </article>
  )
}

function Sources() {
  return (
    <section style={{ borderTop: '1px solid #D9D2BF', paddingTop: 18, marginTop: 22 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        Sources
      </div>
      <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
        <div>
          <SrcLabel>Strokes-gained framework and baselines</SrcLabel>
          <SrcBody>
            Mark Broadie's "Every Shot Counts" (2014) and the PGA
            Tour's ShotLink-derived strokes-gained statistics define
            the framework. The worked example uses OGA's 10-handicap
            bracket baselines, which adapt Broadie's scratch tables
            with published amateur shot data — so the expectations are
            for a player at your level, not a tour pro.
          </SrcBody>
        </div>
      </div>
    </section>
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
          value="3.67"
          note="Strokes a 10-handicap typically takes to hole out from there."
        />
        <ExampleRow
          label="Expected from 22 ft"
          value="2.02"
          note="What it usually takes to hole out from that distance — about a two-putt."
        />
        <ExampleRow
          label="Strokes gained"
          value="+0.65"
          note="3.67 − 2.02 − 1 (the shot you just hit)."
          tone="pos"
        />
      </div>
      <p
        className="text-caddie-ink-dim"
        style={{ fontSize: 13, lineHeight: 1.5 }}
      >
        Well above baseline — for a 10-handicap, finding the green at
        all from 155 beats the expectation. Chunk the same swing 40
        yards instead, leaving <em>115 in the fairway</em>, and the
        sign flips: 3.67 − 3.39 − 1 ={' '}
        <span className="font-serif" style={{ fontStyle: 'italic' }}>
          −0.72
        </span>{' '}
        — nearly three-quarters of a stroke lost on one swing. Three
        of those in a round and you have handed back more than two
        strokes before a putt even drops.
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
      what: 'Anything more than 30 yd from the green’s edge that isn’t a par-4 or par-5 tee shot.',
      example: '155 yd 7-iron from the fairway. Tee shot on a par-3.',
    },
    {
      cat: 'Around the green',
      what: 'Inside 30 yd of the green’s edge, not on the putting surface.',
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
