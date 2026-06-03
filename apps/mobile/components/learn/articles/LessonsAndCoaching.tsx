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
  BODY,
} from '../primitives'
import { FONT } from '../../../lib/typography'

export function LessonsAndCoachingArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Working with coaches · Draft"
        title="Lessons and coaching."
      />

      <H3>Most golfers waste the lesson hour</H3>
      <P>
        A golf lesson is one of the highest-leverage hours you can spend on your
        game — and most golfers either never book one or get almost nothing out
        of the ones they do. They show up cold, collect a tip, never practice
        it, slide back to their old swing within a week, and conclude that
        "lessons don't work for me." The lesson worked fine. The hour around it
        didn't. This guide is about both halves: choosing a teacher worth your
        money, and setting yourself up to actually keep what they give you.
      </P>

      <Hr />

      <H3>What the letters after a name mean — and don't</H3>
      <P>
        Certifications tell you someone cleared a bar. They don't tell you
        whether that person is the right teacher for <Em>you</Em>.
      </P>
      <BulletList
        items={[
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>PGA / LPGA.</Strong> A PGA of America or LPGA teaching
            professional has completed a long training and testing program and
            knows the game deeply. It's a real credential — and a broad one. It
            certifies competence and seriousness, not that this particular coach
            communicates in a way that clicks for you.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>TPI (Titleist Performance Institute).</Strong> A
            TPI-certified instructor is trained in the "body-swing connection" —
            they screen your physical mobility and limitations first, so they're
            less likely to prescribe a position your body literally cannot reach.
            Useful if you've got an injury history or wonder why a textbook move
            feels impossible.
          </Text>,
        ]}
      />
      <P>
        Treat any certification as a floor, not a ceiling. The best teacher you
        ever have might have a wall of letters or just a long line of students
        who got better. The credential gets them on your shortlist; the next few
        questions decide whether they make the cut.
      </P>

      <Hr />

      <H3>Questions worth asking before you book</H3>
      <P>
        You're hiring someone. It's fair — and smart — to interview them first.
        A quick email or phone call answers most of this:
      </P>
      <BulletList
        items={[
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>What's your teaching philosophy?</Strong> A good teacher can
            answer in a sentence or two. Vagueness here is a warning.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Do you use video and a launch monitor?</Strong> You want
            someone who measures, not just eyeballs and guesses.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>How do you structure things — one-offs or a series?</Strong>{' '}
            The honest answer is almost always a series, and you want a coach who
            says so.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Who do you mostly teach?</Strong> A coach who lives with
            competitive players may not be the right fit for a nervous beginner,
            and vice versa.
          </Text>,
        ]}
      />

      <Hr />

      <H3>Green flags and red flags</H3>
      <P>
        Once you're in front of someone — or watching a few minutes of how they
        teach online — the difference between a teacher who'll help you and one
        who won't is usually obvious within a lesson:
      </P>

      <FlagColumns />

      <Hr />

      <H3>Online or in person?</H3>
      <P>
        In-person lessons give a coach hands-on feedback in real time — they can
        feel your grip, move you into a position, and react to a shot the second
        it happens. That's hard to beat for first-time fundamentals and anything
        kinesthetic. Online coaching — you send swing videos, they send back a
        breakdown — is cheaper, fits any schedule, and lets you work with a
        specialist who isn't within driving distance. It leans on you to film
        well and to self-apply between notes.
      </P>
      <P>
        For a lot of golfers the best answer is both: in person to set the
        direction and learn the feel, online to maintain it and stay
        accountable between range trips.
      </P>

      <Hr />

      <H3>Show up ready</H3>
      <P>
        How much you get out of an hour is mostly decided before it starts.
      </P>
      <BulletList
        items={[
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Bring your own clubs.</Strong> They're what you actually
            play, fitted (or mis-fitted) to you. A coach learns a lot from them.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Bring your phone.</Strong> You'll want video to review later,
            and your own footage of the feels they give you.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Tell them the truth up front:</Strong> your goals, your
            typical miss, what's been bothering you, and what you actually shoot.
            The more specific, the faster they can help.
          </Text>,
          <Text style={{ ...BODY, marginBottom: 0 }}>
            <Strong>Take notes</Strong> — during the lesson or the moment it
            ends. The clarity you feel walking off the range fades startlingly
            fast by the next day.
          </Text>,
        ]}
      />

      <Hr />

      <H3>Feel isn't real</H3>
      <P>
        This is the single most useful thing to understand about taking
        instruction: what a change <Em>feels</Em> like and what the camera
        actually shows are almost never the same. When a coach asks you to feel
        something that seems wildly exaggerated, they're usually using that gap
        on purpose — the feeling that produces the correct position often feels
        like a gross overcorrection. Don't argue with the feel and don't trust
        it either. Trust the checkpoint — the video, the launch-monitor number,
        the ball flight — and let the feel be whatever gets you there.
      </P>

      <Hr />

      <H3>Why you might get worse before you get better</H3>
      <P>
        A genuine swing change means overwriting a motor pattern your brain has
        grooved over years. For a while the old pattern is fading and the new
        one hasn't taken hold, so you're caught in between — contact gets clumsy,
        the odd shot flies sideways, and your scores can dip. This is a normal,
        predictable stage of learning a new movement, not a sign the lesson
        failed or the teacher was wrong.
      </P>
      <Callout>
        <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
          <Strong>So plan for the dip.</Strong> Commit to a set number of
          practice sessions on the change before you judge it, expect a rough
          patch in the middle, and don't carry a half-built swing into a round
          that matters. The most common way golfers waste a good lesson is
          bailing on the change the first time it costs them a few shots.
        </Text>
      </Callout>

      <Hr />

      <H3>One lesson rarely fixes anything</H3>
      <P>
        Skill change comes from reps and feedback loops, not a single
        revelation on a Tuesday. Going in expecting to be "fixed" in an hour is
        the surest way to be disappointed. Commit to a block instead — say three
        to five lessons over a couple of months — and judge the teacher on the
        block, not the first session.
      </P>
      <P>
        Between lessons, practice exactly what they gave you, not the new tip
        you stumbled onto on YouTube that week — mixing coaches mid-change is how
        you end up with no swing at all. At the end of the block, take stock: is
        my miss smaller, are my numbers or scores trending the right way, do I
        understand what I'm doing and why? If the answer is yes, keep going. If
        there's no plan, no progress after honest effort, or you simply never
        understand the language they teach in, it's fair to move on.
      </P>

      <Hr />

      <H3>Coaching yourself between lessons</H3>
      <P>
        You can do a surprising amount of your own checking with a phone and a
        little honesty. Film two angles: <Strong>down the line</Strong> (camera
        directly behind you, on the target line) and <Strong>face on</Strong>{' '}
        (straight in front). They show different things — the down-the-line view
        reveals swing plane and path, the face-on view shows sway, weight, and
        ball position. Compare yourself to the checkpoints your coach gave you,
        not to a tour pro built nothing like you.
      </P>
      <P>
        Data does the same job for the parts you can't see. A launch monitor —
        Trackman, a Garmin unit, whatever you can borrow — or your own
        round-tracking turns "I think I'm better" into evidence you can act on.
        And the most useful thing you can carry into a lesson is a clear read on
        where you're actually losing shots.
      </P>
      <Callout>
        <Text style={{ color: C.ink, fontFamily: FONT.body, fontSize: 14, lineHeight: 22 }}>
          <Strong>Walk in with a diagnosis, not a complaint.</Strong> "I'm
          hitting it bad" burns the first ten minutes of the hour. "My strokes
          gained data says I lose about 1.2 shots a round on approach, and my
          miss is right" points the lesson straight at the leak. If you track
          your rounds in OGA, you arrive with that read already done — and the
          coach spends the hour fixing instead of interviewing.
        </Text>
      </Callout>

      <Hr />

      <H3>The bottom line</H3>
      <P>
        Pick a teacher who measures, explains the why, and sends you away with a
        plan. Show up with your clubs, your numbers, and the truth about your
        miss. Expect to get a little worse before you get better, and don't quit
        the change in the dip. Do that and a lesson stops being a tip you forget
        by Saturday and becomes the fastest way there is to actually get better.
      </P>

      <Sources
        items={[
          {
            name: 'Titleist Performance Institute · About Certification',
            href: 'https://www.mytpi.com/certification/about',
            note: (
              <Text>
                on the body-swing-connection approach and physical screening;{' '}
                <Link href="https://www.pga.com/things-to-do/coaches">
                  PGA of America · Coaches
                </Link>{' '}
                for what a PGA teaching professional is and how to find one.
              </Text>
            ),
          },
          {
            name: 'HackMotion · Worse After Golf Lessons?',
            href: 'https://hackmotion.com/worse-after-golf-lessons/',
            note: '— the temporary performance dip is a normal stage of overwriting a grooved motor pattern: the old swing fades before the new one takes hold, so contact gets clumsy in the middle. Expected, not a failure.',
          },
        ]}
      />

      <ArticleFooter>Last reviewed May 2026 · Draft, needs review</ArticleFooter>
    </View>
  )
}

