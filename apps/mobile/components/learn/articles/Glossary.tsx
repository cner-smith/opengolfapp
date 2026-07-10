import { View } from 'react-native'
import { ArticleFooter, ArticleHeader, DefRow, H3, Hr, P, Sources } from '../primitives'

export function GlossaryArticle() {
  return (
    <View>
      <ArticleHeader
        kicker="Understanding the game · Glossary"
        title="Glossary of golf terms."
      />
      <P>
        The basics — birdie, bogey, par, handicap, GIR — are not
        covered here. This glossary focuses on the terms that come
        up once you start playing regularly and trying to improve.
      </P>

      {GLOSSARY_GROUPS.map((group) => (
        <View key={group.heading}>
          <Hr />
          <H3>{group.heading}</H3>
          {group.intro && <P>{group.intro}</P>}
          {group.terms.map((t) => (
            <DefRow key={t.name} term={t.name}>
              {t.body}
            </DefRow>
          ))}
        </View>
      ))}

      <Sources
        items={[
          {
            name: 'How these definitions are sourced',
            note: "Definitions follow the USGA & R&A Rules of Golf where a term is formally defined there (stroke, hazard, out of bounds, and so on), and otherwise reflect common golf usage. Slang and historical entries are described as they're actually used, not as official definitions.",
          },
        ]}
      />

      <ArticleFooter>
        Last reviewed July 2026
      </ArticleFooter>
    </View>
  )
}

interface GlossaryTerm {
  name: string
  body: string
}

interface GlossaryGroup {
  heading: string
  intro?: string
  terms: GlossaryTerm[]
}

