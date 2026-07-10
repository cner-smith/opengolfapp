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
  Sources,
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
        <Em>Strokes gained</Em> measures every shot against an expectation.
        From every lie and distance there's an expected outcome — what a player
        at your level typically does from there. Beat it and you gained
        strokes; come up short, you lost some. Sum the deltas across a round
        and you get a precise read on where your strokes are actually coming
        from — or going.
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
          Shots from more than 30 yards out (measured to the edge of the green)
          that aren't par-4 or par-5 tee shots — a par-3 tee shot counts as
          approach.
        </DefRow>
        <DefRow term="Around the green">
          Shots from within 30 yards of the green's edge that are not on the
          putting surface — chips, pitches, bunker shots.
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
        Green numbers are gained strokes; red is where they leak. If a category
        sits at zero you are the average for your bracket — fine, not a leak.
      </P>

      <Subhead>What counts where</Subhead>
      <SGCategoriesTable />

      <Sources
        items={[
          {
            name: 'Strokes-gained framework and baselines',
            note: (
              <Text>
                Mark Broadie's "Every Shot Counts" (2014) and the PGA Tour's
                ShotLink-derived strokes-gained statistics define the
                framework. The worked example uses OGA's 10-handicap bracket
                baselines, which adapt Broadie's scratch tables with published
                amateur shot data — so the expectations are for a player at
                your level, not a tour pro.
              </Text>
            ),
          },
        ]}
      />
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
          value="3.67"
          note="Strokes a 10-handicap typically takes to hole out from there."
        />
        <ExampleStat
          label="Expected from 22 ft"
          value="2.02"
          note="What it usually takes to hole out from that distance — about a two-putt."
        />
        <ExampleStat
          label="Strokes gained"
          value="+0.65"
          note="3.67 − 2.02 − 1 (the shot you just hit)."
          tone="pos"
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
        Well above baseline — for a 10-handicap, finding the green at all from
        155 beats the expectation. Chunk the same swing 40 yards instead,
        leaving <Em>115 in the fairway</Em>, and the sign flips: 3.67 − 3.39 −
        1 ={' '}
        <Text style={{ fontFamily: FONT.serifItalic }}>
          −0.72
        </Text>{' '}
        — nearly three-quarters of a stroke lost on one swing. Three of those
        in a round and you have handed back more than two strokes before a putt
        even drops.
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