// Side-by-side "look for / walk away from" cards. Single-column stacked on
// phone. Palette stays in the house earth tones — the accent green marks the
// column you want, a muted ink marks the one you don't. No red; the labels
// carry the meaning. Keeps the ✓ / · glyphs and the green/amber accent split.
function FlagColumns() {
  return (
    <View style={{ marginBottom: 14, gap: 12 }}>
      <FlagCard
        label="Look for"
        accent
        items={[
          'Ties every change to ball flight — what it does, not just how it looks',
          'Gives you a feel AND a checkpoint you can verify on your own',
          'Sends you off with a clear practice plan',
          'Explains the why, so you could re-teach it to a friend',
          'Asks about your goals and your typical miss before touching your swing',
        ]}
      />
      <FlagCard
        label="Walk away from"
        items={[
          'Only tells you what’s wrong, never how to fix it',
          'One identical swing prescribed to every student',
          'No video, no launch monitor — all eyeball and opinion',
          'Jargon with no translation into something you can do',
          'Promises a quick, one-lesson fix',
        ]}
      />
    </View>
  )
}

function FlagCard({
  label,
  items,
  accent,
}: {
  label: string
  items: string[]
  accent?: boolean
}) {
  const edge = accent ? C.accent : C.line
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: edge,
        backgroundColor: C.boxBg,
        borderRadius: 2,
        padding: 14,
      }}
    >
      <Text
        style={{
          ...KICKER,
          color: accent ? C.accent : C.inkDim,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: edge,
        }}
      >
        {label}
      </Text>
      <View>
        {items.map((item) => (
          <View
            key={item}
            style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}
          >
            <Text
              style={{
                color: accent ? C.accent : C.mute,
                fontFamily: FONT.body,
                fontSize: 13.5,
                lineHeight: 20,
              }}
            >
              {accent ? '✓' : '·'}
            </Text>
            <Text
              style={{ color: C.ink, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20, flex: 1 }}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
