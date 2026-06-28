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
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function Operation36Article() {
  return (
    <View>
      <ArticleHeader
        kicker="Improving your game · Operation 36"
        title="The Operation 36 philosophy."
      />

      <H3>Most golfers learn in the wrong order</H3>
      <P>
        The traditional path into golf goes like this: stand on a mat at the
        range, hit a full swing a few hundred times, chase a textbook position,
        and someday — once the swing "looks right" — take it to the course. The
        short game and the business of actually scoring get filed under{' '}
        <Em>later</Em>. The trouble is that the first real round usually arrives
        long before the swing does, and a beginner who can't yet finish a hole
        spends four hours confirming they're bad at golf. A lot of people quit
        right there.
      </P>
      <P>
        Operation 36 — a long-term development program created in 2010 by the
        PGA coaches Matthew Reagan and Ryan Dailey — inverts the order. Instead
        of building a swing and hoping a game shows up, you start on the course,
        25 yards from the hole, and you earn the right to move back only once
        you can post a score from where you stand. You learn to play golf by
        playing golf, at a distance where playing it is actually possible.
      </P>

      <Hr />

      <H3>How the progression works</H3>
      <P>
        The whole system runs on one number you can pass or fail:{' '}
        <Strong>shoot 36 — par for nine holes — from your current distance.</Strong>{' '}
        Clear it and you move back a stage; until then, you stay where you are.
        You begin in Division 1, playing nine holes from 25 yards out, where
        every hole is reachable and every score you write down is a real score.
        Break 36 and you step back to 50 yards, then 75, and onward in stages
        until, eventually, you're shooting par from the full tees — the same
        game the rest of the course is playing.
      </P>

      <ProgressionLadder />

      <P>
        Notice what the structure does: it never lets the challenge run too far
        ahead of the skill. You don't get launched to the back tees and told to
        survive. You face a version of golf you can complete today, and the
        course only grows when you've proven you've outgrown it. Moving back is
        something you <Em>earn</Em>, which makes each step feel like a promotion
        instead of a punishment.
      </P>

      <Hr />

      <H3>What "36" actually means</H3>
      <P>
        The 36 is simply par for nine holes — four strokes a hole, nine holes,
        thirty-six. What makes it clever is that you're chasing that par on a
        course scaled to your ability instead of from the back tees. From 25
        yards, giving yourself four shots to hole out is a target almost anyone
        can reach with a little practice. So par stops being the intimidating
        standard printed on the scorecard and becomes a personal, rolling
        benchmark: par for <Em>your</Em> distance, today.
      </P>
      <P>
        The number never changes — it's always 36 — but what it asks of you
        grows as you move back. Par from 25 yards and par from 150 are the same
        score and wildly different feats, and the gap between them is exactly
        the ground you've earned your way across. That's the quiet trick of it:
        a raw beginner and a single-digit handicap can both be "shooting par,"
        each from the course that fits them, each with a real reason to be proud
        of the number they wrote down.
      </P>

      <Hr />

      <H3>Why starting near the hole works</H3>
      <P>
        The instinct to "master the swing first" feels responsible, but it puts
        the hardest, least rewarding part of golf at the very front, before any
        sense of competence has had a chance to form. Starting near the hole
        flips the experience on its head:
      </P>
      <BulletList
        items={[
          <Text key="a">
            <Strong>You learn to score, not just to swing.</Strong> From 25 yards
            the job is to get the ball in the hole, which is the actual game.
            Range golf measures whether a shot looked good; on-course golf
            measures whether it counted.
          </Text>,
          <Text key="b">
            <Strong>Confidence comes from finishing holes.</Strong> Completing a
            nine and writing down a number you're proud of builds belief in a way
            that striping range balls never quite does.
          </Text>,
          <Text key="c">
            <Strong>The short game is honest.</Strong> Did it go in or didn't it?
            A chip and a putt give instant, unambiguous feedback — far easier to
            judge than whether a full swing was "on plane."
          </Text>,
          <Text key="d">
            <Strong>It defuses the frustration spiral.</Strong> The beginner who
            tops three off the tee and triple-bogeys the first hole learns to
            dread the course. The one shooting 36 from 25 yards learns to look
            forward to it.
          </Text>,
        ]}
      />
      <P>
        There's a sound learning principle underneath all of this. Skills are
        built fastest when the challenge sits just at the edge of current
        ability — hard enough to demand effort, easy enough to succeed at often.
        Coaches call it the optimal challenge point, and it's why you don't
        start a basketball beginner at the three-point line. Operation 36 is
        that idea wearing golf shoes: calibrate the distance to the player, then
        ratchet it up only as fast as they can handle.
      </P>

      <Hr />

      <H3>What it actually teaches</H3>
      <P>
        Beyond getting beginners hooked, the inside-out order quietly teaches a
        few things the range-first path tends to leave out:
      </P>
      <BulletList
        items={[
          <Text key="a">
            <Strong>Putting and chipping are the foundation, not an afterthought.</Strong>{' '}
            They're the first thing you practice and the last thing every hole
            comes down to.
          </Text>,
          <Text key="b">
            <Strong>Scoring is its own skill.</Strong> Hitting it well and
            shooting a number are related but not the same — and the program
            trains the second one directly, from day one.
          </Text>,
          <Text key="c">
            <Strong>Course management arrives naturally.</Strong> Playing real
            holes, even short ones, forces real decisions: where to leave the
            ball, when to play safe, how to think a hole backward from the pin.
          </Text>,
        ]}
      />

      <Hr />

      <H3>What the program actually sells</H3>
      <P>
        The distance ladder is the part that's easy to describe, but it isn't
        really what you pay for. Operation 36 is built around coaching: a
        structured curriculum that introduces a set of skills at each level,
        live group classes with a PGA coach, drills to work on between sessions,
        and an app that tracks where you sit in the progression. The "shoot 36
        to move back" framework is the scaffold — the teaching, the drills, and
        the feedback are what actually carry you up it.
      </P>
      <P>
        That's a fair trade, and for a lot of people — especially kids in a
        junior program — it's some of the best money in golf. But it does mean
        the full experience comes with a price tag and a place you have to show
        up to. The framework rewards you for scoring; the coaching tells you{' '}
        <Em>how</Em> to score better. The two are worth separating, because the
        second part is the expensive part — and it's the part you can assemble
        in other ways.
      </P>

      <Hr />

      <H3>Borrowing the idea without joining the program</H3>
      <P>
        You don't need to enroll anywhere to use the thinking. The philosophy
        survives perfectly well on its own, and any golfer — beginner or not —
        can fold it into how they practice and play:
      </P>
      <Callout>
        <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
          <Strong>Start your sessions close and work outward.</Strong> Open with
          wedges and chips from 25–50 yards before you ever pull the driver. When
          you're learning a new club, begin with partial swings at a short target
          and lengthen only once contact is repeatable.
        </Text>
      </Callout>
      <Callout>
        <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
          <Strong>Measure practice by "did I score," not "did I hit it well."</Strong>{' '}
          Give yourself a pass/fail target — up-and-down from 30 yards, two-putt
          from 20 feet — instead of grading the look of the swing. Build the
          distance or the difficulty back only when you're clearing the bar
          consistently.
        </Text>
      </Callout>

      <Hr />

      <H3>A guided version you can build for free</H3>
      <P>
        On the course, the same logic argues for playing the tees that fit your
        game today rather than the ones ego or habit picks for you. Move up,
        give yourself reachable holes, and make the round about completing it
        well instead of grinding through a course built for someone who hits it
        forty yards past you. As your scoring holds up, move back — the same
        earned progression, on a real card.
      </P>
      <P>
        The harder thing to replicate on your own is the guidance — the part
        that tells you what to work on and shows you you're improving. That's a
        lot of what OGA is built to do. Strokes gained analysis runs the
        diagnosis a coach would, pointing at the one part of your game quietly
        costing you the most shots; a practice plan turns that into specific
        things to go work on; and tracking your rounds gives you the rising line
        that tells you when you've earned the next step back. It's the same
        loop — diagnose, practice, prove it, move back — without a membership.
      </P>
      <P>
        None of that asks you to be a junior, to have grown up at a country
        club, or to pay for a coach you can't reach. An app doesn't replace a
        good teacher — the Operation 36 coaches are excellent at theirs — but
        the <Em>shape</Em> of the journey, start where you can win and earn your
        way back, is something any golfer can follow with honest tracking and
        practice that has a point to it.
      </P>

      <Hr />

      <H3>Credit where it's due</H3>
      <P>
        The structured, distance-based progression described here was developed
        and popularized by{' '}
        <Link href="https://operation36.golf/">Operation 36 Golf</Link>
        , and the "shoot 36 to move back" framework is theirs. What's general —
        and free for anyone to borrow — is the underlying idea: start where you
        can succeed, measure by scoring, and earn your way back. You can apply
        that on any course, with any bag, without signing up for anything.
      </P>

      <Sources
        items={[
          {
            name: 'Operation 36 Golf · How It Works',
            href: 'https://operation36.golf/how-it-works/',
            note: (
              <Text>
                The program — distance progression and the "shoot 36" rule:
                start at 25 yards, shoot 36 or better for nine holes to level up,
                and work back through stages to the full tees.{' '}
                <Link href="https://www.pga.com/story/operation-36-helping-golfers-find-a-love-for-the-game-for-life">
                  PGA of America
                </Link>{' '}
                on the program's founding (2010, Matthew Reagan and Ryan Dailey)
                and why achievable milestones keep beginners connected to the
                game.
              </Text>
            ),
          },
          {
            name: 'Keiser University College of Golf · Developing Confidence in Beginner Golfers',
            href: 'https://collegeofgolf.keiseruniversity.edu/developing-confidence-in-beginner-golfers-thoughts-and-recommendations/',
            note: 'Why achievable challenges build skill and confidence — on the optimal challenge point: learning is fastest when a task is neither too easy nor too hard, so difficulty should rise step by step as competence does.',
          },
        ]}
      />

      <ArticleFooter>Last reviewed May 2026</ArticleFooter>
    </View>
  )
}

