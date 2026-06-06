import { SrcBody, SrcLabel } from '../components/ArticlePrimitives'
export function GlossaryArticle() {
  return (
    <article
      id="glossary"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Understanding the game · Glossary
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          marginBottom: 18,
        }}
      >
        Glossary of golf terms.
      </h2>

      <P>
        The basics — birdie, bogey, par, handicap, GIR — are covered
        in the app's stat reference section. This glossary focuses
        on the terms that come up once you start playing regularly
        and trying to improve.
      </P>

      <Hr />

      <H3>Shot shapes and ball flight</H3>
      <Term name="Draw">
        A controlled shot that curves gently from right to left in
        the air (for a right-handed golfer). The opposite of a fade.
        A draw typically produces more roll than a fade and is
        generally considered easier to generate distance with. Not
        to be confused with a hook.
      </Term>
      <Term name="Fade">
        A controlled shot that curves gently from left to right
        (for a right-handed golfer). Tour professionals often prefer
        a fade because the ball lands softer with less roll. Not to
        be confused with a slice.
      </Term>
      <Term name="Hook">
        An uncontrolled, exaggerated draw. The ball curves hard
        left for a right-handed player. Often the result of a closed
        clubface at impact. Differs from a draw in that a hook is
        unintended and more severe.
      </Term>
      <Term name="Slice">
        An uncontrolled, exaggerated fade. The ball curves hard
        right for a right-handed player. The most common miss for
        amateur golfers. Caused by an open clubface at impact
        combined with an out-to-in swing path.
      </Term>
      <Term name="Push">
        A shot that flies straight but to the right of the target
        (for a right-handed golfer), with no curve. Different from
        a fade — a pushed shot travels on the wrong line without
        curving.
      </Term>
      <Term name="Pull">
        A shot that flies straight but to the left of the target
        (for a right-handed golfer), with no curve. Different from
        a hook — a pulled shot travels on the wrong line without
        curving.
      </Term>
      <Term name="Stinger">
        A low, penetrating shot hit with minimal loft, often used
        into the wind or to punch out from under trees. Made famous
        by Tiger Woods. Achieved by playing the ball back in the
        stance and limiting the follow-through.
      </Term>
      <Term name="Punch shot">
        A low, controlled shot played with a shortened swing,
        typically from trouble — under tree branches, into wind, or
        from a tight lie. The ball stays low and runs out after
        landing.
      </Term>
      <Term name="Flier">
        A shot that travels farther than expected because grass
        gets trapped between the clubface and ball at impact,
        reducing backspin. Common from rough. A flier lie is any
        lie where you expect this to happen. Always account for
        extra distance from light rough.
      </Term>
      <Term name="Spinner">
        A shot hit with enough backspin that the ball spins back
        toward the player after landing on the green. Typically
        happens on clean contact with a wedge into a soft green. A
        desirable shot when the pin is at the back of the green and
        you need the ball to check up and release toward the hole.
      </Term>
      <Term name="Knuckleball">
        A shot with almost no spin — the ball flutters and moves
        unpredictably in the air, like a knuckleball pitch in
        baseball. Usually caused by hitting the ball with a grooved
        club that has a grass or moisture patch between face and
        ball. Notoriously hard to control distance and direction.
        Often happens from thick rough.
      </Term>
      <Term name="Texas Wedge">
        Using a putter from off the green — from the fringe, apron,
        or even light rough — instead of chipping. Often the
        highest percentage shot when the ground between ball and
        hole is firm and flat.
      </Term>
      <Term name="DOD (Driver Off the Deck)">
        Hitting a driver without a tee, from the fairway or rough.
        One of the hardest shots in golf due to the low loft and
        long shaft. Useful on long par 5s when you need maximum
        distance and can't reach the green with a fairway wood.
        Requires a shallow, sweeping angle of attack. Made famous
        by social media creator "DOD King" Carter Smith, who built
        an entire golf persona around the shot.
      </Term>
      <Term name="Thai Spinner">
        A low, high-spin shot around the greens popularized by Thai
        PGA Tour player Kiradech Aphibarnrat. The ball is struck
        first (not the ground) with a steep, outside-in swing using
        a lob wedge, producing a low ball flight that jumps and
        stops quickly due to extreme spin. Useful from tight or
        grainy lies where a standard chip would skid through. Made
        famous to wider audiences when Keith Mitchell executed it
        from a nearly impossible bunker lie at the 2025 Texas
        Children's Houston Open.
      </Term>

      <Hr />

      <H3>Short game shots</H3>
      <Term name="Chip">
        A low, running shot played from just off the green where
        the ball spends more time on the ground than in the air.
        Uses a less-lofted club (7-iron through pitching wedge
        typically) and a putting-style stroke. The classic chip:
        land the ball just on the green and let it roll to the hole.
      </Term>
      <Term name="Pitch">
        A higher, softer shot played from farther away than a chip
        — typically 20–80 yards from the green. Uses a wedge and a
        fuller swing than a chip. The ball spends more time in the
        air and stops more quickly than a chip. Pitches are harder
        than chips because they require distance control with a
        partial swing.
      </Term>
      <Term name="Bump and run">
        A chip-like shot played with a mid-iron (5–7 iron) that
        lands short of the green and runs onto the putting surface.
        Favored in links golf and firm conditions where the ground
        is predictable. Lower risk than a flop shot — fewer moving
        parts, less chance of a mishit. Harvey Penick was a famous
        advocate of this shot for amateurs.
      </Term>
      <Term name="Flop shot">
        A high, soft shot played with an open lob wedge that lands
        softly with minimal roll. Used when you need to carry a
        hazard and stop the ball quickly. High risk — a mishit flop
        can be skulled over the green or chunked short. Not
        recommended unless you practice it regularly.
      </Term>
      <Term name="Chunk / Fat shot">
        Hitting the ground behind the ball before making contact,
        resulting in a shot that comes up well short of the target.
        The club digs into the turf and decelerates. One of the
        most common short game misses for amateurs. Also called a
        heavy shot.
      </Term>
      <Term name="Scalp / Thin / Blade">
        Hitting the ball with the leading edge of the club instead
        of the face — typically the bottom groove of the iron. The
        ball comes out low and hot, usually running through the
        green. The opposite problem from a chunk. Common on tight
        lies and downhill shots. Also called skulling the ball.
      </Term>
      <Term name="Flush">
        Slang for a perfectly struck shot — clean contact with the
        center of the clubface. "I flushed a 7-iron to two feet."
        Also used as an adjective: "That was a flush strike."
      </Term>

      <Hr />

      <H3>Putting terms</H3>
      <Term name="Pin high / Hole high">
        When your approach shot finishes level with the pin (the
        same distance from the front of the green as the hole) but
        to the left or right of it. Pin high means your distance
        control was correct even if your direction was off. Generally
        considered a good miss — you're putting across the slope
        rather than up or down it.
      </Term>
      <Term name="Spinner (putting)">
        In putting context, a spinner refers to a putt that lips
        out spinning — the ball catches the edge of the cup, spins
        around the rim and comes back out. One of the most
        frustrating outcomes in golf. See also: lip out.
      </Term>

      <Hr />

      <H3>Course and green terminology</H3>
      <Term name="Below the hole">
        The lower side of the hole on a sloped green. A ball
        finishing below the hole leaves an uphill putt — the
        preferred position. Tour players always try to leave
        themselves below the hole.
      </Term>
      <Term name="Above the hole">
        The upper side of the hole on a sloped green. Leaves a
        downhill putt, which is faster and harder to control. Avoid
        finishing above the hole when possible.
      </Term>
      <Term name="Short side">
        The side of the green closest to the pin when the pin is
        tucked near an edge. Missing a green on the short side
        leaves an extremely difficult chip with little green to
        work with. One of the most costly mistakes in course
        management. Do not short side yourself.
      </Term>
      <Term name="Grain">
        The direction in which grass grows on a putting green.
        Bermuda grass greens (common in warm climates) have strong
        grain that significantly affects putt speed and break.
        Putting with the grain is faster; against the grain is
        slower. Identifying grain is an important green-reading
        skill.
      </Term>
      <Term name="Stimp / Stimpmeter">
        A device that measures green speed by rolling a ball down
        a ramp and measuring how far it travels. A stimp reading of
        10 is moderately fast (typical club golf), 12–13 is fast
        (major championship conditions), 14+ is extremely fast.
      </Term>
      <Term name="False front">
        A green that slopes sharply back toward the fairway at the
        front. Approach shots that land on the false front roll
        back off the green. Requires more club than it appears to
        hold the green.
      </Term>
      <Term name="Apron / Fringe">
        The short grass surrounding the putting green, shorter than
        the fairway but longer than the green itself. Putting from
        the apron is usually possible with a putter, though the
        slightly longer grass affects roll.
      </Term>
      <Term name="Dogleg">
        A hole that bends left or right between the tee and green.
        A dogleg left bends left; dogleg right bends right.
      </Term>
      <Term name="Bailout">
        A safe area to miss to when the primary target is dangerous.
        Good course management always identifies the bailout before
        swinging.
      </Term>
      <Term name="Big ball (Earth)">
        Slang for hitting the ground before the ball — chunking or
        fatting a shot. "He hit the big ball first." A humorous way
        of saying someone hit it fat. The "big ball" is the Earth
        itself; the small ball is the golf ball. You want to hit
        the small one first.
      </Term>

      <Hr />

      <H3>Divots and course care</H3>
      <Term name="Divot">
        The chunk of turf displaced by the club during an iron shot.
        Two meanings: (1) the chunk of turf itself, and (2) the
        hole left in the ground. Replacing your divot after a shot
        is standard golf etiquette. Many courses provide sand-mix
        bottles to fill divots instead. Hitting from a divot left
        by a previous player is a common bad lie — no relief, play
        it as it lies.
      </Term>
      <Term name="Pitch mark / Ball mark">
        The indentation left in the green when an approach shot
        lands. Repairing your pitch mark — and any others nearby —
        is one of the most important etiquette habits in golf.
        Unrepaired pitch marks take weeks to heal and create bumpy
        putting surfaces for everyone. Repair by pushing the edges
        down and smoothing, not by lifting the center up.
      </Term>
      <Term name="Burn mark">
        The browning or dying of grass on one side of the hole cup,
        caused by the grain growing away from that side and
        exposing the roots. The burned side indicates where the
        grain is running from — grain runs toward the healthy
        green side of the cup. Reading burn marks is a quick way
        to identify grain direction on Bermuda greens before
        putting. The side with the burn is into the grain; the
        healthy side is with the grain.
      </Term>
      <Term name="Divot tool / Pitch fork">
        The small forked tool used to repair pitch marks on the
        green. Every golfer should carry one. Insert the tines at
        the edges of the mark and push inward to level it out. Do
        not pry up from the center — this damages the roots. A ball
        marker (usually a coin) is used alongside the divot tool to
        mark your ball position on the green.
      </Term>

      <Hr />

      <H3>Scoring and competition terms</H3>
      <Term name="Snowman">
        Slang for a score of 8 on a hole — because the number 8
        looks like a snowman. Not a term you want to hear often.
      </Term>
      <Term name="Blow up hole">
        A hole where everything goes wrong and a large number is
        recorded. Every golfer has them. The mental game skill is
        minimizing how many and how severe.
      </Term>
      <Term name="Honors">
        The player who tees off first on a hole has the honors. In
        stroke play, honors goes to the player with the lowest
        score on the previous hole.
      </Term>
      <Term name="Ready golf">
        Hitting when you're ready rather than strictly following
        honors order. Speeds up pace of play significantly. Standard
        in casual rounds.
      </Term>
      <Term name="Skins">
        A golf betting format where each hole is worth a set amount
        of money (a "skin"). The player who wins the hole outright
        — no ties — wins the skin. If two or more players tie, the
        skin carries over to the next hole, making it worth more.
        Skins can stack up over several holes and create exciting
        swings.
      </Term>
      <Term name="Match play">
        A format where the score is tracked hole by hole rather
        than total strokes. Win a hole by taking fewer strokes and
        you go one up. The player who wins the most holes wins the
        match.
      </Term>
      <Term name="Stroke play">
        The standard format where total strokes over the entire
        round are counted. The player with the fewest total strokes
        wins.
      </Term>
      <Term name="Stableford">
        A scoring format where points are awarded based on score
        relative to par. Typically: bogey = 1 point, par = 2 points,
        birdie = 3 points, eagle = 4 points. Encourages aggressive
        play. Popular in social golf.
      </Term>
      <Term name="Nassau">
        A common golf bet consisting of three separate wagers: the
        front nine, the back nine, and the full 18 holes. Each is
        a separate match play competition.
      </Term>
      <Term name="Press">
        In a Nassau or match play bet, a press is a new side bet
        started mid-round, typically when a player or team is down
        by two holes.
      </Term>
      <Term name="Dormie">
        In match play, when a player leads by the same number of
        holes as remain to be played. Cannot lose — worst outcome
        is a tie.
      </Term>

      <Hr />

      <H3>Lie and course conditions</H3>
      <Term name="Tight lie">
        A ball sitting on bare or closely-mown ground with very
        little grass underneath. Requires clean contact.
      </Term>
      <Term name="Plugged lie / Fried egg">
        A ball that has embedded in its own pitch mark, typically
        in soft ground or a bunker. Also called a fried egg in a
        bunker — only the top of the ball is visible, surrounded by
        a ring of disturbed sand.
      </Term>
      <Term name="Hardpan">
        Very firm, dry ground with little or no grass. Produces low,
        running shots and requires precise contact.
      </Term>

      <Hr />

      <H3>Equipment terms</H3>
      <Term name="Muscle back">
        An iron design where the weight is concentrated in a solid
        mass directly behind the center of the clubface — sometimes
        called a blade. No cavity in the back. Preferred by better
        players for the feel, feedback, and shot-shaping ability
        they provide. Less forgiving than cavity backs — off-center
        hits are more penalized. If you hit it pure, a muscle back
        feels unlike anything else in golf — the feedback through
        the hands is immediate and unmistakable. Miss it, and you'll
        know that too.
      </Term>
      <Term name="Cavity back">
        An iron design where weight is redistributed to the
        perimeter of the clubhead, creating a cavity in the back.
        More forgiving than muscle backs — off-center hits still
        travel reasonably well. Standard for most amateur golfers.
      </Term>
      <Term name="Loft">
        The angle of the clubface relative to vertical. Higher loft
        = higher ball flight and less distance. Lower loft = lower
        ball flight and more distance.
      </Term>
      <Term name="Shaft flex">
        How much the shaft bends during the swing. Options from
        most to least flexible: Ladies, Senior, Regular, Stiff,
        Extra Stiff. Wrong shaft flex affects ball flight and
        distance.
      </Term>
      <Term name="Lie angle">
        The angle between the shaft and the ground when the club is
        soled correctly at address. If lie angle is wrong, shots
        will miss consistently left or right even with a good
        swing. Can be adjusted by a fitter.
      </Term>

      <Hr />

      <H3>Slang and culture</H3>
      <Term name="Worm burner">
        A shot that never gets airborne, rolling along the ground.
        Usually a topped or thinned iron.
      </Term>
      <Term name="Shank">
        A shot struck with the hosel (the socket connecting shaft
        to clubhead) rather than the face, resulting in a shot that
        fires dramatically to the right for a right-handed player.
        One of the most dreaded misses in golf. Some golfers avoid
        saying the word on the course, as if merely uttering it
        invites one.
      </Term>
      <Term name="Yips">
        A condition where involuntary muscle twitches or nerves
        cause jerky, uncontrolled strokes — most commonly on short
        putts. Can affect chipping as well. More mental than
        physical, though the exact cause is debated. Has ended
        careers.
      </Term>
      <Term name="Cabbage">
        Thick, deep rough where the ball sits down and is difficult
        to advance. You are just trying to get out of cabbage, not
        reach the green.
      </Term>
      <Term name="Lip out">
        A putt that rolls around or over the edge of the cup
        without falling in. One of the most frustrating outcomes
        in golf.
      </Term>
      <Term name="Bite">
        What golfers say to a ball approaching the green that they
        want to stop quickly — asking the backspin to grab and hold
        the green. "Bite!" Also used as a verb: "I need this to
        bite."
      </Term>
      <Term name="Barkie">
        Making par after your ball hits a tree. Counted as bonus
        points in some social games.
      </Term>
      <Term name="Greenie">
        In a group game, awarded to the player who hits the green
        in regulation on a par 3 and is closest to the pin. Common
        side bet in casual golf.
      </Term>

      <Hr />

      <H3>Rules terms worth knowing</H3>
      <Term name="Relief">
        When the rules allow you to move your ball without penalty
        — from a cart path, temporary water, ground under repair,
        or an embedded ball.
      </Term>
      <Term name="Penalty area">
        The modern Rules term (since 2019) for what was previously
        called a water hazard. Yellow penalty areas offer two
        relief options; red penalty areas offer three. You may now
        ground your club in a penalty area.
      </Term>
      <Term name="Ground under repair (GUR)">
        Areas of the course marked for maintenance. Free relief is
        available from GUR.
      </Term>
      <Term name="Provisional ball">
        A second ball played when you believe your first ball may
        be lost or out of bounds. Must be announced as provisional
        before playing. Saves time — avoids walking back to replay.
      </Term>
      <Term name="Stroke and distance">
        The penalty for a lost ball or out-of-bounds shot. Add one
        penalty stroke AND return to where you played from. The
        most severe penalty in golf.
      </Term>

      <Hr />

      <H3>Historical terms (and why you still hear them)</H3>
      <P>
        Golf has a longer continuous history than almost any other
        sport, and its vocabulary reflects that. Some terms from
        the hickory-shaft era (roughly pre-1930) have stuck around
        — either in formal golf writing, in the names of classic
        holes and courses, or because older golfers still use them
        affectionately. Younger players sometimes use them cheekily.
      </P>
      <Term name="Brassie">
        The old name for what we now call a 2-wood. Named for the
        brass plate on the sole of the club. You might hear someone
        pull out their fairway wood and say "give me the brassie"
        as a throwback reference.
      </Term>
      <Term name="Spoon">
        Old name for a 3-wood. The shallow, spoon-like face of the
        club gave it the name. Still occasionally used by writers
        describing vintage golf or classic architecture.
      </Term>
      <Term name="Baffy">
        Old name for a 4-wood. Rarely heard today but shows up in
        historical writing about early golf.
      </Term>
      <Term name="Cleek">
        A low-lofted iron from the hickory era, roughly equivalent
        to a modern 1 or 2-iron. Also used to describe a
        narrow-faced iron used for distance from tight lies. "The
        cleek" appears frequently in descriptions of early 20th
        century golf.
      </Term>
      <Term name="Mashie">
        Old name roughly equivalent to a modern 5-iron. One of the
        most commonly referenced hickory-era clubs. "Mashie niblick"
        was a club between the mashie and niblick — roughly a
        7-iron equivalent.
      </Term>
      <Term name="Niblick">
        A high-lofted hickory club used for short approach shots
        and trouble shots — roughly equivalent to a modern 9-iron
        or wedge. The niblick was the go-to club for escaping
        difficult lies.
      </Term>
      <Term name="Jigger">
        A utility iron from the hickory era with moderate loft,
        used for punch shots and running approaches. No clean
        modern equivalent. The term occasionally resurfaces in
        discussions of bump-and-run shot technique.
      </Term>
      <Term name="Stymie">
        A now-abolished situation in match play where your
        opponent's ball blocked your putting line and you had to
        play around or over it. Eliminated from the rules in 1952
        when ball marking became standard. Still used figuratively
        in everyday English — "I'm in a bit of a stymie" — meaning
        blocked or stuck.
      </Term>
      <Term name="Fore">
        Still very much in use — the warning shout when a ball is
        heading toward other players. The origin is disputed:
        possibly from "forecaddie" (a spotter walking ahead),
        possibly a military "beware before" command. One of golf's
        oldest surviving terms and one of its most important.
      </Term>
      <Sources />

      <Footer />
    </article>
  )
}

