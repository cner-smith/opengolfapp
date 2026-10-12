# OGA

The language of golf as OGA records and scores it: courses, rounds, holes, shots, and the strokes gained that compares a player's shots to golfers of their handicap.

## Courses

**Course**:
A place to play golf, made of numbered holes.

**Hole**:
One of a course's numbered holes (hole 5, a par 4). Never the cup.

**Pin**:
Where the cup is on a hole's green.
_Avoid_: Hole (for the cup), flag, target

**Tee set**:
One set of tee markers on a course (by colour or name) that a player plays from.
_Avoid_: Tee name, tees

## Play

**Shot**:
One swing at the ball. It is played from its **start**, the spot where the player stood to hit it, and ends at its finish. The next shot starts from the finish unless a penalty moved the ball.
_Avoid_: Stroke (for a swing), marker, end point

**Finish**:
Where a shot's ball came to rest. It is usually the next shot's start, but not after an OB (the finish is out of bounds) or a drop (the finish is where the ball was lost or unplayable).
_Avoid_: Landing, end

**Distance to the pin**:
How far a shot's start is from the pin.
_Avoid_: Distance to target, distance to the hole

**Putt length**:
A putt's distance to the pin, measured at its start.
_Avoid_: Putt distance, roll

**Lie**:
What the ball sits on at a shot's start: tee, fairway, rough, sand, green, and so on.

**Lie slope**:
The ground's tilt at a shot's start, read on two separate axes: uphill or downhill along the line, and ball above or below the feet.
_Avoid_: Stance, slope (alone)

**Aim point**:
Where the player aims, set before the shot and never assumed. On the green it is the spot the putt is started toward, not the pin.
_Avoid_: Target

**Miss**:
A shot's finish measured from its aim point.

**Penalty stroke**:
A stroke added to a hole score by the Rules, with no swing.

**Out of bounds (OB)**:
A shot whose ball finished out of bounds. It costs one penalty stroke.

**Replay**:
The shot played after an OB from where the OB shot was played (stroke and distance).
_Avoid_: Re-tee (unless it is from the tee)

**Drop**:
A shot played from where the ball was placed after taking relief, with or without a penalty stroke, whether the Rules allow that spot or not. A replay is not a drop.

## Holes and rounds

**Hole score**:
The strokes on one hole: every shot plus every penalty stroke.

**Unplayed hole**:
A hole in a round with no strokes.

**Played hole**:
A hole in a round with at least one stroke.

**Finished hole**:
A played hole the player has closed in the end-of-hole review. Only finished holes count toward a round.

**Live round**:
A round logged on the course as it is played.

**Past round**:
A round entered after it was played.

**Imported round**:
A past round brought in from another app's export. Its shots may carry distances to the pin but no positions.

**Ended round**:
A round the player has ended, however many holes they finished.
_Avoid_: Completed round

**Whole round**:
A round in which every hole of the course is a finished hole.
_Avoid_: Full round, complete round

## Strokes gained

**Handicap index**:
The player's measure of skill; it picks the baseline their strokes gained compares against.
_Avoid_: Handicap (alone; a course handicap is a different number)

**Baseline**:
The table of expected strokes for one handicap bracket.

**Expected strokes**:
The average number of strokes a golfer in the baseline's bracket takes to hole out from a position.

**Strokes gained (SG)**:
For one shot: expected strokes from its start, minus expected strokes from the next shot's start, minus one, minus its penalty strokes. It reads the next shot's start, never the finish.

**SG category**:
Which part of the game a shot counts toward: Off the tee, Approach, Around the green, or Putting. A par-3 tee shot is an Approach; a replay takes the category of the OB shot it replaces.

## Clubs and practice

**Bag**:
The clubs a player carries.

**Club**:
One club in a bag, such as a driver, a 7-iron or a 56° wedge.

**Typical distance**:
How far a player usually hits a club, measured to where the ball finished.
_Avoid_: Carry

**Dispersion**:
The spread of one club's misses.

**Practice plan**:
A set of drills chosen for a player from their strokes gained, skill and goal.

**Drill**:
One practice exercise.

**Practice mode**:
How a drill is practised: warmup, blocked, random, skill game, pressure game, or on course.

**Facility**:
Where a player can practise, such as a range or a putting green. A plan only uses drills the player's facilities allow.