// The distance ladder: the reader climbs from 25 yards to the full tees, with a
// "shoot 36" gate between each rung. Read top-to-bottom it shows the whole
// earned progression at a glance. The final rung is the accent — the goal.
function ProgressionLadder() {
  return (
    <View style={{ marginTop: 4, marginBottom: 22 }}>
      <Rung distance="25 yd" caption="Division 1 · where you start" />
      <Gate />
      <Rung distance="50 yd" caption="Division 2" />
      <Gate />
      <Rung distance="75 yd" caption="and back a stage at a time" />
      <Gate />
      <Rung distance="100 yd" caption="" />
      <Gate />
      <Rung distance="150 yd" caption="" />
      <Gate />
      <Rung distance="Full tees" caption="par from the back — the goal" goal />
    </View>
  )
}

function Rung({
  distance,
  caption,
  goal,
}: {
  distance: string
  caption: string
  goal?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: goal ? C.accent : C.line,
        backgroundColor: goal ? C.accent : C.boxBg,
        borderRadius: 2,
        paddingVertical: 10,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.serifItalic,
          fontSize: 18,
          color: goal ? '#F2EEE5' : C.ink,
          minWidth: 78,
        }}
      >
        {distance}
      </Text>
      {caption ? (
        <Text
          style={{
            fontFamily: FONT.body,
            fontSize: 12,
            flex: 1,
            color: goal ? 'rgba(242,238,229,0.78)' : C.mute,
          }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  )
}

// The gate between rungs: a connector carrying the single rule that moves you
// back a stage. The chevron is a simple text glyph instead of the web's svg.
function Gate() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      <Text
        style={{
          ...{
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: 1.3,
            textTransform: 'uppercase' as const,
            color: C.inkDim,
            paddingVertical: 2,
          },
        }}
      >
        Shoot 36 to advance
      </Text>
      <Text style={{ fontFamily: FONT.body, fontSize: 13, lineHeight: 13, color: '#9F9580' }}>⌄</Text>
    </View>
  )
}