// ===========================================================================
// Components
// ===========================================================================

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 22,
        fontWeight: 500,
        fontStyle: 'italic',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
        marginTop: 26,
        marginBottom: 14,
      }}
    >
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-caddie-ink"
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 680,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        padding: '12px 0',
        maxWidth: 680,
      }}
    >
      <div
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 16,
          fontWeight: 500,
          fontStyle: 'italic',
          marginBottom: 4,
        }}
      >
        {name}
      </div>
      <div
        className="text-caddie-ink"
        style={{ fontSize: 14, lineHeight: 1.55 }}
      >
        {children}
      </div>
    </div>
  )
}

function Hr() {
  return (
    <div
      style={{
        borderTop: '1px solid #D9D2BF',
        margin: '22px 0',
      }}
    />
  )
}

function Sources() {
  return (
    <section style={{ borderTop: '1px solid #D9D2BF', paddingTop: 18, marginTop: 22 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        Sources
      </div>
      <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
        <div>
          <SrcLabel>How these definitions are sourced</SrcLabel>
          <SrcBody>
            Definitions follow the USGA &amp; R&amp;A Rules of Golf where a term
            is formally defined there (stroke, hazard, out of bounds, and so
            on), and otherwise reflect common golf usage. Slang and historical
            entries are described as they're actually used, not as official
            definitions.
          </SrcBody>
        </div>
      </div>
    </section>
  )
}



function Footer() {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 22,
        lineHeight: 1.6,
      }}
    >
      Last reviewed May 2026
    </div>
  )
}
