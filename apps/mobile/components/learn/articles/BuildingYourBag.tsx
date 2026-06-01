import { Text, View } from 'react-native'
import Svg, { Circle, G, Line, Rect } from 'react-native-svg'
import {
  ArticleFooter,
  ArticleHeader,
  C,
  DefRow,
  Figure,
  GlanceBox,
  H3,
  Hr,
  Link,
  P,
  Sources,
} from '../primitives'

export function BuildingYourBagArticle() {
  return (
    <View>
      <ArticleHeader kicker="Your equipment · Draft" title="Building your bag." />

      <H3>Fourteen clubs is a budget, not a checklist</H3>
      <P>
        The rules let you carry fourteen clubs — no more. Most golfers fill that
        number out of habit: driver, 3-wood, irons down through the pitching
        wedge, a sand wedge, a putter, and whatever was in the box. Almost nobody
        asks the only question that matters — do these fourteen actually cover my
        distances? Usually they don't. The goal was never to own fourteen clubs.
        It's even gaps, top to bottom, with no dead zones.
      </P>

      <GlanceBox label="The two dead zones">
        <DefRow term="Overlap" first>
          Two clubs that carry the same distance. One of them is a wasted slot —
          a club you could have spent covering a yardage you can't reach.
        </DefRow>
        <DefRow term="Hole">
          A distance you can't cover with any full swing, so you're stuck
          guessing at a three-quarter shot. Most often it sits just below the
          pitching wedge.
        </DefRow>
      </GlanceBox>

      <P>
        Fix both and the bag fits you instead of the rack it came off. Everything
        below is how to find and close those gaps.
      </P>

      <Hr />

      <H3>Start from your distances, not the set</H3>
      <Figure caption="Even gaps vs. an overlap and a hole">
        <GapLadderDiagram />
      </Figure>
      <P style={{ color: C.inkDim, fontSize: 14, lineHeight: 22 }}>
        Build the bag backwards from carry numbers, not forwards from a set you
        bought. Hit five to ten balls with each club, average the carries — throw
        out the obvious duffs — and list them top to bottom. The picture shows up
        at once: where clubs bunch together, and where they spread.
      </P>
      <P style={{ color: C.inkDim, fontSize: 14, lineHeight: 22 }}>
        Aim for even steps of roughly 10 to 15 yards between full clubs. Two
        clubs landing within about 8 yards of each other is a wasted slot — one
        of them is doing nothing. A gap wider than 15 leaves you stranded between
        clubs, forced into a half-swing you'll never trust on the course.
      </P>

      <Hr />

      <H3>The top of the bag: driver down to your longest club</H3>
      <P>
        This is where the most common dead zone hides. Modern lofts are strong,
        and a lot of amateurs find their 3-, 4-, and 5-iron all carry within ten
        yards of each other — three slots doing one club's job. The fix is to
        replace the long irons you can't launch with hybrids or a higher-lofted
        fairway wood: they get the ball up more easily and restore real
        separation between clubs.
      </P>
      <P>
        Keep long irons only if you have the speed to flight them and a reason to
        hit it low. And check the very top: if your 3-wood off the deck goes
        nearly as far as a driver you rarely trust, that's a slot you could spend
        on a club you'll actually pull. Carry the longest club you can keep in
        play, not the longest one you own.
      </P>

      <Hr />

      <H3>The scoring clubs: wedges, where strokes are won and lost</H3>
      <Figure caption="Wedges climbing in even loft steps">
        <WedgeLoftDiagram />
      </Figure>
      <P style={{ color: C.inkDim, fontSize: 14, lineHeight: 22 }}>
        The bottom of the bag is where most amateurs quietly leak strokes.
        Pitching-wedge lofts have crept stronger over the years — a
        game-improvement set may run 41–43°, where a traditional one sat at
        45–46° — and that opens a big hole right below it, in the 30-to-50-yard
        range where you score.
      </P>
      <P style={{ color: C.inkDim, fontSize: 14, lineHeight: 22 }}>
        Space your wedges in even loft steps of about 4 to 6°. A common setup:
        pitching wedge around 45°, gap wedge near 50°, sand wedge 54–56°, lob
        wedge 58–60°. If your pitching wedge is 45° or stronger, a gap wedge
        isn't optional — without it you've got a yawning hole exactly where touch
        matters most. For most players, pitching, gap, and sand wedges cover it;
        add a lob wedge only if you have the swing for it.
      </P>
      <P>
        Which bounce and grind to put on those wedges is a fitting question, not
        a gapping one — it's covered in the fittings guide. Here, the job is only
        to make sure no two of them go the same distance and nothing's missing
        below your pitching wedge.
      </P>

      <Hr />

      <H3>The putter — the club you use most</H3>
      <P>
        Roughly 40% of the strokes in a round are putts, which makes the putter
        the one slot you should never treat as an afterthought or a hand-me-down.
        It doesn't need gapping, but it does need fitting — length, lie, and head
        style matched to your stroke — and that's the cheapest set of strokes on
        this page. One slot, used more than any other; spend it deliberately.
      </P>

      <Hr />

      <H3>Where the fourteen go</H3>
      <P>
        There's no single correct bag, but a no-dead-zone build for most golfers
        lands close to this. The exact count flexes — drop a wedge to add a
        hybrid, or the reverse — as long as the gaps stay even.
      </P>

      <SampleBag />

      <P>
        Run the range test once a season and after any new club. A bag with even
        gaps and nothing you can't hit beats a bag full of the newest models —
        the fourteen slots are a budget, and the player who spends them on
        coverage instead of habit shoots lower without buying a thing.
      </P>

      <Sources
        items={[
          {
            name: "USGA · Rule 4, the player's equipment",
            href: 'https://www.usga.org/content/usga/home-page/rules/rules-2019/rules-of-golf/rule-4.html',
            note: "The fourteen-club limit — you may carry no more than fourteen clubs, but no minimum and no restriction on type.",
          },
          {
            name: 'Bobby Walia Golf · club gapping guide',
            href: 'https://www.bobbywaliagolf.com/club-gapping-guide/',
            note: 'Distance gapping and finding the holes — aim for even 10–15 yard steps; long irons that bunch within ten yards are better replaced with hybrids.',
          },
          {
            name: 'Hireko Golf · gapping your irons',
            href: 'https://www.hirekogolf.com/blog/post/guide-to-gapping-your-irons-correctly-solving-iron-distance-gaps',
            note: 'Companion gapping reference — even steps between full clubs, no bunched long irons.',
          },
          {
            name: 'Golf Digest · everything to know about wedge lofts',
            href: 'https://www.golfdigest.com/story/everything-you-need-to-know-about-wedge-lofts',
            note: 'Wedge lofts and the gap below the pitching wedge — strong pitching-wedge lofts open a gap; space wedges about 4–6° apart to close it.',
          },
          {
            name: 'MyGolfSpy · wedge gapping by handicap',
            href: 'https://mygolfspy.com/news-opinion/instruction/wedge-gapping-chart-by-handicap-distance-lofts-and-trends/',
            note: 'Wedge distances and lofts by handicap — even spacing keeps the scoring range covered.',
          },
        ]}
      />

      <ArticleFooter>Last reviewed May 2026 · Draft, needs fitter review</ArticleFooter>
    </View>
  )
}

