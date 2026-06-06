import { Text, View } from 'react-native'
import {
  ArticleFooter,
  ArticleHeader,
  BulletList,
  DevNote,
  H3,
  H4,
  Hr,
  Link,
  P,
  Sources,
} from '../primitives'

export function CourseManagementArticle() {
  return (
    <View>
      <ArticleHeader kicker="On the course · Course management" title="Course management." />

      <H3>You are not on the range anymore</H3>
      <P>
        The driving range is where you work on your golf swing. The
        golf course is where you work on your score. These are two
        different activities requiring two different mindsets.
      </P>
      <P>
        On the range, perfect is the goal. On the course, useful is
        the goal. The player who shoots 78 with ugly but functional
        golf beats the player who shoots 84 hitting it beautifully.
        Score is the only thing the card cares about.
      </P>
      <P>
        The moment you step onto the first tee, stop being a golfer
        working on your swing and become a player trying to shoot
        the lowest number possible with the tools you have today.
        Your clubs are tools to get the ball in the hole. Not every
        shot needs to be pretty. It just needs to work.
      </P>

      <Hr />

      <H3>Know your game, not your best game</H3>
      <P>
        Course management starts with brutal honesty about what you
        actually do — not what you're capable of on a perfect day.
      </P>
      <P>
        Every player has tendencies. You probably miss in a
        predictable direction. You probably have a club you don't
        fully trust. You probably have a shot shape that shows up
        under pressure whether you want it or not.
      </P>
      <P>
        The player who knows they hit a soft fade under pressure and
        plays for it will outscore the player who aims straight and
        gets "surprised" by the same fade every time.
      </P>
      <P>Before you play, know:</P>
      <BulletList
        items={[
          'Your predominant miss direction',
          "Which clubs you genuinely trust vs which ones you're hoping work out",
          'How far you actually carry the ball — not your best carry, your reliable carry',
          'Where your game breaks down under pressure',
        ]}
      />
      <P>
        Your OGA strokes gained data tells you this more clearly
        than your gut does. If SG approach is -1.4 per round, your
        irons are leaking. If SG putting is +0.8, your putter is an
        asset. Play accordingly.
      </P>

      <Hr />

      <H3>The confidence club rule</H3>
      <P>
        For any shot on the course, choose the club you can hit the
        shot you need 8 times out of 10. Not the club that gets you
        there if you pure it. Not the club that's technically correct
        on paper. The club you trust.
      </P>
      <P>
        Standing over a shot with doubt is one of the most expensive
        things you can do in golf. A committed swing with the "wrong"
        club almost always beats a tentative swing with the "right"
        one. If you're between clubs and one of them makes you
        nervous — hit the other one. Every time.
      </P>
      <P>
        Off the tee: hit the longest club you can confidently keep
        in play. That is it. You don't need a perfect drive. You
        need a ball in play. A 220-yard drive in the fairway beats a
        280-yard drive in the trees every single time. Driver is not
        always the answer and there is no shame in hitting 3-wood or
        hybrid off the tee on a tight hole. The Playa doesn't care
        what club anyone else is hitting. The Playa cares about the
        score.
      </P>

      <Hr />

      <H3>The Way of the Playa</H3>
      <P>
        Golf content creator Golf Sidekick has articulated a
        philosophy called the Way of the Playa that every amateur
        should understand. The core idea is simple: your ego is the
        most expensive thing in your bag.
      </P>
      <P>
        The Playa doesn't care about looking good. The Playa doesn't
        care what club other people are hitting or whether the shot
        looks impressive. The Playa cares about one thing — getting
        the ball in the hole in as few strokes as possible — and
        makes every decision in service of that goal.
      </P>
      <P>In practice this looks like:</P>
      <BulletList
        items={[
          'Hitting 3-wood off the tee when driver puts you in trouble',
          'Laying up short of a hazard even when you think you can probably carry it',
          'Chipping out sideways without shame when trees are in the way',
          'Playing to the fat part of the green instead of attacking a tucked pin',
          'Accepting the penalty and moving on instead of compounding the mistake',
        ]}
      />
      <P>
        None of these decisions feel exciting. All of them save
        strokes.
      </P>
      <P>
        The Playa understands that golf is not a contest of who hits
        the most impressive shots. It's a contest of who takes the
        fewest. These are different games and most amateurs are
        playing the wrong one.
      </P>
      <DevNote variant="research">
        Golf Sidekick — YouTube. Search "Way of the Playa." Practical,
        ego-free approach to scoring.
      </DevNote>

      <Hr />

      <H3>Aim at the center of the green</H3>
      <P>
        This is a simple rule that will immediately save you strokes.
      </P>
      <P>
        Most amateur golfers aim at the pin. The pin is rarely in
        the center of the green. This means most amateur golfers are
        constantly playing the hardest target available — the one
        with the least margin for error.
      </P>
      <P>
        Aim at the center of the green unless you have a very
        specific, very good reason not to. The center of the green
        is always a good shot. It never leaves you with a chip from
        the wrong side. It gives you the most margin for your miss.
      </P>
      <P>
        A birdie putt from 25 feet is still a birdie putt. What you
        won't have is a chip from the rough, or a three-putt from 60
        feet, or a false front situation because you were attacking
        a back left pin from 170 yards.
      </P>

      <Hr />

      <H3>Plan the hole backwards</H3>
      <P>
        Most amateurs walk up to the tee and hit their driver as far
        as they can, then figure out what to do next. This is
        reactive golf. It works well enough on straightforward holes
        and falls apart on anything with a hazard, a difficult
        green, or a premium on position.
      </P>
      <P>
        The better approach is to plan the hole in reverse —
        starting at the pin and working back to the tee.
      </P>
      <P>
        Start on the green. Where is the pin today? Is it tucked
        behind a bunker, on a shelf, near a false front? Now ask:
        where on the green do I want to be putting from? That tells
        you the ideal approach angle and the ideal landing zone for
        your approach shot.
      </P>
      <P>
        Now work back one more shot. To hit the approach from that
        ideal spot, where does your previous shot need to land?
        What's the right side of the fairway? What distance leaves
        you a comfortable full shot rather than an awkward partial?
      </P>
      <P>
        Now you know where your tee shot needs to go. Not just "in
        the fairway" — a specific zone that sets up everything that
        follows.
      </P>
      <P>
        On a par 5: the same logic applies across three shots
        instead of two. Where do you want to be for your pitch or
        third shot? What does the layup need to accomplish to get
        you there? Where does the tee shot need to go to make the
        layup straightforward?
      </P>
      <P>
        This is how caddies think. This is how tour professionals
        think. And it's available to any amateur willing to spend 60
        seconds on the tee thinking before swinging.
      </P>
      <P>
        The practice round is where you build this map. Walk the
        hole from green to tee. Stand where the approach shot will
        be played from and look back at the fairway — you'll see
        angles and landing zones you never noticed from the tee.
        That knowledge compounds over time. Players who know a
        course well aren't lucky. They've done this work.
      </P>

      <Hr />

      <H3>Your free throw range</H3>
      <P>
        Every player has a distance where they feel genuinely
        comfortable — a yardage where they know, without much doubt,
        that they can get the ball close. This is your free throw
        range.
      </P>
      <P>
        For most amateurs it's somewhere between 50 and 100 yards.
        For better players it might be 100-120. Whatever yours is,
        identify it honestly.
      </P>
      <P>
        Now start playing shots to leave yourself that number rather
        than just maximizing distance on every shot. Course
        management is partly about engineering the right approach
        shot.
      </P>
      <P>
        A 60-yard full wedge from a clean lie is easier than an
        85-yard partial wedge from an awkward distance. Partial
        wedge shots are hard. Full swing wedges are repeatable.
        Don't manufacture difficult shots when strategy can avoid
        them.
      </P>
      <P>
        Off the tee on a long par 4: consider what club leaves you a
        full shot in your free throw range rather than just
        grip-and-ripping driver. On a par 5: a layup to your number
        beats going for it from 230 yards with a marginal lie.
      </P>

      <Hr />

      <H3>The Scoring Method and the Scoring Zone</H3>
      <P>
        Will Robins, PGA member and Golf Digest Best Young Teachers
        honoree, developed a course management system called The
        Scoring Method that reframes how amateurs think about every
        hole.
      </P>
      <P>
        The core concept is the Scoring Zone — a distance close
        enough to the green that you're confident you can finish the
        hole in 3 more shots or fewer. For most beginners and high
        handicappers, start at 75 yards. As your game improves,
        tighten it.
      </P>
      <P>
        The Scoring Method tracks just two things per hole on a
        modified scorecard:
      </P>
      <H4>1. Did you reach the Scoring Zone in two shots?</H4>
      <P>
        After your first two shots, are you inside your distance?
        Yes or no.
      </P>
      <H4>
        2. Did you get up and down in 3 shots or fewer from the
        Scoring Zone?
      </H4>
      <P>
        Once inside your zone, did you convert? Or did you take 4
        from there?
      </P>
      <P>
        Track these two numbers for a few rounds and patterns emerge
        fast. Most amateurs discover they're actually reaching the
        Scoring Zone regularly — the problem is converting once they
        get there. That tells you exactly where to practice.
      </P>
      <P>
        The deeper power of this system is that it shifts your
        measure of success away from score and toward process. A
        player who reaches the Scoring Zone in two shots and
        converts every time will shoot in the 80s almost regardless
        of how their ball-striking looks. The system shows you what
        actually matters hole by hole.
      </P>
      <DevNote variant="research">
        Will Robins — The Scoring Method. thescoringmethod.com and
        YouTube @thescoringmethod
      </DevNote>

      <Hr />

      <H3>Think target, not trouble</H3>
      <P>
        When you stand over a shot thinking "don't hit it in the
        water" — you are thinking about the water. Your brain
        doesn't process the "don't" particularly well. You are
        programming yourself to think about exactly what you want to
        avoid.
      </P>
      <P>
        Instead: pick a specific, positive target. Not "away from
        the bunker" but "at that tree on the left edge of the
        fairway." A specific target gives your brain and body
        something to work toward rather than something to flee from.
      </P>
      <P>
        Manu from The Upbeat Golfer talks extensively about this —
        committing fully to a target and a process before stepping
        into the ball, then letting go of the result. The shot is
        decided before you address it. Doubt after you've committed
        is the enemy. Indecision kills golf shots more reliably than
        poor mechanics.
      </P>
      <DevNote variant="research">
        The Upbeat Golfer (Manu) — YouTube. Process-driven approach,
        target commitment, playing without fear.
      </DevNote>

      <Hr />

      <H3>Never make two mistakes in a row</H3>
      <P>
        You will hit bad shots. Every player at every level hits bad
        shots. A bad shot is not a crisis — it's golf.
      </P>
      <P>
        What turns a bad shot into a big number is the decision that
        follows it.
      </P>
      <P>
        After a bad shot, your only job is to get back into
        position. Not to make up for it. Not to be a hero. Not to
        erase it. Just to get somewhere you can play a normal golf
        shot from.
      </P>
      <P>Punch out. Accept the bogey. Move on.</P>
      <P>
        The double bogey that becomes a triple happens because the
        player tried to thread the needle through the trees instead
        of punching out sideways. The bogey that becomes a triple
        happens because the player went for the green from an
        impossible lie when laying up was obviously the right call.
      </P>
      <P>
        A bogey is one over par. A triple is three over. The shots
        themselves might be identical — the decisions are what
        separate them. The Playa takes his medicine every time. The
        Playa never follows a bad shot with a stupid shot.
      </P>

      <Hr />

      <H3>Be process-driven, not results-driven</H3>
      <P>
        Most golfers think too little on the golf course. They step
        up to the ball, swing, and react emotionally to wherever it
        goes. There's no plan and no process.
      </P>
      <P>
        But there's an opposite problem: once golfers start trying
        to improve, they often start thinking too much. They
        outthink themselves — grinding over swing thoughts, worrying
        about mechanics, replaying the last bad shot — because they
        aren't yet good enough to execute what they're thinking
        about. Analysis paralysis is just as damaging as
        mindlessness.
      </P>
      <P>
        The sweet spot is a clear, repeatable pre-shot process:
      </P>
      <BulletList
        items={[
          'Pick a specific target',
          'Commit fully to the shot',
          'Go through your routine',
          'Pull the trigger',
        ]}
      />
      <P>
        That's it. You don't need to solve the hole. You need to
        play one shot at a time with full commitment.
      </P>
      <P>
        Try tracking — alongside your score — whether you committed
        to each shot. Not whether it went where you wanted. Whether
        you actually went through your process and pulled the
        trigger without doubt.
      </P>
      <P>
        Players who track this consistently find their scores drop
        naturally. Not because they're grinding harder on results,
        but because they've replaced reactive, emotional golf with a
        repeatable approach. Results-oriented thinking leads to
        tension, steering, and the exact outcome you were afraid of.
        Process-oriented thinking gives you the best chance of
        executing the shot.
      </P>

      <Hr />

      <H3>The practice round</H3>
      <P>
        Course management is not something you can learn sitting in
        a cart or watching videos. It's learned by doing — and the
        practice round is where you do it.
      </P>
      <P>
        Play two balls off the tee on every hole. Hit the aggressive
        line you want to hit and the conservative line you think you
        should hit. See which one actually leaves you the better
        approach. You will be surprised how often the conservative
        play gives you just as good an angle — sometimes better.
      </P>
      <P>
        From trouble, play a second ball both ways. Hit the hero
        shot you were tempted to play AND the safe punch-out. See
        what actually happens. Most of the time the hero shot costs
        you more than the punch-out. Your gut will stop suggesting
        it so often once your eyes have seen the real results.
      </P>
      <P>
        Use the practice round to find your Scoring Zone entry
        points on each hole. Where do you need to be after two shots
        to have a comfortable third? Work backwards from there to
        plan your tee shot.
      </P>
      <P>
        A practice round played thoughtfully and with intention is
        worth more for course management than ten range sessions.
        The course is the classroom.
      </P>

      <Hr />

      <H3>Keep it simple</H3>
      <P>
        The fundamentals that will lower your score, in order of
        importance:
      </P>
      <BulletList
        items={[
          'Ball in play off the tee with the longest club you trust',
          'Plan the hole backwards from the pin before you swing',
          "Think about your target, not about where you can't go",
          'Aim at the center of the green',
          'Play to your free throw range',
          'Commit to every shot through your full routine',
          'Never follow a bad shot with a dumb shot',
          'Take your medicine, make your bogey, move on',
        ]}
      />
      <P>
        That's course management for most amateurs. It's not
        complicated. It's just hard to actually do when there's
        water on the left and your playing partners are watching.
      </P>
      <P>
        The Way of the Playa is not a swing philosophy. It's a
        mindset. And it's available to every player at every level
        starting on the very next round they play.
      </P>

      <Hr />

      <Sources
        items={[
          {
            name: 'Course-management approaches this article draws on',
            note: (
              <Text>
                Golf Sidekick's "Way of the Playa"; Will Robins' Scoring Method
                (
                <Link href="https://thescoringmethod.com">thescoringmethod.com</Link>
                ), the Scoring Zone framework and modified scorecard; and Bob
                Rotella's "Golf Is Not a Game of Perfect" — practitioner
                frameworks for ego-free, score-first decision making.
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

