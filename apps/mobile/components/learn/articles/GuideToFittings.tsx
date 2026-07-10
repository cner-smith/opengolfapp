/**
 * Mobile port of the web Learn article
 * (apps/web/src/pages/learn/articles/GuideToFittingsArticle.tsx).
 *
 * Faithful transcription — prose is verbatim. Web one-off components (Fit, QA,
 * FitByHandicap) are rebuilt as local RN components; shared block/inline pieces
 * come from ../primitives. Sources map to the shared <Sources /> primitive.
 */
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import {
  ArticleFooter,
  ArticleHeader,
  BulletList,
  C,
  H3,
  Hr,
  KICKER,
  Link,
  P,
  Sources,
  Strong,
  Subhead,
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function GuideToFittingsArticle() {
  return (
    <View>
      <ArticleHeader kicker="Your equipment · Golf fittings" title="Golf fittings." />

      <H3>There is no such thing as "getting fit"</H3>
      <P>
        Most golfers picture a fitting as one appointment that sorts out their
        clubs. It isn't. Driver, irons, wedges, putter, shaft, and ball are six
        different fittings measuring six different things, and being dialed in
        with one tells you nothing about the others.
      </P>
      <P>
        Knowing what each one actually changes is how you spend fitting money
        where it returns strokes instead of where it sells clubs. So before you
        book anything, here is what is on the table.
      </P>

      <Hr />

      <H3>The six fittings, and what each one changes</H3>

      <Fit
        name="Driver"
        measures="launch angle, spin rate, club path, face angle, ball speed"
        adjusts="loft, shaft, and — on most modern heads — movable weights and an adjustable hosel. The goal is a launch-and-spin pairing that carries: too much spin balloons it, too little drops it out of the sky early."
      />
      <Fit
        name="Irons"
        measures="lie angle, length, shaft weight and flex, grip size"
        adjusts="mostly lie and length. Lie angle is the one that quietly costs accuracy — and most players are off. Across more than 100,000 fittings, Ping finds the majority of golfers don't match the standard lie, and a single degree off can push a wedge five to six yards offline."
      />
      <Fit
        name="Wedges"
        measures="bounce, grind, and the loft gaps between your wedges"
        adjusts="which bounce and grind suit your turf and swing. Bounce is the angle that keeps the sole from digging: high bounce (over 10°) suits soft turf, fluffy lies, and steep digger swings; low bounce (4–6°) suits firm turf and shallow, sweeping contact; mid bounce (7–10°) is the versatile middle. Grind is the shape of the sole around that bounce."
      />
      <Fit
        name="Putter"
        measures="length, lie, loft, and your stroke shape — how much it arcs"
        adjusts="length, lie, head style, and grip. A strong-arc stroke and a straight-back-straight-through stroke want different head designs. It is the club you use most and the one amateurs fit least."
      />
      <Fit
        name="Shaft"
        measures="how the shaft loads and delivers the head for your speed and tempo"
        adjusts="flex, weight, and bend profile. Flex is how much the shaft bends through the swing; too soft for your speed and the head lags behind your hands and the face arrives pointing offline. Flex is not standardized — one brand's stiff can play like another's regular."
      />
      <Fit
        name="Ball"
        measures="how the ball launches, spins, and behaves around the green with your clubs"
        adjusts="which ball you play. Balls are marketed by compression, but fit by flight and spin — find the launch-and-spin window your clubs actually produce, not a number matched to your swing speed. The cover — soft urethane versus a firmer ionomer — trades greenside spin and feel against durability and distance. The ball is a fitting too, and the cheapest one to test."
      />

      <Hr />

      <H3>When to get fitted — start where it pays</H3>
      <P>
        You don't need every fitting at once, and a brand-new golfer doesn't
        need any yet — the swing has to repeat before there is anything stable
        to measure. After that, fit in the order that returns the most strokes
        for the money.
      </P>

      <FitByHandicap />

      <P>
        The through-line: fit the club you use most and the swing you actually
        have, not the one you are hoping to build.
      </P>

      <Hr />

      <H3>Get the most out of the day</H3>
      <P>
        A fitting is only as good as the swing you bring to it. A few habits
        separate data you can trust from a wasted hour:
      </P>
      <BulletList
        items={[
          <Text key="0">
            <Strong>Bring the clubs you actually play.</Strong> The fitter needs
            a baseline — every recommendation should be measured against your
            current gamer, not against nothing.
          </Text>,
          <Text key="1">
            <Strong>Warm up like a round, not a long-drive contest.</Strong> Fit
            the swing you play with, not the one that shows up for three perfect
            balls.
          </Text>,
          <Text key="2">
            <Strong>Come with a goal and your typical miss.</Strong> "I lose it
            right off the tee" or "my wedges are gapping badly" focuses the hour.
          </Text>,
          <Text key="3">
            <Strong>Hit enough balls per option.</Strong> One good shot is luck;
            a fitter should be reading a cluster, not a highlight.
          </Text>,
          <Text key="4">
            <Strong>Be honest about how often you play.</Strong> The best club
            for a range hero who plays twice a year is not the best club for you.
          </Text>,
        ]}
      />

      <Hr />

      <H3>A real fitting vs a sales pitch</H3>
      <P>
        A fitting and a sale can look identical from the outside. The difference
        is whether the session is about your numbers or about the rack.
      </P>

      <Subhead>Signs it's a real fitting</Subhead>
      <BulletList
        items={[
          'A launch monitor is running and you are shown your numbers',
          'Several heads and shafts are tested back-to-back, not just one',
          'The fitter explains what each change did to the ball flight',
          "You are sometimes told a change isn't worth the money",
        ]}
      />

      <Subhead>Signs it's a sales pitch</Subhead>
      <BulletList
        items={[
          'One option is pushed hard from the start',
          "No data is shown, or the numbers are kept on the fitter's side",
          '"This is what everyone\'s playing" stands in for your results',
          'Every session somehow ends in exactly one thing to buy',
        ]}
      />

      <P>
        Indoor fitting gives controlled launch-monitor data; outdoor lets you
        see real flight and roll. Both are valid — but either way the numbers
        should be explained to you, not just sold.
      </P>

      <Hr />

      <H3>Questions worth asking</H3>
      <P>
        The fitter works for you for that hour, even when the bay is inside a
        shop. These turn a transaction back into a fitting — each one, and what
        you're listening for in the answer:
      </P>
      <QA lead="&ldquo;What are we optimizing for?&rdquo;">
        You want a clear target before the first ball — carry distance, tighter
        dispersion, better gapping. "Let's just hit some and see" is not a plan.
      </QA>
      <QA lead="&ldquo;Can I see the numbers for every option?&rdquo;">
        A real fitting shows you the data for each club, not just announces a
        winner. If the screen only faces the fitter, ask them to turn it around.
      </QA>
      <QA lead="&ldquo;How does this compare to what I'm playing now?&rdquo;">
        Every change should beat your current gamer by enough to matter — and
        "better" should be a number, not a feeling.
      </QA>
      <QA lead="&ldquo;Is this difference real, or is it inside my scatter?&rdquo;">
        If an option averages five yards longer but your shots vary by twenty,
        that five yards is noise. A good fitter talks in averages and spread,
        not single shots.
      </QA>
      <QA lead="&ldquo;What would you change first — and what isn't worth it?&rdquo;">
        A fitter willing to tell you something doesn't matter is one you can
        trust on the things that do.
      </QA>
      <QA lead="&ldquo;What are my yardage gaps?&rdquo;">
        You want even gaps between clubs — no two going the same distance, and
        no big holes where you're stranded between clubs.
      </QA>

      <Hr />

      <H3>Decoding what the fitter says</H3>
      <P>
        Fitters talk in launch-monitor shorthand. Here is what the common
        phrases actually mean — and when one is a real signal versus a way to
        wave a weak number past you.
      </P>
      <QA lead="&ldquo;You need more launch / less spin.&rdquo;">
        Your carry isn't matching your speed. With the driver, too much spin
        balloons the ball and costs distance; too little and it drops out of the
        sky early. The fix is launch and spin working together, usually through
        loft and shaft.
      </QA>
      <QA lead="&ldquo;Your smash factor is 1.4-something.&rdquo;">
        How much ball speed you got for your clubhead speed — basically, how
        flush you struck it. Around 1.50 with a driver is efficient; a low
        number usually means off-center contact, which can be the club or your
        strike, so make sure it's the club before you pay for it.
      </QA>
      <QA lead="&ldquo;Your dispersion tightened up.&rdquo;">
        Your shots are landing in a smaller area. This matters more than one
        extra-long drive — the tighter pattern is the one that keeps you in
        play. Reward dispersion over the occasional bomb.
      </QA>
      <QA lead="&ldquo;Your spin axis is tilted.&rdquo;">
        That's your curve: the ball fades or draws because the face and the path
        don't match. Same mechanism as a slice in any ball-flight explainer —
        the fitter is just reading it off the monitor.
      </QA>
      <QA lead="&ldquo;This shaft loads better for you.&rdquo;">
        A feel-and-timing claim. It can be real, but it should still show up in
        the data — better contact, tighter dispersion, more speed. If it only
        feels better and the numbers are flat, that's preference, not
        performance.
      </QA>
      <QA lead="&ldquo;Your attack angle is up / down.&rdquo;">
        Whether you're hitting up or down on the ball at impact. The driver
        likes a slightly upward strike for carry; irons want a downward strike
        that bottoms out just after the ball.
      </QA>
      <QA lead="&ldquo;The numbers don't tell the whole story.&rdquo;">
        Sometimes true for feel — but it's also the line used to sell you past
        data that doesn't support the upgrade. Make them tell you exactly what
        the numbers are missing.
      </QA>

      <Hr />

      <H3>When you're ready, and how often</H3>
      <P>
        You are ready when your contact is consistent enough that the fitter is
        measuring your swing and not your mishits — roughly, when most shots
        find the middle of the face. Get re-fit after a swing change, a real
        change in speed, or every few years as your body and the equipment move
        on. You don't need the newest model. You need clubs that match you.
      </P>

      <Hr />

      <H3>What it costs</H3>
      <P>
        Big retailers often fit for free when you buy. Independent fittings run
        roughly $75–150 for a single club up to $300 and more for a full bag,
        sometimes credited back toward a purchase, with building the clubs
        billed separately. The fitting itself is cheap next to a set of irons —
        and a putter fitting is the cheapest stroke-saver on this page.
      </P>

      <Sources
        items={[
          {
            name: 'Lie angle and iron fitting',
            note: (
              <Text>
                <Link href="https://www.globalgolf.com/articles/pro-tip-110/">
                  Understanding the PING fitting charts
                </Link>{' '}
                and{' '}
                <Link href="https://mygolfspy.com/news-opinion/historys-mysteries-the-birth-of-pings-color-code-system/">
                  MyGolfSpy on PING's color-code system
                </Link>{' '}
                — over 100,000 fittings show most golfers don't match the
                standard lie; a degree off moves a wedge several yards offline.
              </Text>
            ),
          },
          {
            name: 'Wedge bounce and grind',
            note: (
              <Text>
                <Link href="https://www.vokey.com/explained/wedge-bounce">
                  Titleist Vokey · Wedge Bounce
                </Link>{' '}
                and{' '}
                <Link href="https://www.golfdigest.com/story/wedge-bounce-versus-wedge-grind-explained">
                  Golf Digest · bounce vs grind
                </Link>{' '}
                — high, mid, and low bounce, and which turf and swing each
                suits.
              </Text>
            ),
          },
          {
            name: 'Shaft flex and the ball',
            note: (
              <Text>
                <Link href="https://mygolfspy.com/news-opinion/instruction/golf-driver-shaft-flex-chart-find-the-right-flex-for-your-swing-speed/">
                  MyGolfSpy · shaft flex by swing speed
                </Link>{' '}
                and{' '}
                <Link href="https://www.pgatoursuperstore.com/learning-center/ultimate-golf-club-shaft-flex-guide.html">
                  PGA Tour Superstore · shaft flex guide
                </Link>{' '}
                — flex changes where the face points at impact, and isn't
                standard across brands; the ball is marketed by compression but
                fit by flight, spin, and greenside cover.
              </Text>
            ),
          },
          {
            name: "What the fitter's numbers mean",
            note: (
              <Text>
                <Link href="https://www.trackman.com/blog/golf/6-trackman-numbers-all-amateur-golfers-should-know">
                  TrackMan · 6 numbers every amateur should know
                </Link>{' '}
                and{' '}
                <Link href="https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman">
                  the ultimate guide to TrackMan data
                </Link>{' '}
                — launch, spin, smash factor, attack angle, and dispersion, in
                plain terms.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>Last reviewed July 2026</ArticleFooter>
    </View>
  )
}

// ── local one-off components (web Fit / QA / FitByHandicap) ──────────────────

/** One fitting type: what it measures vs what it actually adjusts. */
function Fit({
  name,
  measures,
  adjusts,
}: {
  name: string
  measures: string
  adjusts: string
}) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginBottom: 12 }}>
      <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 18, marginBottom: 6 }}>
        {name}
      </Text>
      <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
        <FitTag>Measures</FitTag> {measures}
      </Text>
      <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22, marginTop: 4 }}>
        <FitTag>Adjusts</FitTag> {adjusts}
      </Text>
    </View>
  )
}

