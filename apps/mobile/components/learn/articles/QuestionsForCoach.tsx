import { View } from 'react-native'
import {
  ArticleHeader,
  P,
  H3,
  Hr,
  BulletList,
  Callout,
  GlanceBox,
  DefRow,
  Sources,
  ArticleFooter,
  Strong,
  Em,
  Link,
} from '../primitives'

export function QuestionsForCoachArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Working with coaches · Questions for your coach"
        title="A lesson is a conversation."
      />

      <P>
        Most golfers treat a lesson as a download: stand there, collect the tip,
        nod, drive home. The ones who actually improve treat it as a conversation
        — and the questions they ask are what turn a good feeling on the range
        into a change they can still find next week. The companion guide on{' '}
        <Em>lessons and coaching</Em> covers choosing a teacher and the questions
        to ask <Em>before</Em> you book. This is the conversation once you're in
        the bay, and the handful of questions at the end that decide whether any
        of it survives the drive home.
      </P>

      <GlanceBox label="When to ask what">
        <DefRow term="Before booking" first>
          Who to hire — philosophy, video, series. Covered in the
          lessons-and-coaching guide.
        </DefRow>
        <DefRow term="While teaching">
          What the change is for, the feel and its checkpoint, and how the miss
          shows up.
        </DefRow>
        <DefRow term="Before you leave">
          The exact drill and dose, what to ignore, the dip to expect, and when
          to check back.
        </DefRow>
      </GlanceBox>

      <Hr />

      <H3>While they're teaching</H3>
      <P>
        A tip you can't reproduce on your own is worthless by Tuesday. These
        three turn a position into something portable.
      </P>
      <BulletList
        items={[
          <P style={{ marginBottom: 0 }}>
            <Strong>"What is this doing to my ball flight?"</Strong> You want the
            change tied to an outcome you can see, not just a body position.
            Research on where golfers aim their attention is unusually consistent:
            focusing on the <Em>effect</Em> of a movement — what the ball does —
            produces better results than focusing on the body part making it. If the answer is only "get your hands here," ask what
            "here" is supposed to <Em>produce</Em>.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"What's the feel, and what's the checkpoint?"</Strong> Feel
            and reality rarely match, so you want both — a feel to chase in the
            moment, and an external checkpoint you can verify alone: a video
            angle, a ball-flight window, a launch number. The feel gets you
            moving; the checkpoint keeps you honest when the coach isn't standing
            there.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"How will I know when I'm doing it wrong?"</Strong> Every new
            move has a characteristic miss. Knowing the failure mode in advance
            lets you catch yourself drifting, instead of grooving the error for
            three weeks until the next lesson.
          </P>,
        ]}
      />

      <Hr />

      <H3>Before you leave</H3>
      <P>
        The clarity you feel walking off the range fades startlingly fast. Pin it
        down before you go.
      </P>
      <BulletList
        items={[
          <P style={{ marginBottom: 0 }}>
            <Strong>"What exactly do I practice, and how much?"</Strong> A change
            without a dose is a wish. Get the specific drill and a number — reps,
            minutes, or sessions — so "practice this" becomes something you can
            schedule. Then spread it across days rather than cramming it into one
            marathon; practice spaced over time sticks far better than the same
            reps in a single grind.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"What do I ignore until next time?"</Strong> Permission to
            work on one thing is the most underrated gift a coach can give. Ask
            what to leave alone — including the new tip you'll inevitably trip
            over online this week. Mixing sources mid-change is how you end up
            with no swing at all.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"What should get worse first?"</Strong> A real swing change
            usually dips before it climbs. Ask how rough the middle gets and how
            long it lasts, so you don't abandon a good change the first time it
            costs you a few shots.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"When should we check this?"</Strong> Set the next checkpoint
            before you leave — a date, or a milestone like "once I can hit it 7 of
            10." That's what turns a one-off tip into a plan.
          </P>,
        ]}
      />

      <Callout>
        <P style={{ marginBottom: 0, fontSize: 14, lineHeight: 21 }}>
          <Strong>If you ask one question, ask this:</Strong> "If I could only
          practice one thing this week, what would it be?" It forces your coach to
          prioritize out loud and hands you the single highest-leverage rep to
          take home — the antidote to leaving with a list of six things and doing
          none of them well.
        </P>
      </Callout>

      <Hr />

      <H3>Questions that waste the hour</H3>
      <P>A few questions feel productive and aren't. Skip them.</P>
      <BulletList
        items={[
          <P style={{ marginBottom: 0 }}>
            <Strong>"What does [tour player] do here?"</Strong> Their body, speed,
            and tens of thousands of reps aren't yours. The right model is the
            checkpoint your coach set for <Em>you</Em>, not a swing built for
            someone else.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"Should I buy this club or gadget?"</Strong> A purchase or a
            fitting is a different appointment. Don't spend your most expensive
            coaching minutes on gear questions.
          </P>,
          <P style={{ marginBottom: 0 }}>
            <Strong>"Is my swing fixed now?"</Strong> One lesson rarely fixes
            anything — skill comes from reps and feedback loops, not a single
            revelation on a Tuesday. Judge the coach over a block of lessons, not
            the first hour.
          </P>,
        ]}
      />

      <Hr />

      <H3>The thread under all of it</H3>
      <P>
        A lesson isn't something done to you — it's something you steer. Ask what
        the change is <Em>for</Em>, how to verify it alone, what to ignore, and
        when to check back, and you walk out with a plan instead of a feeling.
        That's the whole difference between a tip you've forgotten by Saturday and
        a change that's still with you next season.
      </P>

      <Sources
        items={[
          {
            name: 'Focus on the ball, not the body part',
            href: 'https://gwulf.faculty.unlv.edu/wp-content/uploads/2018/11/Wulf_AF_review_2013.pdf',
            note: (
              <P style={{ marginBottom: 0, fontSize: 13, lineHeight: 19 }}>
                Wulf, International Review of Sport & Exercise Psychology (2013) ·
                attentional focus, a 15-year review, and a golf-specific test in{' '}
                <Link href="https://journals.humankinetics.com/view/journals/jmld/1/1/article-p2.xml">
                  Journal of Motor Learning & Development (2013) · external focus,
                  X-factor and carry distance
                </Link>{' '}
                — focusing on the movement's effect (the ball) beats focusing on
                the body part making it.
              </P>
            ),
          },
          {
            name: 'Space the practice you’re given',
            href: 'https://www.sciencedirect.com/science/article/abs/pii/S016794570000021X',
            note: 'Shea et al., Human Movement Science (2000) · spacing practice across days — the same reps spread over several days produce far better retention than the same total packed into one session.',
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed July 2026
      </ArticleFooter>
    </View>
  )
}
