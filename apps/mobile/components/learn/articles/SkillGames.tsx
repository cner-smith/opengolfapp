import { Text, View } from 'react-native'
import {
  ArticleFooter,
  ArticleHeader,
  BulletList,
  H3,
  H4,
  Hr,
  Kv,
  Link,
  P,
  Sources,
} from '../primitives'

export function SkillGamesArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Improving your game · Skill games"
        title="Skill games and pressure games."
      />

      <H3>Why games beat mindless repetition</H3>
      <P>
        Hitting the same shot over and over until you run out of
        balls is the default range session. It feels like practice.
        It largely isn't.
      </P>
      <P>
        Games change the dynamic. A target, a score, stakes. You're
        tracking something. You either succeed or you don't. That
        structure forces commitment on each shot — the same
        commitment you need on the course.
      </P>
      <P>
        End sessions with games. Technical work belongs earlier
        when focus is fresh. Finish with games when you're shifting
        from mechanics to performance.
      </P>

      <Hr />

      <H3>The pressure problem</H3>
      <P>
        The fundamental challenge of practice: you know you have
        another ball. On the course, you don't. That knowledge
        removes consequence from every range swing. You never
        practice the mental state you need when something is
        riding on the shot.
      </P>
      <P>
        Pressure games solve this. Create enough consequence that
        missing would genuinely bother you. Not so much that you're
        miserable. Just enough that each shot matters.
      </P>
      <P>
        Stakes must be real but not ruinous. A candy bar, ten
        pushups, coffee with a buddy. Too small and you don't
        care. Too large and anxiety takes over.
      </P>
      <P>
        The last few balls of any range bucket are a natural
        pressure game. You're out of balls. Make them count.
      </P>

      <Hr />

      <H3>Putting games</H3>

      <H4>The clock drill</H4>
      <P>
        Place twelve balls around a hole at three feet — clock
        positions. Make all twelve in a row. Miss and start over.
      </P>
      <P>
        Deceptively brutal. Getting to eleven and then missing is
        genuinely painful. That pain is the point — it simulates
        the pressure of needing to make a putt with something on
        the line.
      </P>
      <P>
        Move to four feet, then five. Tour players do this from
        six feet as a warm-up. Make all twelve from six and your
        short putting is tour-level.
      </P>
      <Kv label="Variation">
        Use one ball. Walk around the clock, replace after each
        putt, make all twelve in a row. Harder — no second chances,
        and the walk resets your mental state between putts.
      </Kv>

      <H4>Three-station pressure drill</H4>
      <P>
        Three feet, six feet, nine feet. Make ten putts at each
        station before moving on. Miss more than one and start the
        station over.
      </P>
      <P>
        Escalating pressure. Three feet is achievable. Six with
        the threat of restart matters. Nine, after completing the
        first two — real pressure. Track total attempts to complete
        all three across sessions.
      </P>

      <H4>The putting circuit</H4>
      <P>
        Pick nine holes on the practice green. Par 2 each — one
        putt, two-putt is par, three-putt is bogey. Play it as a
        proper round. Same nine holes every session so you can
        track improvement.
      </P>
      <Kv label="Competitive version">
        Head to head with a partner. Stroke or match play. Adds
        pressure solo practice can't replicate.
      </Kv>

      <H4>The gate drill</H4>
      <P>
        Two tees just wider than your putter, a foot in front of
        the ball on your line. Roll the ball through without
        touching either tee.
      </P>
      <P>
        Trains starting line. Most missed putts are missed before
        the ball breaks. Start at six feet straight, then ten,
        then a breaker. Exposes inconsistency in stroke path fast.
      </P>

      <H4>Speed control — the ladder drill</H4>
      <P>
        Five balls at ten feet. Hit the first putt — note where it
        finishes. The second must finish on the opposite side of
        the hole from the first. The third must finish between the
        first two.
      </P>
      <P>
        Move back five feet and repeat. Trains intentional pace
        variation — directly transferable to lag putting and fast
        greens.
      </P>

      <Hr />

      <H3>Chipping and short game games</H3>

      <H4>Up and down challenge</H4>
      <P>
        Five spots around the practice green at varying distances.
        From each spot, chip and putt out. Sum strokes. Set a
        target — maybe 12 — and try to beat it. Lower as you
        improve.
      </P>
      <Kv label="Pressure version">
        Five up-and-downs in a row. Miss one and the streak
        restarts. Getting to four and chunking the next chip is
        exactly the pressure the course creates.
      </Kv>

      <H4>Three clubs, one ball per station</H4>
      <P>
        Three distances — 20, 40, 60 yards. One ball from each.
        No mulligan. The single-ball constraint is everything.
      </P>

      <H4>Flag left or flag right</H4>
      <P>
        At the range pick a flag. Before each shot, declare: left
        or right. Within ten feet on the declared side = birdie.
        Correct side, outside the window = par. Wrong side =
        double bogey.
      </P>
      <P>
        Teaches two things. First, controlling shot shape under
        pressure — you have to commit before you swing. Second,
        the cost of the short side. Score over ten shots; -4 or
        better is good.
      </P>

      <Hr />

      <H3>Full swing games</H3>

      <H4>Horse at the range</H4>
      <P>
        Like the basketball game. Pick a target. Hit. Partner has
        to match it. Miss the match and you get a letter. First
        to H-O-R-S-E loses. Calling your shot before swinging is
        the same skill the course demands.
      </P>

      <H4>The imaginary fairway</H4>
      <P>
        Two targets define a fairway, 25–30 yards wide. Ten tee
        shots. Driver in the fairway = 3, fairway wood = 2, iron
        = 1. -2 if you imagine a hazard side and find it.
      </P>
      <P>
        Incentivizes driver — the most distance, the most risk.
        Forces a real reward-vs-risk decision on every shot.
      </P>

      <H4>Same distance, different clubs</H4>
      <P>
        Pick a flag at 100 yards. Hit it with five different clubs.
        9-iron, 8-iron, PW, GW, SW — each requires a different
        swing length and speed.
      </P>
      <P>
        Builds feel for partial shots. Teaches your actual
        distances better than full swings — you're forced to
        feel a 75% swing with each club.
      </P>

      <H4>Three club challenge</H4>
      <P>
        Simulated nine-hole round on the range with only three
        clubs — driver, mid iron, wedge. Tee shot, approach, chip
        — each to a different target. Forces creativity. You
        learn to work the ball.
      </P>

      <Hr />

      <H3>The last ball rule</H3>
      <P>
        Whatever you're practicing, save your last ball for a
        specific challenge. Announce it before you hit:
      </P>
      <BulletList
        items={[
          '"This drive has to find the fairway."',
          '"This wedge has to finish within ten feet of the flag."',
          '"This 7-iron has to carry the 150 marker."',
        ]}
      />
      <P>
        One ball, no second chance. The session ends on this shot
        — and you find out whether the work translates when
        something is riding on it.
      </P>

      <Hr />

      <H3>Building your own pressure games</H3>
      <P>
        Generic drills work. Customized stakes work better.
      </P>
      <Kv label="Stakes must be real but not ruinous">
        Candy bar, coffee, pushups, bragging rights. Twenty dollars
        or public embarrassment shuts down performance instead of
        training it.
      </Kv>
      <Kv label="Streaks beat totals">
        10 of 15 creates less pressure than 5 in a row. Streaks
        carry the weight of every previous success — closer to
        how the course feels.
      </Kv>
      <Kv label="One-and-done beats best-of">
        A single attempt, no mulligans. The closer to the
        one-chance nature of a real shot, the better.
      </Kv>
      <Kv label="Track scores over time">
        A game without a scoreboard is a drill. Watching your
        score improve across months is genuinely motivating.
      </Kv>

      <Hr />

      <Sources
        items={[
          {
            name: 'Why scored, varied games transfer (contextual interference)',
            note: (
              <Text>
                <Link href="https://www.nature.com/articles/s41598-024-65753-3">
                  Scientific Reports (2024) · meta-analysis
                </Link>{' '}
                confirms high contextual interference improves retention, and{' '}
                <Link href="https://www.tandfonline.com/doi/abs/10.1080/00336297.1998.10484285">
                  Magill & Hall, Quest (1998)
                </Link>{' '}
                reviews the effect first shown by Shea & Morgan (1979): mixed,
                scored practice transfers better than rote repetition.
              </Text>
            ),
          },
          {
            name: 'In golf specifically',
            note: (
              <Text>
                <Link href="https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1324615/full">
                  Frontiers · motor learning in golf, a systematic review
                </Link>{' '}
                and{' '}
                <Link href="https://pubmed.ncbi.nlm.nih.gov/28449601/">
                  Fazeli et al. (2017) · random vs blocked in golf putting
                </Link>{' '}
                — varied, game-like practice builds a more skilled mental model.
              </Text>
            ),
          },
          {
            name: 'Why the stakes matter — practicing under pressure',
            note: (
              <Text>
                <Link href="https://www.tandfonline.com/doi/full/10.1080/1750984X.2017.1408134">
                  International Review of Sport & Exercise Psychology (2018) ·
                  choking interventions, a systematic review
                </Link>{' '}
                and{' '}
                <Link href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1435374/full">
                  Frontiers in Psychology (2025) · performance under pressure
                </Link>{' '}
                — rehearsing with consequences helps skills survive competitive
                anxiety.
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

// (sources now rendered via the shared Sources primitive above)