/** Inline small-caps label prefix used inside <Fit>. */
function FitTag({ children }: { children: ReactNode }) {
  return (
    <Text style={{ ...KICKER, color: C.mute }}>{children}</Text>
  )
}

/** A question to ask (or a phrase the fitter uses) and what it actually means. */
function QA({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginBottom: 10 }}>
      <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15, marginBottom: 4 }}>
        {lead}
      </Text>
      <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>{children}</Text>
    </View>
  )
}

/** Fitting priority by handicap — fit the highest-return club for where you are. */
function FitByHandicap() {
  const rows: { stage: string; advice: string }[] = [
    {
      stage: 'New golfer',
      advice: 'Not yet. Get contact repeatable first — there is nothing stable to fit.',
    },
    {
      stage: '20+ handicap',
      advice: 'Putter first. The club you use most, and the cheapest to fit.',
    },
    {
      stage: '10–20',
      advice: 'Irons and wedges — lie angle, length, and the loft gaps between wedges.',
    },
    {
      stage: 'Under 10',
      advice: 'Everything, ball included — small gains are worth chasing now.',
    },
  ]
  return (
    <View style={{ marginBottom: 18, borderTopWidth: 1, borderTopColor: C.line }}>
      {rows.map((r) => (
        <View
          key={r.stage}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}
        >
          <Text style={{ color: C.ink, fontFamily: FONT.serifItalic, fontSize: 15, marginBottom: 4 }}>
            {r.stage}
          </Text>
          <Text style={{ color: C.inkDim, fontFamily: FONT.body, fontSize: 14, lineHeight: 21 }}>{r.advice}</Text>
        </View>
      ))}
    </View>
  )
}
