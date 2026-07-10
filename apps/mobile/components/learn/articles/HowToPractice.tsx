import { Text, View } from 'react-native'
import {
  ArticleFooter,
  ArticleHeader,
  BulletList,
  C,
  DevNote,
  H3,
  H4,
  Hr,
  Kv,
  Link,
  P,
  Sources,
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function HowToPracticeArticle() {
  return (
    <View>
      <ArticleHeader kicker="Improving your game · How to practice" title="How to practice." />

      <P>
        Hitting balls and getting better are two different activities. This is
        the difference — and how to structure range time so the work actually
        shows up on the course.
      </P>

      <H3>The uncomfortable truth</H3>
      <P>
        Most golfers practice in a way that feels productive but isn't. They
        hit a bucket of balls, stripe a few drives, feel good, and leave.
        Their handicap doesn't move.
      </P>
      <P>
        This isn't laziness. It's that no one ever explained what practice
        is actually for — or that there's a difference between hitting balls
        and getting better.
      </P>
      <P>
        There's nothing wrong with going to the range to unwind, enjoy the
        weather, or just swing a club. That's a legitimate and enjoyable
        thing to do. But if your goal is to improve, that's a different
        activity and it requires a different approach.
      </P>

      <Hr />

      <H3>What practice is actually for</H3>
      <P>
        Practice exists to change your behavior on the golf course. Not to
        feel good on the range. Not to hit your best shots. To change what
        you do under pressure, on uneven lies, with something at stake.
      </P>
      <P>
        If your practice doesn't eventually show up on the course, it wasn't
        practice — it was entertainment. Which, again, is fine. Just know
        which one you're doing.
      </P>

      <Hr />

      <H3>The four types of practice</H3>

      <H4>Block practice</H4>
      <Kv label="What it is">
        Repeating the same shot over and over. 50 7-irons in a row to the
        same target.
      </Kv>
      <Kv label="Good for">
        Learning a brand new movement. If you're working on a swing change
        with your coach, some repetition helps establish the new pattern.
        Use it sparingly and early.
      </Kv>
      <Kv label="Not good for">
        Building skills that transfer to the course. Research consistently
        shows that improvement during block practice doesn't stick. You get
        better within the session and worse by the next round.
      </Kv>
      <Kv label="The trap">
        Block practice feels like learning because you do get better within
        the session. That feeling is misleading. It is one of the most
        well-replicated findings in motor learning research.
      </Kv>
      <DevNote variant="research">
        Research basis: Robert Bjork (UCLA) — contextual interference
        effect. See also: "Make It Stick" by Brown, Roediger, McDaniel.
      </DevNote>
      <DevNote variant="todo">TODO: Add specific study citations</DevNote>

      <H4>Random practice</H4>
      <Kv label="What it is">
        Varying every shot. 7-iron, driver, wedge, 5-iron — never hitting
        the same club twice in a row.
      </Kv>
      <Kv label="Good for">
        Building skills that actually transfer to the course. The research
        on this is consistent across many studies. Random practice feels
        harder and messier but produces dramatically better retention.
      </Kv>
      <Kv label="Why it works">
        Each time you pick up a different club, your brain has to fully
        reconstruct the motor pattern from scratch. That reconstruction
        process is where learning happens.
      </Kv>
      <Kv label="Vary the conditions too">
        Don't just change clubs — change distance, lie, wind, and slope.
        Golf never gives you the same shot twice, so practice that never
        repeats a shot transfers best.
      </Kv>
      <Kv label="Not good for">
        Learning a brand new movement. Don't randomize before you have a
        basic pattern to work with.
      </Kv>
      <DevNote variant="research">
        Research basis: Contextual interference effect, Battig (1979),
        confirmed in many subsequent studies.
      </DevNote>
      <DevNote variant="todo">
        TODO: Verify whether the beginner exception is well-established or
        still debated
      </DevNote>

      <H4>Skill games</H4>
      <Kv label="What it is">
        Turning a drill into a scored challenge. Make 7 of 10 from 8 feet.
        Get up-and-down 6 times out of 10. Land 5 wedges inside a 15-foot
        circle. Every game has a number you can pass or fail.
      </Kv>
      <Kv label="Good for">
        Feedback and tracking. A score tells you instantly whether a shot
        was good enough, and the same game repeated over weeks shows
        whether you're actually improving — not just whether today felt
        good.
      </Kv>
      <Kv label="Why it works">
        A target and a score force a real result on every ball. That's the
        line between practice and just hitting. It also makes practice
        competitive, which is what keeps you coming back.
      </Kv>
      <Kv label="Combine it with">
        Pressure. Add a consequence to a skill game — start over on a miss
        — and you've trained scoring and nerves at the same time.
      </Kv>

      <H4>Pressure practice</H4>
      <Kv label="What it is">
        Creating consequences in practice. Something is at stake on each
        shot.
      </Kv>
      <BulletList
        items={[
          'Make 5 putts in a row from 6 feet or start over from 0',
          'Last ball in your bucket must hit a specific target',
          'Play a simulated 9 holes on the range — pick targets, keep score',
          'Clock drill: 12 balls around the hole at 3 feet (clock positions), make all 12 in a row or start over',
        ]}
      />
      <Kv label="Good for">
        Training your nervous system to perform under pressure. If you've
        never practiced with consequences, your body hasn't learned how to
        handle them on the course.
      </Kv>
      <DevNote variant="research">
        Research basis: Dr. Sian Beilock — "Choke" (2010). Bob Rotella —
        "Golf Is Not a Game of Perfect" (1995).
      </DevNote>
      <DevNote variant="todo">
        TODO: Add more specific pressure practice examples from tour player
        documented routines
      </DevNote>

      <Hr />

      <H3>How to structure a session</H3>
      <P>
        A well-structured session has a flow. Adjust based on your time and
        current focus area.
      </P>
      <SessionRows />
      <DevNote variant="todo">
        TODO: Review these time allocations with a teaching professional.
        The short game / full swing split in particular (Dave Pelz suggests
        ~60% short game) needs more exploration.
      </DevNote>

      <Hr />

      <H3>Having a goal for the session</H3>
      <P>
        Before you hit a single ball, decide what you're trying to
        accomplish today.
      </P>
      <BulletList
        items={[
          'Bad goal: Work on my irons.',
          'Better goal: Work on my ball striking.',
          'Good goal: Hit 7 of 10 approach shots within 20 yards of the target from 150 yards.',
        ]}
      />
      <P>
        The difference is measurability. If you can't tell whether you
        achieved your goal, it wasn't a goal — it was a vague intention.
      </P>
      <P>
        If you track strokes gained (OGA computes this for you), it tells you
        exactly where to focus. If you're losing 1.2 strokes per round on
        approach shots, that's your focus area. Your practice goal should be
        specific to that weakness.
      </P>
      <H4>How to quantify your practice</H4>
      <BulletList
        items={[
          'Track your success rate on pressure games over time',
          'Note which club and distance you practiced',
          'Write down what you worked on and what changed',
          'Connect practice focus to round data over time',
        ]}
      />

      <Hr />

      <H3>What bad practice looks like</H3>

      <H4>The range bucket spiral</H4>
      <P>
        Buy a large bucket. Hit wedges, feel good. Move to 7-iron, stripe a
        few. Pull out the driver. Spend 45 minutes hitting drivers because
        that's the most fun. Leave feeling like you worked hard. Nothing
        about your game changed.
      </P>

      <H4>Same shot, same target, same lie</H4>
      <P>
        You struggle with your 6-iron so you hit 60 6-irons to the same
        target from a flat lie. On the course you face a 6-iron from a
        downslope with water left. These are completely different skills.
      </P>

      <H4>Practicing your strengths</H4>
      <P>
        You putt well so you skip the green. You hit your driver well so
        you spend an hour on the tee line. Improvement comes from
        addressing weaknesses, not reinforcing strengths.
      </P>

      <H4>No target, no feedback</H4>
      <P>
        Hitting shots without a specific target or any way to evaluate the
        result is exercise, not practice. Useful and enjoyable — but not
        improvement.
      </P>

      <H4>Working on technique under pressure</H4>
      <P>
        The course is for playing. The range is for working on technique.
        Working on a swing change during a round rarely ends well.
      </P>

      <Hr />

      <H3>Practice round vs scoring round</H3>
      <P>
        Two completely different activities. Mixing them is one of the most
        common mistakes amateurs make.
      </P>
      <Kv label="Practice round mode">
        Experiment. Try the risky shot. Play from a bad lie on purpose. Hit
        two balls. Explore. Score doesn't matter — you're gathering
        information.
      </Kv>
      <Kv label="Scoring round mode">
        Full pre-shot routine on every shot. Full commitment. No mulligans.
        Track everything. This is performance mode.
      </Kv>
      <P>
        The mistake is being half-committed to both — sort of practicing,
        sort of scoring. You get the anxiety of performance without the
        data of tracking, and the experimentation of practice without the
        freedom of no consequences.
      </P>
      <P>
        Before you tee off, decide which mode you're in and commit to it
        fully.
      </P>

      <Hr />

      <Sources
        items={[
          {
            name: 'Block vs random practice (contextual interference)',
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
                — random groups putt worse in practice, better in retention.
              </Text>
            ),
          },
          {
            name: 'Varying conditions — variability and desirable difficulty',
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
                — acclimatization and pre-performance routines help skills
                survive competitive anxiety.
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
                — practice quality matters enormously, though the strong claim
                that hours alone explain expertise has not fully replicated.
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

function SessionRows() {
  const rows = [
    { phase: 'Warm up', dur: '10–15 min', why: 'Easy wedges, get body ready. Not practice time.' },
    { phase: 'Skill work', dur: '20–30 min', why: 'Current focus area. Deliberate, with feedback.' },
    { phase: 'Random / variable', dur: '20–30 min', why: 'Whole bag, random clubs, real targets.' },
    { phase: 'Pressure games', dur: '10–15 min', why: 'Consequences on every shot. Keep score.' },
    { phase: 'Short game', dur: '15–20 min', why: 'Chipping and pitching. Don’t skip.' },
    { phase: 'Putting', dur: '10–15 min', why: 'Always end on the green. End by holing putts.' },
  ]
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.line, marginBottom: 14 }}>
      {rows.map((r) => (
        <View
          key={r.phase}
          style={{
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: C.line,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15 }}>
              {r.phase}
            </Text>
            <Text style={{ color: C.inkDim, fontFamily: FONT.mono, fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {r.dur}
            </Text>
          </View>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 20 }}>{r.why}</Text>
        </View>
      ))}
    </View>
  )
}
