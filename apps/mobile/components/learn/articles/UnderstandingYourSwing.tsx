import { Text, View } from 'react-native'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import {
  ArticleHeader,
  ArticleFooter,
  BulletList,
  DefRow,
  Em,
  Figure,
  GlanceBox,
  H3,
  Hr,
  Link,
  P,
  Sources,
  Strong,
  C,
} from '../primitives'

export function UnderstandingYourSwingArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Improving your game · Draft"
        title="The ball doesn't lie."
      />

      <P>
        You don't need a coach behind you or a launch monitor in front of you to
        know what your swing just did. Every shot leaves evidence — the line the
        ball starts on, the way it curves, the divot in front of it, the mark on
        the face — and that evidence is a readout of what the club was doing at
        impact. Learn to read it and you can diagnose your own swing on any range
        in the world. The companion <Em>self-diagnosis</Em> guide helps you find{' '}
        <Em>which</Em> part of your game is leaking strokes; this one is about
        reading <Em>what</Em> your swing is actually doing once you're there.
      </P>

      <Hr />

      <H3>Start line and curve: the two-number readout</H3>
      <P>
        Modern launch-monitor data overturned what most of us were taught. Two
        things at impact write the whole shot:
      </P>
      <GlanceBox label="What writes the shot">
        <DefRow term="Face angle" first>
          Where the ball starts. At impact the face sets roughly three-quarters
          of the start line — more at slower speeds.
        </DefRow>
        <DefRow term="Face vs. path">
          How the ball curves. The gap between where the face points and where
          the club is travelling tilts the spin: open to the path curves away,
          closed to it draws back.
        </DefRow>
      </GlanceBox>
      <P>
        So read every ball as two separate facts. <Strong>Where it starts</Strong>{' '}
        is mostly your face. <Strong>How it curves</Strong> is the gap between
        face and path. A shot that starts left and slices back right, for
        instance, means the face was pointed left of the target but still open
        relative to an even-more-leftward path — the classic out-to-in pull-slice.
        The ball just told you both numbers; you only had to listen.
      </P>

      <Figure caption="The ball starts where the face points, then bends by the gap between face and path. Two facts, read off one shot.">
        <BallFlightDiagram />
      </Figure>

      <Hr />

      <H3>The divot tells you the rest</H3>
      <P>
        With an iron, the turf is a second instrument. On solid contact the divot
        begins <Em>after</Em> the ball, not under it — proof you struck the ball
        first and the low point of your arc was ahead of it. Beyond that, the
        divot's shape and direction fill in the path your ball flight implied:
      </P>
      <BulletList
        items={[
          <Text>
            <Strong>Direction.</Strong> A divot pointing left of target is the
            fingerprint of an out-to-in (over-the-top) path; one pointing right
            signals in-to-out. It should roughly agree with the curve you read off
            the ball.
          </Text>,
          <Text>
            <Strong>Depth and evenness.</Strong> A deep, gouged divot says your low
            point is too far forward or your attack too steep; no divot at all
            usually means you're bottoming out behind the ball. A divot deeper on
            the toe or heel side points at how the club is delivered, not just where
            it lands.
          </Text>,
          <Text>
            <Strong>Where it starts.</Strong> A divot that begins well behind the
            ball is the turf-side version of fat contact — the arc bottomed out
            early.
          </Text>,
        ]}
      />

      <Hr />

      <H3>The strike fills in the blanks</H3>
      <P>
        Where on the face you make contact is the cheapest data in golf to
        collect: a dusting of foot spray, face tape, or even the wear pattern on a
        dirty clubface shows it. Toward the toe or heel explains distance you
        can't account for and a surprising amount of curve; high or low on the
        face explains a shot that flew or ballooned for no obvious reason. A
        scattered strike pattern, like a scattered ball flight, points back at the
        fundamentals — setup, posture, balance — rather than any one swing move.
      </P>

      <Hr />

      <H3>Three reads, one cause</H3>
      <P>
        The skill isn't any single read — it's that the ball, the divot, and the
        strike almost always converge on the same story. A pull that curves right,
        a divot aimed left, and a strike toward the heel are three witnesses to
        one out-to-in delivery, not three separate problems. Find where they agree
        and you've found the cause worth working on. And as the self-diagnosis
        guide stresses: chase the <Em>pattern</Em>, not the one ugly shot. A miss
        that repeats is a swing trait you can read and fix; a miss that's different
        every time is a fundamentals problem hiding upstream.
      </P>

      <Hr />

      <H3>When the read runs out</H3>
      <P>
        Reading your swing and <Em>changing</Em> it are different skills. You can
        often diagnose the cause — an open face, a steep path — long before you
        can reliably fix it, and that's exactly the moment a good coach earns
        their fee. Walk in able to say "I start it left and it slices, my divots
        point left" and you've handed them the diagnosis and bought yourself a far
        more useful hour. The companion guides on lessons and on the questions to
        ask your coach pick up from there. Until then: the ball doesn't lie. Learn
        its language and you're never completely in the dark about your own swing.
      </P>

      <Sources
        items={[
          {
            name: 'The modern ball-flight laws',
            note: (
              <Text>
                <Link href="https://support.trackmangolf.com/hc/en-us/articles/5089892383515-Practice-Trackman-Data-Parameter-Definitions">
                  TrackMan · data parameter definitions (face angle, club path)
                </Link>{' '}
                and{' '}
                <Link href="https://theleftrough.com/new-ball-flight-laws/">
                  a plain-English explainer of the new ball-flight laws
                </Link>{' '}
                — the face sets the start line; the face-to-path gap sets the
                curve.
              </Text>
            ),
          },
          {
            name: 'Reading path from the ball and the divot',
            note: (
              <Text>
                <Link href="https://www.golfwrx.com/251459/use-the-new-ball-flight-laws-to-understand-your-tendencies/">
                  GolfWRX · using the ball-flight laws to read your own tendencies
                </Link>{' '}
                — translating start line, curve, and divot direction back into
                face and path.
              </Text>
            ),
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed May 2026 · Draft, needs coaching review
      </ArticleFooter>
    </View>
  )
}

// Editorial line-art: the ball starts on the face line, then curves as the
// face-to-path gap tilts the spin. Accent on the curving flight. Same viewBox
// and coordinate data as the web inline svg, re-authored in react-native-svg.
function BallFlightDiagram() {
  return (
    <Svg width="100%" height={120} viewBox="0 0 220 120">
      {/* target line (dashed) */}
      <Line x1={40} y1={108} x2={40} y2={14} stroke={C.mute} strokeWidth={1} strokeDasharray="3 3" />
      <Circle cx={40} cy={108} r={3} fill={C.ink} />
      {/* start line — straight, along the face direction */}
      <Line x1={40} y1={108} x2={92} y2={20} stroke={C.mute} strokeWidth={1.5} />
      {/* actual curving flight (accent) — starts on the face line then bends */}
      <Path d="M40 108 Q 84 40 150 44" fill="none" stroke={C.accent} strokeWidth={2.5} />
      <SvgText x={58} y={100} fontSize={7} fontFamily="monospace" letterSpacing={0.5} fill={C.mute}>
        TARGET
      </SvgText>
      <SvgText x={86} y={16} fontSize={7} fontFamily="monospace" letterSpacing={0.5} fill={C.mute}>
        START = FACE
      </SvgText>
      <SvgText x={120} y={58} fontSize={7} fontFamily="monospace" letterSpacing={0.5} fill={C.accent}>
        CURVE = FACE vs PATH
      </SvgText>
    </Svg>
  )
}