const GLOSSARY_GROUPS: GlossaryGroup[] = [
  {
    heading: 'Shot shapes and ball flight',
    terms: [
      { name: 'Draw', body: 'A controlled shot that curves gently from right to left for a right-handed golfer. Typically more roll than a fade. Not to be confused with a hook.' },
      { name: 'Fade', body: 'A controlled shot that curves gently from left to right for a right-handed golfer. Tour pros often prefer it because the ball lands softer with less roll.' },
      { name: 'Hook', body: 'An uncontrolled, exaggerated draw. Often the result of a closed clubface at impact.' },
      { name: 'Slice', body: 'An uncontrolled, exaggerated fade. The most common miss for amateurs — open face plus out-to-in path.' },
      { name: 'Push', body: 'A shot that flies straight but to the right of the target with no curve. Different from a fade — wrong line, no shape.' },
      { name: 'Pull', body: 'A shot that flies straight but to the left of the target with no curve. Different from a hook.' },
      { name: 'Stinger', body: 'A low, penetrating shot hit with minimal loft, played into wind or under trees.' },
      { name: 'Punch shot', body: 'A low, controlled shot played with a shortened swing. Stays low, runs out after landing.' },
      { name: 'Flier', body: 'A shot that travels farther than expected because grass gets between face and ball, reducing backspin. Common from rough.' },
      { name: 'Spinner', body: 'A wedge struck cleanly into a soft green that spins back toward the player after landing. Useful when the pin is at the front — fly it past and let the spin bring it back.' },
      { name: 'Knuckleball', body: 'A shot with almost no spin — the ball flutters unpredictably. Often happens out of thick rough.' },
      { name: 'Texas Wedge', body: 'Using a putter from off the green — fringe, apron, or even light rough. Highest-percentage shot when the ground between ball and hole is firm and flat.' },
      { name: 'DOD (Driver Off the Deck)', body: 'Hitting a driver without a tee, from the fairway or rough. One of the hardest shots in golf.' },
      { name: 'Thai Spinner', body: 'A low, high-spin shot popularized by Kiradech Aphibarnrat — steep outside-in lob wedge from a tight or grainy lie. Reached wider audiences when Keith Mitchell pulled it off at the 2025 Texas Children\'s Houston Open.' },
    ],
  },
  {
    heading: 'Short game shots',
    terms: [
      { name: 'Chip', body: 'Low, running shot from just off the green. Less-lofted club, putting-style stroke. Land just on, let it roll.' },
      { name: 'Pitch', body: 'Higher, softer shot from 20–80 yards. Wedge, fuller swing than a chip. Harder because partial swings demand distance control.' },
      { name: 'Bump and run', body: 'Mid-iron chip that lands short of the green and runs onto the surface. Favored in firm conditions. Lower risk than a flop.' },
      { name: 'Flop shot', body: 'High, soft lob-wedge shot that lands softly with minimal roll. High risk — easy to skull or chunk if not practiced.' },
      { name: 'Chunk / Fat shot', body: 'Hitting the ground behind the ball. Club digs, decelerates, ball comes up well short.' },
      { name: 'Scalp / Thin / Blade', body: 'Hitting the ball with the leading edge instead of the face. Comes out low and hot, runs through the green.' },
      { name: 'Flush', body: 'Slang for a perfectly struck shot — clean contact in the center of the face.' },
    ],
  },
  {
    heading: 'Putting terms',
    terms: [
      { name: 'Pin high / Hole high', body: 'Approach finishes level with the pin (correct distance, off line). Generally a good miss — putting across slope, not up or down it.' },
    ],
  },
  {
    heading: 'Course and green terminology',
    terms: [
      { name: 'Below the hole', body: 'The lower side of the cup on a sloped green. Leaves an uphill putt — preferred. Tour players always try to stay below.' },
      { name: 'Above the hole', body: 'The upper side. Leaves a downhill putt — faster, harder to control. Avoid.' },
      { name: 'Short side', body: 'The side of the green closest to a tucked pin. Missing short side leaves the hardest possible chip. Do not short side yourself.' },
      { name: 'Grain', body: 'Direction grass grows on a green. Bermuda grain strongly affects speed and break. With the grain is faster; against is slower.' },
      { name: 'Stimp / Stimpmeter', body: 'Device that measures green speed. 10 = club golf, 12–13 = major championship, 14+ = extremely fast.' },
      { name: 'False front', body: 'A green that slopes back toward the fairway at the front. Approach shots that land on it roll back off. Take more club.' },
      { name: 'Apron / Fringe', body: 'Short grass surrounding the green — shorter than fairway, longer than green. Putt-able with care.' },
      { name: 'Dogleg', body: 'A hole that bends left or right between tee and green.' },
      { name: 'Bailout', body: 'A safe area to miss to when the primary target is dangerous. Identify before swinging.' },
      { name: 'Big ball (Earth)', body: 'Slang for chunking — hitting the ground before the ball. The "big ball" is the Earth; you want to hit the small one first.' },
    ],
  },
  {
    heading: 'Divots and course care',
    terms: [
      { name: 'Divot', body: 'The chunk of turf displaced (or the hole left). Replace it, or fill with sand-mix where provided. Hitting from a divot is no relief — play it as it lies.' },
      { name: 'Pitch mark / Ball mark', body: 'The indentation an approach leaves on the green. Repair yours and any nearby. Push edges down and smooth — do not lift the center.' },
      { name: 'Burn mark', body: 'Browning on one side of the cup — the burnt, ragged edge shows the direction the grain grows toward; the sharp, healthy edge is up-grain. Putts run faster and break toward the burnt side. Quick read for grain on Bermuda greens.' },
      { name: 'Divot tool / Pitch fork', body: 'Tool for repairing pitch marks. Insert tines at the edges, push inward. Never pry up from the center.' },
    ],
  },
  {
    heading: 'Scoring and competition',
    terms: [
      { name: 'Snowman', body: 'A score of 8 on a hole — the number 8 looks like a snowman.' },
      { name: 'Blow up hole', body: 'A hole where everything goes wrong and a large number is recorded. Mental game = minimizing how many.' },
      { name: 'Honors', body: 'The right to tee off first. In stroke play, goes to the lowest score on the previous hole.' },
      { name: 'Ready golf', body: 'Hit when you are ready, not strictly by honors order. Speeds pace of play. Standard in casual rounds.' },
      { name: 'Skins', body: 'Each hole worth a fixed amount. Win the hole outright (no ties) and you win the skin. Ties carry over and stack.' },
      { name: 'Match play', body: 'Score tracked hole by hole rather than total strokes. Win a hole, go one up.' },
      { name: 'Stroke play', body: 'Total strokes over the round. Lowest total wins.' },
      { name: 'Stableford', body: 'Points based on score relative to par. Bogey 1, par 2, birdie 3, eagle 4. Encourages aggressive play.' },
      { name: 'Nassau', body: 'A bet split into front nine, back nine, and full 18 — three separate match-play competitions.' },
      { name: 'Press', body: 'A new side bet started mid-round in a Nassau or match play, typically when down by two.' },
      { name: 'Dormie', body: 'In match play, leading by the same number of holes as remain. Cannot lose — worst outcome is a tie.' },
    ],
  },
  {
    heading: 'Lie and course conditions',
    terms: [
      { name: 'Tight lie', body: 'A ball sitting on bare or closely-mown ground with very little grass underneath. Demands clean contact.' },
      { name: 'Plugged lie / Fried egg', body: 'Ball embedded in its own pitch mark, often in a bunker — only the top is visible, surrounded by disturbed sand.' },
      { name: 'Hardpan', body: 'Very firm, dry ground with little or no grass. Produces low running shots; demands precise contact.' },
    ],
  },
  {
    heading: 'Equipment terms',
    terms: [
      { name: 'Muscle back', body: 'Iron with weight in a solid mass behind the center of the face — a blade. Less forgiving than cavity backs but unmatched feedback when struck pure.' },
      { name: 'Cavity back', body: 'Iron with weight redistributed to the perimeter, creating a cavity. More forgiving on off-center hits. Standard for most amateurs.' },
      { name: 'Loft', body: 'Angle of the clubface relative to vertical. Higher loft = higher flight, less distance. Lower = lower flight, more distance.' },
      { name: 'Shaft flex', body: 'How much the shaft bends during the swing. Ladies, Senior, Regular, Stiff, Extra Stiff. Wrong flex affects flight and distance.' },
      { name: 'Lie angle', body: 'Angle between shaft and ground when soled at address. Wrong lie angle pushes shots consistently left or right even with a good swing.' },
    ],
  },
  {
    heading: 'Slang and culture',
    terms: [
      { name: 'Worm burner', body: 'A shot that never gets airborne, rolling along the ground. Usually a topped or thinned iron.' },
      { name: 'Shank', body: 'A shot struck off the hosel that fires hard right for a right-handed player. One of the most dreaded misses in golf — some players will not say the word.' },
      { name: 'Yips', body: 'Involuntary muscle twitches or nerves on short putts (or chips). More mental than physical. Has ended careers.' },
      { name: 'Cabbage', body: 'Thick, deep rough where the ball sits down and is hard to advance. You are just trying to get out.' },
      { name: 'Lip out', body: 'A putt that catches the edge of the cup but does not fall in. One of the most frustrating outcomes in golf.' },
      { name: 'Bite', body: 'What golfers shout asking a ball to stop on the green. Also a verb: "I need this to bite."' },
      { name: 'Barkie', body: 'Making par after your ball hits a tree. Counted as bonus points in some social games.' },
      { name: 'Greenie', body: 'In a group game, awarded to the player who hits the green in regulation on a par 3 closest to the pin.' },
    ],
  },
  {
    heading: 'Rules terms worth knowing',
    terms: [
      { name: 'Relief', body: 'When the rules let you move your ball without penalty — cart path, temporary water, GUR, embedded ball.' },
      { name: 'Penalty area', body: 'Modern rules term (since 2019) for what was a water hazard. Yellow = two relief options, red = three. You may now ground your club.' },
      { name: 'Ground under repair (GUR)', body: 'Areas marked for maintenance. Free relief.' },
      { name: 'Provisional ball', body: 'A second ball played when the first may be lost or out of bounds. Must be announced. Saves walking back to replay.' },
      { name: 'Stroke and distance', body: 'Penalty for a lost ball or OB. One stroke AND back to where you played from. The most severe penalty in golf.' },
    ],
  },
  {
    heading: 'Historical terms',
    intro: 'Golf has a longer continuous history than almost any other sport, and its vocabulary reflects that. Some hickory-era terms still surface in writing, course names, or older players using them affectionately.',
    terms: [
      { name: 'Brassie', body: 'Old name for a 2-wood — named for the brass plate on the sole.' },
      { name: 'Spoon', body: 'Old name for a 3-wood — for the shallow, spoon-like face.' },
      { name: 'Baffy', body: 'Old name for a 4-wood. Rarely heard today.' },
      { name: 'Cleek', body: 'Low-lofted hickory iron, roughly a modern 1 or 2-iron. Also a narrow-faced iron used for distance from tight lies.' },
      { name: 'Mashie', body: 'Roughly a modern 5-iron. "Mashie niblick" was between a mashie and niblick — about a 7-iron.' },
      { name: 'Niblick', body: 'High-lofted hickory club for short approaches and trouble — roughly a 9-iron or wedge.' },
      { name: 'Jigger', body: 'Utility iron with moderate loft, used for punch shots and running approaches. No clean modern equivalent.' },
      { name: 'Stymie', body: 'Pre-1952 match-play situation where your opponent\'s ball blocked your line. Still used figuratively — "in a stymie" means stuck.' },
      { name: 'Fore', body: 'The warning shout when a ball is heading toward other players. Origin disputed — possibly from "forecaddie," possibly military. Still essential.' },
    ],
  },
]