// Top row: even gaps. Bottom row: a bunched overlap and an accent-marked hole.
// Same viewBox + path data as the web GapLadderDiagram.
function GapLadderDiagram() {
  return (
    <Svg width="100%" viewBox="0 0 160 110" style={{ aspectRatio: 160 / 110 }}>
      {/* even-gap ladder */}
      <Line x1={18} y1={34} x2={142} y2={34} stroke="#9F9580" strokeWidth={1.5} />
      {[18, 43, 68, 93, 118, 142].map((x) => (
        <G key={`top-${x}`}>
          <Line x1={x} y1={28} x2={x} y2={40} stroke={C.ink} strokeWidth={1.5} />
          <Circle cx={x} cy={34} r={2} fill={C.ink} />
        </G>
      ))}
      {/* dead-zone ladder: two bunched, then a hole */}
      <Line x1={18} y1={84} x2={142} y2={84} stroke="#9F9580" strokeWidth={1.5} />
      {[18, 30, 92, 117, 142].map((x) => (
        <G key={`bot-${x}`}>
          <Line x1={x} y1={78} x2={x} y2={90} stroke={C.ink} strokeWidth={1.5} />
          <Circle cx={x} cy={84} r={2} fill={C.ink} />
        </G>
      ))}
      {/* the hole, marked in accent */}
      <Line x1={34} y1={98} x2={88} y2={98} stroke={C.accent} strokeWidth={1.5} />
      <Line x1={34} y1={95} x2={34} y2={101} stroke={C.accent} strokeWidth={1.5} />
      <Line x1={88} y1={95} x2={88} y2={101} stroke={C.accent} strokeWidth={1.5} />
    </Svg>
  )
}

// Four wedges climbing in even loft steps. Same viewBox + data as web.
function WedgeLoftDiagram() {
  const bars = [
    { x: 26, h: 30 },
    { x: 58, h: 42 },
    { x: 90, h: 54 },
    { x: 122, h: 66 },
  ]
  return (
    <Svg width="100%" viewBox="0 0 160 96" style={{ aspectRatio: 160 / 96 }}>
      <Line x1={14} y1={82} x2={146} y2={82} stroke="#9F9580" strokeWidth={1.5} />
      {bars.map((b) => (
        <Rect
          key={b.x}
          x={b.x}
          y={82 - b.h}
          width={12}
          height={b.h}
          rx={2}
          fill="none"
          stroke={C.ink}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  )
}

// Where a no-dead-zone build for most golfers spends its fourteen slots.
// Web renders a 2-col table; on phone we stack role over its description.
function SampleBag() {
  const rows: { role: string; clubs: string }[] = [
    {
      role: 'Off the tee',
      clubs: 'Driver — one slot, the longest club you can keep in play.',
    },
    {
      role: 'Long approach',
      clubs:
        'A 3-wood, hybrids, or a high-lofted fairway — whatever you actually hit off the deck. Most amateurs gap better with hybrids than 3- and 4-irons.',
    },
    {
      role: 'Mid & short irons',
      clubs: 'Roughly 5-iron through pitching wedge, in even 10–15 yard steps.',
    },
    {
      role: 'Scoring',
      clubs:
        'Pitching, gap, and sand wedge cover most players; add a lob wedge if you have the swing for it. Even 4–6° loft gaps.',
    },
    {
      role: 'On the green',
      clubs: "Putter — the club you use most. Fit it, don't default it.",
    },
  ]
  return (
    <View style={{ marginBottom: 18, borderTopWidth: 1, borderTopColor: C.line }}>
      {rows.map((r) => (
        <View
          key={r.role}
          style={{
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: C.line,
          }}
        >
          <Text
            style={{
              color: C.ink,
              fontSize: 15,
              fontStyle: 'italic',
              fontWeight: '500',
              marginBottom: 4,
            }}
          >
            {r.role}
          </Text>
          <Text style={{ color: C.inkDim, fontSize: 14, lineHeight: 20 }}>{r.clubs}</Text>
        </View>
      ))}
    </View>
  )
}
