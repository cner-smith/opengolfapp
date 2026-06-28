import { Text, View } from 'react-native'
import { FONT } from '../../../lib/typography'
import {
  ArticleHeader,
  C,
  DefRow,
  Em,
  GlanceBox,
  KICKER,
  P,
  Subhead,
} from '../primitives'

export function StrokesGainedArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Understanding the game · Strokes gained"
        title="Strokes gained, in plain English."
      />

      <P>
        <Em>Strokes gained</Em> measures every shot against an expectation. Hit
        a shot from the same lie and distance as a pro might, beat the expected
        outcome, and you gained strokes; come up short, you lost some. Sum the
        deltas across a round and you get a precise read on where your strokes
        are actually coming from — or going.
      </P>
      <P>
        Score alone tells you the result. Strokes gained tells you <Em>why</Em>.
        A 78 might be built on a great short game bailing out wayward irons, or
        it might be the iron play carrying a leaky putter. The overall score is
        identical; the work to fix it is not.
      </P>

      <Subhead>The four categories</Subhead>
      <P>Every shot fits in exactly one bucket:</P>
      <GlanceBox>
        <DefRow term="Off the tee" first>
          Tee shots on par 4s and par 5s. Your driver swing, essentially.
        </DefRow>
        <DefRow term="Approach">
          Shots from outside 30 yards that aren't tee shots — the bulk of your
          iron and hybrid play.
        </DefRow>
        <DefRow term="Around the green">
          Shots from within 30 yards that are not on the green — chips, pitches,
          bunker shots.
        </DefRow>
        <DefRow term="Putting">Every shot taken from the green.</DefRow>
      </GlanceBox>

      <WorkedExample />

      <Subhead>Reading the sign</Subhead>
      <P>
        Positive numbers mean you played better than the bracket baseline at
        your handicap. Negative means you lost strokes to that baseline.{' '}
        <Em>+0.3 SG-Putting</Em> means your putting gave you about a third of a
        stroke per round vs a typical player at your level. <Em>−1.4 SG-Approach</Em>{' '}
        means your irons are leaking 1.4 strokes a round.
      </P>
      <P>
        The forest in this app is always positive territory. The brick is where
        strokes leak. If a category sits at zero you are the average for your
        bracket — fine, not a leak.
      </P>

      <Subhead>What counts where</Subhead>
      <SGCategoriesTable />
    </View>
  )
}

// Co-located worked-example card: a GlanceBox lede + three stat tiles + the
// payoff note. Tiles mirror the web ExampleRow (label · big italic value · note)
// and carry the pos/neg color override; the Stat tile borrows the Benchmarks
// pattern (KICKER label + tabular italic value).
function WorkedExample() {
  return (
    <GlanceBox
      label="A worked example"
      style={{
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.surface,
        padding: 22,
        marginTop: 18,
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          color: C.ink,
          fontFamily: FONT.body,
          fontSize: 16,
          lineHeight: 24,
          marginBottom: 14,
        }}
      >
        You hit a 7-iron from <Em>155 yards</Em> in the fairway and end up{' '}
        <Em>22 feet</Em> from the hole on the green.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <ExampleStat
          label="Expected from 155 yd"
          value="2.86"
          note="Strokes a 10-handicap typically takes to hole out from there."
        />
        <ExampleStat
          label="Expected from 22 ft"
          value="1.97"
          note="What it usually takes to two-putt from that distance."
        />
        <ExampleStat
          label="Strokes gained"
          value="−0.11"
          note="2.86 − 1.97 − 1 (the shot you just hit)."
          tone="neg"
        />
      </View>
      <Text
        style={{
          color: C.inkDim,
          fontFamily: FONT.body,
          fontSize: 13,
          lineHeight: 20,
        }}
      >
        Slightly below baseline. Hit it to <Em>10 feet</Em> instead and the
        number flips: 2.86 − 1.61 − 1 ={' '}
        <Text style={{ fontFamily: FONT.serifItalic }}>
          +0.25
        </Text>{' '}
        — a quarter of a stroke gained on a single approach. Stack eighteen of
        those across a round and the difference is 4–5 strokes.
      </Text>
    </GlanceBox>
  )
}

function ExampleStat({
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
  const color = tone === 'pos' ? '#1F3D2C' : tone === 'neg' ? '#A33A2A' : '#1C211C'
  return (
    <View style={{ minWidth: 120, flex: 1 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>{label}</Text>
      <Text
        style={{
          color,
          fontFamily: FONT.serifItalic,
          fontSize: 26,
          lineHeight: 28,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: C.inkDim,
          fontFamily: FONT.body,
          fontSize: 12,
          marginTop: 6,
          lineHeight: 17,
        }}
      >
        {note}
      </Text>
    </View>
  )
}

// What-counts-where table: category · what · example, built from the shared
// DefRow term + a co-located italic example line to mirror the web 3-column row.
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
    <View>
      {rows.map((r) => (
        <DefRow key={r.cat} term={r.cat}>
          <Text style={{ color: C.ink }}>{r.what}</Text>
          {'\n'}
          <Text style={{ fontFamily: FONT.bodyItalic, color: C.inkDim }}>
            {r.example}
          </Text>
        </DefRow>
      ))}
    </View>
  )
}
