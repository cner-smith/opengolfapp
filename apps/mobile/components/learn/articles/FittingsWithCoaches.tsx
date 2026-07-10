import { Text, View } from 'react-native'
import { FONT } from '../../../lib/typography'
import {
  ArticleHeader,
  ArticleFooter,
  BulletList,
  Callout,
  C,
  Em,
  H3,
  Hr,
  Link,
  P,
  Sources,
  Strong,
} from '../primitives'

export function FittingsWithCoachesArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Working with coaches · Fittings with coaches"
        title="A lesson changes the swing; a fitting fits it."
      />

      <P>
        The equipment guide on <Em>golf fittings</Em> covers what each fitting
        measures and changes — driver, irons, wedges, putter, shaft, and ball —
        and when each one is worth the money. This is the companion question from
        the coaching side: who should fit you, how a fitting fits into working
        with a coach, and how to time it so you're not fitting expensive
        equipment to a swing you're about to change. The two appointments are
        easy to confuse, and treating them as one is how golfers waste both.
      </P>

      <FitterTable />

      <Hr />

      <H3>Two different appointments</H3>
      <P>
        A lesson tries to change your swing. A fitting fits clubs to the swing
        you actually have today — not the one you're hoping to build. That's the
        line that confuses people: they want to "fix the slice first, then get
        fit," and end up playing ill-fitting clubs for a year while they chase a
        swing change.
      </P>
      <P>
        The better order is usually the opposite. Properly fit equipment fits the
        swing you bring tomorrow, and when you stop compensating for the wrong
        gear, a coach's changes often come <Em>faster</Em>. Unless you are a brand
        new golfer with nothing stable to measure, "fix it first" is mostly
        backward — get fit to your current swing, then let lessons move it, and
        re-check the specs when the swing has genuinely changed.
      </P>

      <Hr />

      <H3>Who's actually fitting you</H3>
      <P>
        Not all fittings come from the same chair, and the chair matters. Three
        people might fit you, and their incentives are not identical:
      </P>
      <BulletList
        items={[
          <Text key="coach">
            <Strong>Your coach or instructor.</Strong> Already knows your typical
            miss, your goals, and the change you're in the middle of. A fitting
            run by — or coordinated with — your coach starts with all of that
            context instead of a blank sheet. The catch: not every teaching pro is
            a trained fitter, so ask what tools and data they actually use.
          </Text>,
          <Text key="independent">
            <Strong>An independent fitter.</Strong> Carries multiple brands and
            gets paid for the fitting, not the badge on the head, so the
            recommendation is brand-neutral. The catch: they meet you cold and only
            see the swing you bring that hour — tell them what you're working on so
            they don't fit you to a temporary flaw.
          </Text>,
          <Text key="oem">
            <Strong>A brand (OEM) fitter.</Strong> Deep on one manufacturer's
            lineup and often free, which is great if you already want that brand.
            The catch: the answer will be that brand, so treat it as fitting{' '}
            <Em>within</Em> a line you've chosen, not an open comparison.
          </Text>,
        ]}
      />
      <P>
        The strongest setup is a team that talks. The Titleist Performance
        Institute model makes this explicit — coach, fitness, and fitting aligned
        on the same goals — and most club fitters, left alone, have no idea what
        your instructor is trying to build. You are the one who has to connect
        them.
      </P>

      <Hr />

      <H3>Time it around your swing, not against it</H3>
      <P>
        The "fit the swing you have" rule has a wrinkle worth getting right.
        Real swing changes are usually incremental and ongoing, not a single
        overhaul on a Tuesday — so there is rarely a perfect "finished" moment to
        fit. Waiting for one mostly means playing bad gear forever.
      </P>
      <P>
        The actual danger is narrow: getting fit cold, in the middle of a major
        rebuild, to a swing you're about to abandon. Avoid it with coordination,
        not delay. Tell your coach before you book a fitting, and tell the fitter
        what you're working on — a degree of lie or a shaft profile can either
        support a change your coach is making or quietly fight it, and only the
        two of them together can tell which.
      </P>

      <Hr />

      <H3>The body comes first</H3>
      <P>
        Before the launch monitor, the right spec depends on what your body can
        actually do. The textbook lie angle, shaft, and length assume a range of
        motion you may or may not have; a mobility limit in the hips or shoulders
        can make the "standard" recommendation wrong for you. This is the
        body-swing connection the Titleist Performance Institute built its
        certification around — a physical screen that correlates how you move
        with how you should be fit and coached. A good coach-led fitting starts
        there, not at the driver.
      </P>

      <Callout>
        <P style={{ marginBottom: 0, fontSize: 14, lineHeight: 21 }}>
          <Strong>The one move:</Strong> loop your coach in before you book the
          fitting, and tell the fitter the exact change you're working on. A
          fitting done in a vacuum optimizes launch and spin for one hour's swing;
          a fitting that knows your coach's plan optimizes for the player you're
          becoming.
        </P>
      </Callout>

      <H3>Red flags</H3>
      <P>
        A coach-coordinated fitting should make your equipment quieter, not your
        wallet lighter. Walk if you see these:
      </P>
      <BulletList
        items={[
          <Text key="onebrand">
            <Strong>A "fitting" that only ever lands on one brand</Strong> — or one
            that never asks what you currently play or what you're working on.
          </Text>,
          <Text key="midlesson">
            <Strong>Gear pushed in the middle of a lesson.</Strong> A purchase is a
            separate appointment; your most expensive coaching minutes shouldn't go
            to a sales pitch.
          </Text>,
          <Text key="promise">
            <Strong>"Buy these and your slice is gone."</Strong> Equipment can
            remove a fight against your gear; it can't install a swing change. If
            someone promises clubs will fix mechanics, they're selling, not
            fitting.
          </Text>,
        ]}
      />

      <P>
        Get the order and the team right — body first, fit the swing you have,
        coach and fitter on the same page — and a fitting stops being a gamble on
        gear and becomes part of the same plan as your lessons.
      </P>

      <Sources
        items={[
          {
            name: "Fit the swing you have, don't wait to \"fix\" it",
            note: (
              <Text>
                <Link href="https://golf.com/gear/fix-your-swing-club-fitting/">
                  GOLF.com · why fixing your swing before a fitting is backward
                </Link>{' '}
                and{' '}
                <Link href="https://scramble.golftec.com/blog/2015/06/fit-vs-fix-should-i-get-fit-for-clubs-or-fix-my-swing/">
                  GolfTEC · fit vs fix
                </Link>{' '}
                — fit to your current swing; properly fit gear tends to speed a
                change up, not wait on it.
              </Text>
            ),
          },
          {
            name: 'Coach and fitter should be aligned',
            note: (
              <Text>
                <Link href="https://www.titleist.com/learning-lab/performance/tpi-team-approach">
                  Titleist Performance Institute · the team approach
                </Link>{' '}
                — most fitters, left alone, don't know your coach's plan; the player
                has to connect them.
              </Text>
            ),
          },
          {
            name: 'Your body shapes the right spec',
            note: (
              <Text>
                <Link href="https://www.titleist.com/fitting/golf-club-fitting/titleist-performance-institute">
                  Titleist Performance Institute · the body-swing connection
                </Link>{' '}
                — a physical screen correlates how you move with how you should be fit
                and coached, so the fitting starts with the body, not the driver.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>Last reviewed July 2026</ArticleFooter>
    </View>
  )
}

// The three people who might fit you, set against the two things that actually
// distinguish them — context and brand-neutrality — plus when each is the right
// chair. Leads the article because the choice of fitter frames everything after.
// Stacked single-column per row for phone width.
function FitterTable() {
  const rows: { who: string; knows: string; neutral: string; best: string }[] = [
    {
      who: 'Your coach',
      knows: 'Knows your swing & plan',
      neutral: 'Depends on their tools',
      best: "When you're mid-change",
    },
    {
      who: 'Independent',
      knows: 'Meets you cold',
      neutral: 'Brand-neutral',
      best: 'For an open comparison',
    },
    {
      who: 'Brand (OEM)',
      knows: 'Meets you cold',
      neutral: 'One brand only',
      best: "Once you've picked a brand",
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
        paddingHorizontal: 18,
        marginBottom: 18,
      }}
    >
      {rows.map((r, i) => (
        <View
          key={r.who}
          style={{
            paddingTop: i === 0 ? 0 : 10,
            marginTop: i === 0 ? 0 : 10,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: C.line,
          }}
        >
          <Text
            style={{
              color: C.ink,
              fontFamily: FONT.serifItalic,
              fontSize: 15,
              marginBottom: 2,
            }}
          >
            {r.who}
          </Text>
          <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 20 }}>
            {r.knows} · {r.neutral}
          </Text>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
            Best: {r.best}
          </Text>
        </View>
      ))}
    </View>
  )
}
