import { Text, View } from 'react-native'
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg'
import {
  ArticleFooter,
  ArticleHeader,
  C,
  DefRow,
  Em,
  Figure,
  GlanceBox,
  H3,
  Hr,
  P,
  Sources,
} from '../primitives'

export function MeasurableGoalsArticle() {
  return (
    <View>
      <ArticleHeader kicker="Improving your game · Draft" title="A goal you can pass or fail." />

      <P>
        Most practice goals are wishes wearing a goal's clothes — work on my
        irons, get more consistent, fix the slice. None of them can be passed or
        failed, so none of them can tell you whether the session worked. A real
        goal has a number and a verdict: when you're done you either hit it or
        you didn't. This is how to build one.
      </P>
      <P>
        It starts with picking the right <Em>kind</Em> of goal — because not all
        of them are yours to control.
      </P>

      <H3>Three kinds of goal</H3>
      <GlanceBox label="From least to most controllable">
        <DefRow term="Outcome — Win the match. Beat Dave." first>
          Depends on other people — you can play your best and still lose.
        </DefRow>
        <DefRow term="Performance — Break 85. Hit 7 of 10 greens.">
          Your own number, measured against yourself, not the field.
        </DefRow>
        <DefRow term="Process — Commit to the routine. Finish the swing.">
          The action itself — entirely under your control, every shot.
        </DefRow>
      </GlanceBox>
      <P>
        The trouble with outcome goals is that you don't fully own them: a clean
        round can still lose to someone putting out of their mind. Hang your sense
        of a good day on the outcome and you've imported anxiety you can't do
        anything about. Performance and process goals are the ones worth setting
        in practice — and of the two, process goals travel best under pressure. In
        a study of club golfers, the players trained to set process goals
        controlled their competitive anxiety and held their concentration better
        than players given no goals at all. Keep the outcome as the direction
        you're heading; score yourself on the performance and process steps that
        get you there.
      </P>

      <Hr />

      <H3>Start with a baseline</H3>
      <P>
        You can't make a goal measurable until you know your current number.
        Before you set a target, measure where you stand: hit ten wedges from 60
        yards, count how many finish within a flagstick's length — say four. Now
        the goal isn't a figure you invented out of optimism; it's "beat four." A
        baseline turns every later session into a comparison instead of a guess,
        and it keeps the target honest — pinned to your actual game rather than to
        what you wish your game looked like.
      </P>

      <Hr />

      <H3>Calibrate the difficulty</H3>
      <P>
        Goal-setting research is consistent on one point: specific, hard goals
        beat vague or easy ones — but only up to the edge of what you can actually
        do. A goal you clear every single time just confirms what you already had.
        A goal you never reach only tells you, again, that you failed. Aim for the
        band in between — the target you make roughly half the time. That's the
        version that pulls your skill forward without snapping your commitment to
        chasing it, the same "harder on purpose" principle behind random and
        pressure practice.
      </P>
      <Figure caption="Success rate on the goal. Clear it every time and it teaches nothing; never clear it and it only demoralizes. The target you make about half the time is the one that moves your skill.">
        <DifficultyBand />
      </Figure>

      <Hr />

      <H3>The anatomy of a testable goal</H3>
      <P>
        Whatever the skill, a goal you can score has the same four parts. Leave
        any one of them vague and the verdict goes fuzzy with it.
      </P>
      <AnatomyTable />

      <Hr />

      <H3>Then move it</H3>
      <P>
        The whole point of a baseline is that you re-set it. Clear your target a
        few sessions running and it has gone too easy — raise it. A measurable
        goal isn't a finish line you cross once; it's a number you keep nudging
        upward as the skill comes in. What never changes is the test itself: at
        the end of every session you can say plainly whether you passed. A goal you
        can't score isn't a goal. It's a hope.
      </P>

      <Sources
        items={[
          {
            name: 'Locke & Latham, American Psychologist (2002) · goal-setting theory, a 35-year review',
            href: 'https://doi.org/10.1037/0003-066X.57.9.705',
            note: 'Specific and difficult goals consistently produce higher performance than vague or easy ones, up to the limit of ability.',
          },
          {
            name: 'Kingston & Hardy, The Sport Psychologist (1997)',
            href: 'https://journals.humankinetics.com/view/journals/tsp/11/3/article-p277.xml',
            note: 'Club golfers trained on process goals controlled competitive anxiety and held concentration better than a no-goal group.',
          },
          {
            name: 'International Review of Sport & Exercise Psychology (2022) · systematic review and meta-analysis of goal setting in sport',
            href: 'https://www.tandfonline.com/doi/full/10.1080/1750984X.2022.2116723',
            note: 'Pooled evidence that goal setting improves performance, with process and performance goals carrying the effect.',
          },
          {
            name: 'Psychology of Sport & Exercise (2015) · holistic process goals for learning and performance under pressure',
            href: 'https://www.sciencedirect.com/science/article/abs/pii/S1469029214001800',
            note: 'A process focus helps skills hold up when the pressure is on.',
          },
        ]}
      />

      <ArticleFooter>Last reviewed May 2026 · Draft, needs coaching review</ArticleFooter>
    </View>
  )
}

