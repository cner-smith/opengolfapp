import { Text, View } from 'react-native'
import {
  ArticleHeader,
  ArticleFooter,
  BulletList,
  Callout,
  Em,
  H3,
  Hr,
  Link,
  P,
  Sources,
  Strong,
  C,
  KICKER,
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function PracticeVsScoringRoundArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="On the course · Practice vs scoring"
        title="Decide which round you're playing."
      />

      <P>
        A practice round and a scoring round use the same eighteen holes, but
        they are two different jobs — and trying to do both at once does neither
        well. The guide on <Em>how to practice effectively</Em> makes the
        distinction in a sentence: one is for information, the other is for
        performance. This is the on-course version — what each round is actually
        for, how to run a real practice round instead of just a casual one, and
        why the rounds that blur the line teach you the least.
      </P>

      <ModeTable />

      <Hr />

      <H3>What a practice round is actually for</H3>
      <P>
        A practice round is reconnaissance. You are not trying to shoot a number
        — you are gathering the information that lets you commit on the day it
        counts. It's what tour players spend the days before a tournament doing
        — more on their method below — and you can get most of the value in a
        single honest loop.
      </P>
      <BulletList
        items={[
          <Text>
            <Strong>Hit driver off the tees you're unsure about.</Strong> You
            learn whether your driver actually reaches the fairway bunker or the
            dogleg trouble. You can always dial back to a 3-wood in competition —
            but only if you know what driver does first.
          </Text>,
          <Text>
            <Strong>Find where you can't miss.</Strong> On every approach, note
            the side that leaves a dead chip or a ball in the water. Course
            management is mostly knowing the one place the ball can't go; the
            practice round is where you find it.
          </Text>,
          <Text>
            <Strong>Putt from the spots you'll actually face.</Strong> Roll a few
            from each likely pin area to learn the speed and the big breaks. The
            green is where rounds are won, and it reads differently than it
            looks.
          </Text>,
          <Text>
            <Strong>Play a ball from the rough and a bunker.</Strong> A shot or
            two from the conditions you'll meet tells you how this course's turf
            and sand behave before they surprise you under pressure.
          </Text>,
          <Text>
            <Strong>Don't keep score.</Strong> A score on a practice round sets
            an expectation you'll carry to the first tee for no reason. Drop a
            second ball, try the riskier line, hole out for the read — the round
            is for learning, not for a number.
          </Text>,
        ]}
      />

      <Hr />

      <H3>How the pros do it</H3>
      <P>
        The gold standard for this lives on tour, and the logic scales down to
        any golfer. Pros don't see a tournament course cold on Thursday — they
        arrive days early and play practice rounds Monday and Tuesday, with
        Wednesday's pro-am often serving as one last relaxed look. By the time
        the first round counts, they've already made every decision the course
        is going to ask of them.
      </P>
      <P>
        Most of that work is reconnaissance, not swing practice. The caddie
        scouts the course — sometimes separately from the player — pacing off
        yardages to landing zones and to each pin area, logging the wind, and
        recording the club, speed, and spin from shots hit along the way. All of
        it goes into a yardage book built on top of the detailed base book the
        event supplies, until the player has a hole-by-hole plan: the club off
        each tee, the number to leave on each approach, and the side that can't
        be short-sided. Crucially, they practice approaches to the actual hole
        locations planned for the four tournament days — not to wherever the
        flag happens to sit that morning.
      </P>
      <P>
        Greens are the one place the rules recently pushed pros back toward
        doing their own homework. Since 2022, golf's governing bodies have let
        tournaments require an approved yardage book whose green diagrams show
        only minimal detail — major slopes and tiers, not a full contour map —
        and the only extra notes allowed are ones the player or caddie made from
        watching a ball actually roll. Even the best players in the world now
        have to earn their green reads in the practice round, which is exactly
        what you should be doing anyway.
      </P>

      <Hr />

      <H3>Borrow the method, skip the budget</H3>
      <P>
        You don't have a caddie, four days, or a closed golf course — but the
        method shrinks to fit an ordinary tee time. The goal is unchanged: walk
        off knowing the course so that nothing in your next scoring round is a
        first-time surprise.
      </P>
      <BulletList
        items={[
          <Text>
            <Strong>Go when it's quiet.</Strong> An early or twilight tee time,
            or a slow midweek afternoon, lets you drop a second ball and
            experiment without a group breathing down your neck. Reconnaissance
            needs room to fail.
          </Text>,
          <Text>
            <Strong>Keep a notebook.</Strong> A phone note or a cheap yardage
            book is plenty. One line per hole: a stock layup number and the one
            place the ball can't go — "7th: lay back to 110, water long-right,
            bail short-left." You'll have forgotten it by next week otherwise.
          </Text>,
          <Text>
            <Strong>Rehearse the in-between yardages.</Strong> Every course keeps
            handing you the same awkward numbers — a 40-yard pitch, a 215-yard
            par 3, a layup that leaves three-quarter wedge. Hit those on purpose
            so they're rehearsed instead of improvised under pressure.
          </Text>,
          <Text>
            <Strong>Learn the big greens from every side.</Strong> Lag a putt
            from the front, the back, and each edge of the largest greens to feel
            the speed and the two or three breaks that actually matter. Speed
            surprises cost more strokes than misread line.
          </Text>,
          <Text>
            <Strong>Practice the misses, not the makes.</Strong> Chip and play
            bunker shots from the spots you tend to short-side yourself, not the
            comfortable ones — those are the shots that wreck a scoring round, so
            meet them here first.
          </Text>,
          <Text>
            <Strong>No time for a full loop? Do it in reverse.</Strong> After an
            ordinary round, jot three notes per nine while the holes are fresh. A
            handful of rounds like that builds the same course knowledge a
            dedicated practice round would, just spread out over time.
          </Text>,
        ]}
      />

      <Hr />

      <H3>What a scoring round demands</H3>
      <P>
        A scoring round is performance. One ball, every shot counts, and the
        only job is to post the lowest number you can with the game you brought.
        That means the opposite of the practice round on almost every count.
      </P>
      <BulletList
        items={[
          <Text>
            <Strong>Full routine on every shot.</Strong> The same pre-shot
            sequence, even on the throwaway ones. A consistent pre-shot routine
            is one of the most reliably effective mental tools in the game — a
            meta-analysis across sports found routines measurably improve
            performance, and they help most precisely when the pressure is on and
            the mind wants to wander.
          </Text>,
          <Text>
            <Strong>Commit, then accept.</Strong> Pick the shot, commit to it,
            and take the result without relitigating it. The experimenting was
            supposed to happen in the practice round; here, a half-committed
            swing is the worst of both worlds.
          </Text>,
          <Text>
            <Strong>One ball, no mulligans.</Strong> The score only means
            something if it's the score you actually made. Play it down, count
            everything, move on.
          </Text>,
          <Text>
            <Strong>Manage, don't experiment.</Strong> Aim at the fat of the
            green, favor the safe miss, and save the new shot you've been working
            on for the range. Even tour players aim at the center, not the pin,
            for anything longer than a short iron.
          </Text>,
        ]}
      />

      <Hr />

      <H3>Why mixing them costs you both</H3>
      <P>
        The common mistake isn't choosing the wrong mode — it's failing to
        choose, and drifting through the round half in each. You take the round
        seriously enough to feel the nerves, but loosely enough to drop a second
        ball when one goes sideways. The result is the worst of both: the
        anxiety of performance without a real score to show for it, and the
        freedom of practice without any of the information.
      </P>
      <P>
        It also quietly ruins your data. If you track rounds to find where your
        game leaks strokes, a dropped second ball or a "let me just try the cut
        here" poisons the signal — the round no longer reflects the decisions and
        misses you'd actually make. A round is only worth measuring if it was
        played honestly: one ball, full commitment, every stroke counted.
      </P>

      <Hr />

      <H3>The casual round is neither — and that's the trap</H3>
      <P>
        Most weekend rounds are neither a true practice round nor a true scoring
        round. That's completely fine — golf is supposed to be fun, and most of
        the time the goal is a good walk with friends. The trap is mistaking a
        steady diet of casual rounds for improvement work. A casual round gives
        you neither clean recon nor a trustworthy score; it just gives you a
        pleasant afternoon, which is its own reward but not a feedback loop.
      </P>
      <P>
        If you actually want to get better, some of your rounds have to be
        honestly one or the other: a recon loop where you experiment freely and
        keep notes, or a committed scoring round you track without fudging. The
        line between them is the whole point.
      </P>

      <Callout>
        <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
          <Strong>The one habit:</Strong> before you hit the first tee shot,
          decide out loud which round this is. "This is a practice round" or
          "I'm playing this one for score" — said before you start — is what
          keeps you from drifting into the half-committed middle where neither
          version pays off.
        </Text>
      </Callout>

      <P>
        The skill in golf isn't only swinging the club; it's knowing which game
        you're playing on any given day and committing to it fully. Pick one
        before you tee off, and both your scores and your practice get sharper
        for it.
      </P>

      <Sources
        items={[
          {
            name: 'A practice round is recon, not a score',
            note: (
              <Text>
                <Link href="https://www.pga.com/story/prioritize-your-practice-sessions-to-prepare-for-a-big-golf-tournament">
                  PGA of America · preparing for a tournament
                </Link>{' '}
                and{' '}
                <Link href="https://golfstateofmind.com/course-management-lessons-from-the-pga-tour/">
                  Golf State of Mind · course-management lessons from the PGA
                  Tour
                </Link>{' '}
                — hit driver to learn the trouble, find the no-go side, default
                to the center of the green, and keep score out of it.
              </Text>
            ),
          },
          {
            name: 'Pre-shot routines help most under pressure',
            note: (
              <Text>
                <Link href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2021.1944271">
                  International Review of Sport & Exercise Psychology (2021) ·
                  meta-analysis of pre-performance routines
                </Link>{' '}
                — a consistent routine produces a measurable performance benefit,
                and it matters most when the pressure invites distraction.
              </Text>
            ),
          },
          {
            name: 'Why the practice mindset is a separate gear',
            note: (
              <Text>
                <Link href="https://www.sportspsychologygolf.com/how-to-think-about-practice-rounds-in-golf/">
                  Golf Psychology (Dr. Patrick Cohn) · how to think about
                  practice rounds
                </Link>{' '}
                — treating a practice round as a performance is how golfers carry
                scoring anxiety into a day that was supposed to lower it.
              </Text>
            ),
          },
          {
            name: 'How tour players turn recon into a plan',
            note: (
              <Text>
                <Link href="https://www.golfmonthly.com/features/5-secrets-of-the-players-open-yardage-book">
                  Golf Monthly · inside a tour player's yardage book
                </Link>{' '}
                and{' '}
                <Link href="https://golfingfocus.com/what-do-pros-have-in-their-yardage-books-things-have-changed/">
                  Golfing Focus · what pros carry in their yardage books
                </Link>{' '}
                — caddies pace off pin-zone yardages and log wind, club, and spin
                in practice rounds, building a hole-by-hole game plan before
                round one.
              </Text>
            ),
          },
          {
            name: 'Even the pros earn their green reads in practice',
            note: (
              <Text>
                <Link href="https://www.pgatour.com/article/news/ground-rules/2021/11/02/new-rule-will-limit-information-players-can-use-for-reading-greens-yardage-book-pga-tour">
                  PGA TOUR · the green-reading-materials rule (Model Local Rule
                  G-11, effective 2022)
                </Link>{' '}
                and{' '}
                <Link href="https://www.golfdigest.com/story/usga-randa-approve-model-local-rule-to-limit-use-of-green-reading-materials">
                  Golf Digest · USGA and R&A on the limit
                </Link>{' '}
                — approved books now show only minimal green detail, and any
                extra notes must come from a player or caddie watching a ball
                roll.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>Last reviewed May 2026</ArticleFooter>
    </View>
  )
}

// The two rounds set side by side across the dimensions that actually differ —
// the comparison is the article's thesis, so it leads before the prose. On
// phone the web 3-column grid is rebuilt as stacked dimension blocks, each with
// its practice / scoring values labeled.
function ModeTable() {
  const rows: { dim: string; practice: string; scoring: string }[] = [
    { dim: 'The job', practice: 'Gather information', scoring: 'Post a number' },
    { dim: 'Balls', practice: 'Drop extras, experiment', scoring: 'One ball, no mulligans' },
    { dim: 'Routine', practice: 'Loose', scoring: 'Full, every shot' },
    { dim: 'Risk', practice: 'Try the dangerous line', scoring: 'Favor the safe miss' },
    { dim: 'Score', practice: "Don't keep it", scoring: 'Count everything' },
    {
      dim: 'Success is',
      practice: 'Walking off knowing the course',
      scoring: 'The lowest number you can',
    },
  ]
  return (
    <View
      style={{
        backgroundColor: C.boxBg,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 2,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 18,
      }}
    >
      {rows.map((r, i) => (
        <View
          key={r.dim}
          style={{
            paddingTop: i === 0 ? 0 : 12,
            marginTop: i === 0 ? 0 : 12,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: C.line,
          }}
        >
          <Text
            style={{
              color: C.ink,
              fontFamily: FONT.serifItalic,
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            {r.dim}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...KICKER, color: C.inkDim, marginBottom: 3 }}>
                Practice round
              </Text>
              <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 13, lineHeight: 19 }}>{r.practice}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...KICKER, color: C.inkDim, marginBottom: 3 }}>
                Scoring round
              </Text>
              <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 13, lineHeight: 19 }}>{r.scoring}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
