import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import {
  ArticleHeader,
  ArticleFooter,
  BulletList,
  Em,
  H3,
  Hr,
  Link,
  P,
  Sources,
  Strong,
  Subhead,
  C,
} from '../primitives'

export function SelfDiagnosisArticle() {
  return (
    <View>
      <ArticleHeader kicker="On the course · Draft" title="Self-diagnosis." />

      <H3>You know something is off</H3>
      <P>
        Most golfers can feel that a part of their game is leaking shots. Far
        fewer can say what is actually happening — and that gap is the
        difference between fixing a problem and flailing at it. "I'm playing
        bad" is not a diagnosis. "I lose most of my strokes on approach, my miss
        is a push to the right with the mid-irons, and it gets worse when I bear
        down" is a diagnosis. A diagnosis points at a fix.
      </P>
      <P>
        This guide hands you the vocabulary and the framework to read your own
        game. You don't need a coach behind you and you don't need a launch
        monitor. You need to watch where your ball actually goes, round after
        round, and be honest and specific about the pattern. The work here is
        noticing — not judging.
      </P>

      <Hr />

      <H3>Start where the strokes leak</H3>
      <P>
        Golf hands you four bills to pay every round: the tee shot, the
        approach, the short game, and the putter. Before you diagnose a swing,
        find out which bill is bleeding you. Spending an afternoon fixing your
        driver when you three-putt six times a round is solving a problem you
        don't have.
      </P>
      <P>
        If you track strokes gained, this is already answered for you — whichever
        category is most negative is where to look first. If you don't track
        anything, you can still eyeball it over three or four rounds:
      </P>
      <BulletList
        items={[
          <Text>
            <Strong>Off the tee</Strong> — how often does a tee shot cost you a
            penalty stroke or a chip-out sideways?
          </Text>,
          <Text>
            <Strong>Approach</Strong> — how often do you miss the green, and when
            you miss, is it by a little or by a lot?
          </Text>,
          <Text>
            <Strong>Short game</Strong> — when you miss a green, how often do you
            get up and down in two?
          </Text>,
          <Text>
            <Strong>Putting</Strong> — how many putts a round, and how many of
            those are three-putts?
          </Text>,
        ]}
      />
      <P>
        Whichever answer makes you wince is your starting point. Diagnose that
        area first and ignore the rest for now. You can only rebuild one wall at
        a time.
      </P>

      <Hr />

      <H3>Four questions for any miss</H3>
      <P>
        Once you know the area, the same four questions crack open almost any
        ball-flight problem. Ask them in order. Each answer narrows the field.
      </P>

      <DiagnosticFlow />

      <Subhead>1. What is your typical miss?</Subhead>
      <P>
        Name it precisely. Direction misses — <Em>push, pull, slice, hook</Em> —
        are mostly a story about your clubface and your swing path at impact.
        Contact misses — <Em>fat, thin, toe, heel</Em> — are mostly a story about
        where the bottom of your swing arc lives. A "bad shot" is useless
        information. "A pull that starts left and stays left" tells you the face
        was closed to your target. Specificity is the whole game here.
      </P>

      <Subhead>2. Is it consistent or random?</Subhead>
      <P>
        This is the most important question and the most encouraging one. A{' '}
        <Strong>consistent</Strong> miss — the same shape almost every time — is
        a pattern, and a pattern can be aimed around or adjusted out. That is
        good news. A <Strong>random</Strong> miss — left, then right, then fat,
        with no rhyme — usually points further back, at contact and fundamentals:
        grip, posture, alignment, or balance changing from swing to swing.
        Consistency is a sign you are closer to fixed than you feel.
      </P>

      <Subhead>3. Does it get worse under pressure?</Subhead>
      <P>
        If a miss only shows up on the first tee, over water, or when you are
        trying to protect a good score, the cause is often tension and tempo, not
        technique. Pressure speeds people up and tightens the hands. A swing that
        works on the range and falls apart on the card is rarely a mechanical
        problem — it is a rhythm-and-grip-pressure problem wearing a mechanical
        costume.
      </P>

      <Subhead>4. All clubs, or specific ones?</Subhead>
      <P>
        A miss that shows up with <Strong>every club</Strong> is systemic —
        something in your setup or motion that travels with you: grip, posture,
        alignment, ball position. A miss isolated to <Strong>one club</Strong> is
        usually about that club specifically — the driver's length and low loft
        exaggerate whatever your hands do, a particular wedge you don't trust, a
        long iron most amateurs simply shouldn't be carrying.
      </P>

      <Hr />

      <H3>Off the tee</H3>
      <P>
        The expensive tee misses are the ones that find penalty areas: the big
        slice and the snap hook. Run the four questions. A consistent curve in
        one direction is a face-to-path relationship you can work on or simply
        aim for in the meantime. A two-way miss — slice one hole, hook the next —
        is harder to live with and usually traces to alignment and tempo rather
        than one fixable flaw.
      </P>
      <Example
        flight="Consistent slice with the driver, but straight with the irons"
        read="The face is open to a path that's swinging across the ball, left of target — and the driver's length and low loft magnify the side-spin the irons hide. Because the irons are fine, this is rarely a whole-swing rebuild."
        focus="Check alignment first (slicers often aim further left to compensate, which steepens the across-the-ball path and feeds the slice), then check grip strength. A grip rotated too far toward the target leaves the face open at speed."
      />

      <Hr />

      <H3>Approach</H3>
      <P>
        Approach misses come in two flavors: <Em>direction</Em> (push/pull, or a
        curve) and <Em>contact</Em> (fat/thin). Direction misses behave like the
        tee — read the curve and the start line. Contact misses are about your
        low point: fat means the arc bottoms out behind the ball, thin means you
        caught it on the way up or pulled out of the shot.
      </P>
      <Example
        flight="Fat shots with the irons, especially under pressure"
        read="Catching it heavy means the low point of your swing fell behind the ball. Under pressure this is commonly weight hanging on the back foot or the hips thrusting toward the ball through impact (early extension) — both move the bottom of the arc backward."
        focus="An impact-bag drill teaches the hands and body where solid contact lives; a slow, balance-focused drill — hold your finish for three seconds on every range ball — retrains weight moving forward. Confirm with a coach if it persists, because fat contact has more than one cause."
      />

      <Hr />

      <H3>Short game</H3>
      <P>
        Around the green, the two killers are the chunk and the skull — and they
        are often the same fault from opposite directions: a low point that
        wanders because the hands try to lift the ball into the air instead of
        letting the loft do it. The fix lives in setup and a quieter, descending
        strike, not in a different club.
      </P>
      <P>
        Distance control is the other half. If your chips finish reliably short
        or reliably long, that is a consistent, fixable pattern — adjust your
        default and re-calibrate. If they scatter with no pattern, the contact is
        the problem, not the green-reading or the touch.
      </P>

      <Hr />

      <H3>Putting</H3>
      <P>
        Putting misses are easy to mislabel. Most golfers blame their read when
        the real culprit is speed. Read errors and pace errors look different on
        the green: a read error leaves you a tester on the same side most of the
        time; a pace error leaves you long and short, and it is what turns a
        routine two-putt into a three.
      </P>
      <Example
        flight="Three-putts from inside 20 feet"
        read="From that range you almost never misread the line badly enough to three-putt — the cause is pace. The first putt finishes too far past or too far short, leaving a knee-knocker you then miss."
        focus="Train speed, not line. Hit putts with your eyes closed and guess where each finished before you look; you'll sharpen the feel for distance fast. Lag drills to a tee or a coin — not a hole — keep your focus on the speed instead of the make."
      />

      <Hr />

      <H3>Consistent is fixable; random is fundamentals</H3>
      <P>
        If you take one thing from this guide, take the second question. A
        consistent miss is a friend — it is repeatable, which means it is
        understandable, which means it is fixable, and in the meantime it is
        aimable. A random miss is telling you to go back to the boring basics:
        grip, posture, alignment, ball position, balance. Nobody wants the answer
        to be "check your setup," but it usually is.
      </P>

      <Hr />

      <H3>When to bring this to a coach</H3>
      <P>
        Self-diagnosis tells you <Em>what</Em> is happening and points you at the
        likely <Em>why</Em>. It does not replace a trained eye and a camera for
        the things you cannot see in your own swing. Bring a coach a diagnosis,
        not a vague complaint — "consistent push with the mid-irons, worse under
        pressure, fine with the wedges" gets you a productive lesson far faster
        than "I'm hitting it bad." You will have done half their work for them,
        and you will know whether the fix they give you actually addresses the
        pattern you walked in with.
      </P>

      <Sources
        items={[
          {
            name: 'Ball flight — start line, curve, and why the driver curves more',
            note: (
              <Text>
                <Link href="https://www.trackman.com/blog/golf/face-to-path">
                  TrackMan · Face to Path
                </Link>{' '}
                and{' '}
                <Link href="https://www.trackman.com/blog/golf/club-path">
                  Club Path
                </Link>{' '}
                — the clubface sets roughly 85% of the start line; the
                face-to-path gap sets the curve. The driver's lower loft means a
                smaller{' '}
                <Link href="https://www.trackman.com/blog/golf/spin-loft">
                  spin loft
                </Link>
                , so the spin axis tilts more easily — which is why it curves
                more than the irons.
              </Text>
            ),
          },
          {
            name: 'Low point and fat contact',
            note: (
              <Text>
                <Link href="https://www.mytpi.com/articles/swing/why-early-extension-causes-a-reduction-of-power-in-the-golf-swing">
                  Titleist Performance Institute · Early Extension
                </Link>
                ;{' '}
                <Link href="https://golf.com/instruction/biggest-swing-mistake-amateurs-make/">
                  Golf.com on GolfTEC swing data
                </Link>
                .
              </Text>
            ),
          },
          {
            name: 'Putting — pace over read from range',
            note: (
              <Text>
                Mark Broadie, <Em>Every Shot Counts</Em> (2014);{' '}
                <Link href="https://www.pga.info/discover/latest/news/why-setting-realistic-expectations-lag-putting-key-shooting-lower-scores/">
                  PGA · lag-putting expectations
                </Link>
                .
              </Text>
            ),
          },
          {
            name: 'Pressure — why a range swing breaks on the card',
            note: (
              <Text>
                <Link href="https://www.peaksports.com/sports-psychology-blog/choking-under-pressure-in-golf/">
                  Peak Performance Sport Psychology (Dr. Patrick Cohn)
                </Link>{' '}
                and{' '}
                <Link href="https://www.trine.edu/academics/centers/center-for-sports-studies/blog/2022/choking_in_sports.aspx">
                  Trine University · choking in sport
                </Link>{' '}
                — under pressure the automatic motion is disrupted, the hands
                tighten and tempo goes; the reset is feel and rhythm, not
                mechanics.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed May 2026 · Draft, needs instructor review
      </ArticleFooter>
    </View>
  )
}

// Worked example: a real-world miss, what it tells you, and where to focus.
// Local one-off (single article) — accent-bordered card, palette C.
function Example({
  flight,
  read,
  focus,
}: {
  flight: string
  read: string
  focus: string
}) {
  return (
    <View
      style={{
        backgroundColor: C.boxBg,
        borderLeftWidth: 3,
        borderLeftColor: C.accent,
        padding: 14,
        marginBottom: 14,
        borderRadius: 2,
      }}
    >
      <Text
        style={{
          color: C.ink,
          fontSize: 16,
          fontStyle: 'italic',
          marginBottom: 8,
        }}
      >
        “{flight}”
      </Text>
      <Text style={{ color: C.inkDim, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
        <Strong>What it reads as:</Strong> {read}
      </Text>
      <Text style={{ color: C.inkDim, fontSize: 14, lineHeight: 22 }}>
        <Strong>Where to focus:</Strong> {focus}
      </Text>
    </View>
  )
}

// A compact top-down flowchart of the four questions, so a reader can scan the
// decision path even if they skip the prose that expands each one below. Short
// labels only here — the detail lives in the prose, not duplicated in the chart.
// Local one-off (single article) — RN View/Text + palette C.
function DiagnosticFlow() {
  return (
    <View style={{ marginTop: 4, marginBottom: 22 }}>
      <FlowQ n="01" q="What is your miss?" />
      <Arrow />
      <FlowRow>
        <Chip label="Direction" sub="face & path" hint="push · pull · slice · hook" />
        <Chip label="Contact" sub="low point" hint="fat · thin · toe · heel" />
      </FlowRow>
      <Arrow />
      <FlowQ n="02" q="Same shape every time?" />
      <Arrow />
      <FlowRow>
        <Chip accent label="Consistent" sub="a fixable pattern" />
        <Chip label="Random" sub="check fundamentals" />
      </FlowRow>
      <Arrow />
      <FlowQ n="03" q="Only under pressure?" />
      <Arrow />
      <FlowRow>
        <Chip label="Yes" sub="tempo, not technique" />
      </FlowRow>
      <Arrow />
      <FlowQ n="04" q="One club, or all of them?" />
      <Arrow />
      <FlowRow>
        <Chip label="One club" sub="that club's setup" />
        <Chip label="All clubs" sub="something systemic" />
      </FlowRow>
    </View>
  )
}

function FlowQ({ n, q }: { n: string; q: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 10,
          borderWidth: 1,
          borderColor: '#9F9580',
          borderRadius: 2,
          backgroundColor: C.surface,
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ fontSize: 10, letterSpacing: 1.4, color: C.mute }}>{n}</Text>
        <Text style={{ color: C.ink, fontSize: 17, fontStyle: 'italic' }}>{q}</Text>
      </View>
    </View>
  )
}

// Vertical connector with a chevron — the visual "flow" between steps.
function Arrow() {
  return (
    <View style={{ alignItems: 'center', marginVertical: 7 }}>
      <View style={{ width: 2, height: 12, backgroundColor: '#9F9580' }} />
      <Svg width={11} height={7} viewBox="0 0 11 7">
        <Path d="M1 1 L5.5 6 L10 1" fill="none" stroke="#9F9580" strokeWidth={1.5} />
      </Svg>
    </View>
  )
}

function FlowRow({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </View>
  )
}

// One branch of a question. The accent variant is a filled green chip used once,
// on the "Consistent" answer — the outcome the reader is hoping for.
function Chip({
  label,
  sub,
  hint,
  accent,
}: {
  label: string
  sub: string
  hint?: string
  accent?: boolean
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        maxWidth: 210,
        borderWidth: 1,
        borderColor: accent ? C.accent : C.line,
        backgroundColor: accent ? C.accent : C.boxBg,
        borderRadius: 2,
        paddingVertical: 9,
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: accent ? '#F2EEE5' : C.inkDim,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontStyle: 'italic',
          color: accent ? '#F2EEE5' : C.ink,
        }}
      >
        {sub}
      </Text>
      {hint ? (
        <Text
          style={{
            fontSize: 11,
            color: accent ? 'rgba(242,238,229,0.72)' : C.mute,
            marginTop: 3,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  )
}