// Editorial line-art: the success-rate band, productive middle in accent.
// Same viewBox + coordinate/path data as the web DifficultyBand.
function DifficultyBand() {
  return (
    <Svg width="100%" height={76} viewBox="0 0 220 76">
      {/* full success-rate track */}
      <Rect x={14} y={26} width={192} height={14} fill="none" stroke="#9F9580" strokeWidth={1.5} />
      {/* the productive middle band, ~40–70%, in accent */}
      <Rect x={90} y={26} width={58} height={14} fill={C.accent} opacity={0.16} />
      <Line x1={90} y1={22} x2={90} y2={44} stroke={C.accent} strokeWidth={1.5} />
      <Line x1={148} y1={22} x2={148} y2={44} stroke={C.accent} strokeWidth={1.5} />
      <SvgText x={14} y={58} fontSize={7} fontFamily="monospace" letterSpacing={1} fill={C.mute}>
        TOO EASY
      </SvgText>
      <SvgText x={98} y={58} fontSize={7} fontFamily="monospace" letterSpacing={1} fill={C.accent}>
        THE ZONE
      </SvgText>
      <SvgText x={168} y={58} fontSize={7} fontFamily="monospace" letterSpacing={1} fill={C.mute}>
        TOO HARD
      </SvgText>
      <SvgText x={10} y={20} fontSize={7} fontFamily="monospace" fill={C.mute}>
        0%
      </SvgText>
      <SvgText x={196} y={20} fontSize={7} fontFamily="monospace" fill={C.mute}>
        100%
      </SvgText>
    </Svg>
  )
}

// The four parts every scoreable goal shares. Web renders a 2-col table;
// mobile stacks each row as italic term + dim detail (single column).
function AnatomyTable() {
  const rows: { part: string; detail: string }[] = [
    {
      part: 'The shot',
      detail: 'Exactly what you’re hitting — 7-iron, 60-yard wedge, 6-foot putt. Not “irons.”',
    },
    {
      part: 'The standard',
      detail: 'What counts as a success — inside 20 feet, on the green, holed.',
    },
    {
      part: 'The sample',
      detail: 'How many attempts — ten balls, so one lucky or unlucky swing can’t decide it.',
    },
    {
      part: 'The verdict',
      detail: 'The number to beat — 6 of 10, up from last week’s 4.',
    },
  ]
  return (
    <View style={{ marginBottom: 14, borderTopWidth: 1, borderTopColor: C.line }}>
      {rows.map((r) => (
        <View
          key={r.part}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}
        >
          <Text
            style={{ color: C.ink, fontSize: 15, fontStyle: 'italic', fontWeight: '500', marginBottom: 4 }}
          >
            {r.part}
          </Text>
          <Text style={{ color: C.inkDim, fontSize: 14, lineHeight: 20 }}>{r.detail}</Text>
        </View>
      ))}
    </View>
  )
}
