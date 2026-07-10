import { Text, View } from 'react-native'
import Svg, { Circle, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg'
import { FONT } from '../../../lib/typography'
import {
  ArticleHeader,
  ArticleFooter,
  DefRow,
  Em,
  Figure,
  GlanceBox,
  H3,
  Hr,
  Link,
  P,
  Sources,
  C,
} from '../primitives'

export function PracticeModesArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Improving your game · Practice modes"
        title="Block, random, and pressure."
      />

      <H3>The practice that feels best teaches least</H3>
      <P>
        The most satisfying practice — same club, same target, ball after ball
        until it grooves — is also the least durable. Half a century of
        motor-learning research keeps landing on the same uncomfortable result:
        how well you hit it on the range is a poor predictor of how well you'll
        learn. The practice that improves your score often feels worse while
        you're doing it.
      </P>
      <P>
        There are three modes worth understanding — blocked, random, and
        pressure. Each does a different job, and the mistake nearly every golfer
        makes is living entirely in the first one. This is what each mode is for,
        and how to put them together.
      </P>

      <GlanceBox label="The three modes at a glance">
        <DefRow term="Blocked" first>
          Same shot, repeated. Installs a new movement — fast gains, fragile.
        </DefRow>
        <DefRow term="Random">
          A different shot every ball. Builds durable, transferable skill.
        </DefRow>
        <DefRow term="Pressure">
          Consequence on the shot. Carries the skill to the first tee.
        </DefRow>
      </GlanceBox>

      <Hr />

      <H3>Blocked — building the movement</H3>
      <P>
        Blocked practice is one shot repeated: the same club to the same target,
        over and over. It's the right tool for installing a brand-new movement or
        working through a swing change — repetition lets you feel the new pattern
        without anything else competing for attention, and you improve fast
        inside the session. That fast improvement is exactly the trap. The gains
        are fragile, and they tend not to follow you to the course. Use blocks to
        install a feel, not to finish it: a short blocked warm-up, then move on.
      </P>

      <Hr />

      <H3>Random — the mode that actually transfers</H3>

      <Figure caption="Top row: blocked practice groups the same shot together. Bottom row: random practice interleaves club and target every ball.">
        <ScheduleDiagram />
      </Figure>

      <P>
        Random practice mixes it up every ball — different club, different
        target, never the same shot twice in a row. It produces a strange,
        well-documented pattern called the contextual interference effect:
        random practice makes you <Em>worse</Em> during the session but{' '}
        <Em>better</Em> days later, on the tests that measure real learning —
        retention and transfer to new situations.
      </P>
      <P>
        The reason is that each ball forces you to build the shot from scratch,
        the way the course always will — you never hit the same putt twice in a
        round. Studies of golf putting and chipping show it directly: random
        groups putt worse in practice, then more accurately on a delayed
        retention test, and build a mental model of the stroke closer to a
        skilled player's.
      </P>
      <P>
        This is what the psychologist Robert Bjork named a{' '}
        <Em>desirable difficulty</Em> — a condition that slows you down now and
        pays off later. It feels like you're practicing badly, which is precisely
        why most people avoid it. Once a movement is roughly in place, the bulk of
        your practice should live here.
      </P>

      <Figure caption="Skill over time. Blocked practice (grey) looks better on the range; random practice (green) wins where it counts — days later, on the course.">
        <RetentionDiagram />
      </Figure>

      <Hr />

      <H3>Pressure — closing the gap to the first tee</H3>
      <P>
        The range swing that abandons you on the first tee is a transfer failure:
        you rehearsed the skill in a calm state you never actually compete in.
        Pressure practice fixes the mismatch by adding consequence — a putt you
        have to hole, a number to beat, one ball and one attempt — so the skill
        is trained alongside the nerves it will meet. Sport-psychology research on
        acclimatization shows that practicing under mild, manufactured pressure
        helps performance hold up when the real thing arrives, and is one of the
        better-supported defenses against choking.
      </P>
      <P>
        The companion article on skill games and pressure games is the how — the
        specific games that manufacture that consequence. The point here is only
        the why: a skill you've never tested under pressure is a skill you don't
        yet own on the course.
      </P>

      <Hr />

      <H3>How to combine them</H3>
      <P>
        The modes aren't a menu to pick from; they're a progression. Match the
        mix to what you're trying to do, and shift it as a movement stabilizes.
      </P>

      <CombineTable />

      <P>
        Within a single session, the same shape works: a few minutes of blocks to
        find the feel, the bulk of the time in random practice with the club and
        target changing every ball, and a pressure game to finish. Across months,
        a new change starts blocked-heavy and tilts toward random and pressure as
        it holds up.
      </P>

      <Hr />

      <H3>Why it has to feel worse</H3>
      <P>
        The through-line under all three modes is the same: performance during
        practice is a poor guide to learning, and the conditions that build
        durable, transferable skill are the ones that feel harder while you're in
        them. If your range sessions feel smooth and your scores aren't moving,
        that gap is the signal — not to practice more, but to practice in a way
        that makes the work harder in the right places.
      </P>

      <Sources
        items={[
          {
            name: 'The contextual interference effect (blocked vs random)',
            note: (
              <Text>
                <Link href="https://www.nature.com/articles/s41598-024-65753-3">
                  Scientific Reports (2024) · meta-analysis
                </Link>{' '}
                confirms high contextual interference improves retention, and{' '}
                <Link href="https://www.tandfonline.com/doi/abs/10.1080/00336297.1998.10484285">
                  Brady, Quest (1998)
                </Link>{' '}
                reviews the effect first shown by Shea & Morgan (1979): random
                order hurts practice, helps learning.
              </Text>
            ),
          },
          {
            name: 'Random practice in golf specifically',
            note: (
              <Text>
                <Link href="https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1324615/full">
                  Frontiers · motor learning in golf, a systematic review
                </Link>{' '}
                and{' '}
                <Link href="https://pubmed.ncbi.nlm.nih.gov/28449601/">
                  Fazeli et al. (2017) · random vs blocked in golf putting
                </Link>{' '}
                — random groups putt worse in practice, better in retention, with a
                more skilled mental model.
              </Text>
            ),
          },
          {
            name: 'Why harder practice helps — variability and desirable difficulty',
            note: (
              <Text>
                <Link href="https://link.springer.com/article/10.3758/s13421-021-01168-z">
                  Memory & Cognition (2021) · interleaving and transfer
                </Link>{' '}
                and{' '}
                <Link href="https://pubmed.ncbi.nlm.nih.gov/14768838/">
                  Sherwood & Lee (2003) · schema theory review
                </Link>{' '}
                — variable, interleaved practice is a "desirable difficulty" that
                builds more general, robust skill.
              </Text>
            ),
          },
          {
            name: 'Practicing under pressure',
            note: (
              <Text>
                <Link href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2017.1408134">
                  Gröpel & Mesagno (2019) · choking interventions, a systematic
                  review
                </Link>{' '}
                — acclimatization and pre-performance routines help skills survive
                competitive anxiety.
              </Text>
            ),
          },
          {
            name: 'Deliberate practice, and its limits',
            note: (
              <Text>
                <Link href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6731745/">
                  Macnamara & Maitra, revisiting Ericsson, Krampe &
                  Tesch-Römer (1993)
                </Link>{' '}
                — practice quality matters enormously, though the strong claim that
                hours alone explain expertise has not fully replicated.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed May 2026
      </ArticleFooter>
    </View>
  )
}

// Three shot types as shapes: top row grouped (blocked), bottom interleaved
// (random). Same viewBox + coordinate data as the web inline svg, re-authored
// in react-native-svg.
function Shape({ type, x, y }: { type: 'c' | 's' | 't'; x: number; y: number }) {
  if (type === 'c') {
    return <Circle cx={x} cy={y} r={3.5} fill="none" stroke={C.ink} strokeWidth={1.5} />
  }
  if (type === 's') {
    return (
      <Rect x={x - 3.3} y={y - 3.3} width={6.6} height={6.6} fill="none" stroke={C.ink} strokeWidth={1.5} />
    )
  }
  return (
    <Polygon
      points={`${x},${y - 4.2} ${x + 4},${y + 3.4} ${x - 4},${y + 3.4}`}
      fill="none"
      stroke={C.ink}
      strokeWidth={1.5}
    />
  )
}

function ScheduleDiagram() {
  type Mark = { t: 'c' | 's' | 't'; x: number }
  const xs = [20, 35, 50, 65, 80, 95, 110, 125, 140]
  const order = (seq: ('c' | 's' | 't')[]): Mark[] =>
    seq.map((t, i) => ({ t, x: xs[i] ?? 0 }))
  const blocked = order(['c', 'c', 'c', 's', 's', 's', 't', 't', 't'])
  const random = order(['c', 's', 't', 's', 'c', 't', 'c', 't', 's'])
  return (
    <Svg width="100%" height={90} viewBox="0 0 160 90">
      {blocked.map((m, i) => (
        <Shape key={`b-${i}`} type={m.t} x={m.x} y={28} />
      ))}
      {random.map((m, i) => (
        <Shape key={`r-${i}`} type={m.t} x={m.x} y={64} />
      ))}
    </Svg>
  )
}

// Contextual interference: blocked wins in practice, random wins later. Same
// viewBox + coordinate data as the web inline svg, re-authored in
// react-native-svg.
function RetentionDiagram() {
  return (
    <Svg width="100%" height={110} viewBox="0 0 200 110">
      <Line x1={24} y1={86} x2={188} y2={86} stroke={C.mute} strokeWidth={1.5} />
      <Line x1={24} y1={14} x2={24} y2={86} stroke={C.mute} strokeWidth={1.5} />
      <Line x1={106} y1={18} x2={106} y2={86} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
      {/* blocked: high in practice, drops later */}
      <Polyline points="30,44 106,30 182,68" fill="none" stroke={C.mute} strokeWidth={2} />
      {/* random: low in practice, best later (accent) */}
      <Polyline points="30,74 106,60 182,30" fill="none" stroke={C.accent} strokeWidth={2} />
      <SvgText x={54} y={100} fontSize={7} fontFamily={FONT.mono} letterSpacing={1} fill={C.mute}>
        PRACTICE
      </SvgText>
      <SvgText x={136} y={100} fontSize={7} fontFamily={FONT.mono} letterSpacing={1} fill={C.mute}>
        LATER
      </SvgText>
    </Svg>
  )
}

// Match the mode mix to the goal, and shift it as the movement stabilizes.
// Web's 2-col CombineTable rendered stacked: italic goal + dim body per row.
function CombineTable() {
  const rows: { goal: string; mix: string }[] = [
    {
      goal: 'Installing a new move',
      mix: 'Mostly blocked. Repeat the shot until the new feel is reliable before adding any variety.',
    },
    {
      goal: 'Building durable skill',
      mix: 'Mostly random. A different club and target every ball — this is where most practice should live.',
    },
    {
      goal: 'Getting ready to compete',
      mix: 'Add pressure. Put consequence on the shot, woven into random practice rather than tacked on at the end.',
    },
  ]
  return (
    <View style={{ marginBottom: 14, borderTopWidth: 1, borderTopColor: C.line }}>
      {rows.map((r) => (
        <View
          key={r.goal}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}
        >
          <Text
            style={{
              color: C.ink,
              fontFamily: FONT.serifItalic,
              fontSize: 15,
              marginBottom: 4,
            }}
          >
            {r.goal}
          </Text>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20 }}>{r.mix}</Text>
        </View>
      ))}
    </View>
  )
}
