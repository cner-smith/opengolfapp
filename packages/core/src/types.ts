import type {
  Club,
  Facility,
  Goal,
  LieSlope,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  ShotCategory,
  ShotResult,
  SkillLevel,
} from './constants'

export interface Profile {
  id: string
  username: string
  handicapIndex: number
  skillLevel: SkillLevel
  goal: Goal
  playFrequency: string
  facilities: Facility[]
  playStyle: 'casual' | 'mixed' | 'competitive'
  createdAt: string
}

export interface Course {
  id: string
  name: string
  location?: string
  mapboxId?: string
}

export interface Hole {
  id: string
  courseId: string
  number: number
  par: number
  yards?: number
  strokeIndex?: number
  teeLat?: number
  teeLng?: number
  pinLat?: number
  pinLng?: number
}

export interface Round {
  id: string
  userId: string
  courseId: string
  playedAt: string
  teeColor?: string
  totalScore?: number
  totalPutts?: number
  fairwaysHit?: number
  fairwaysTotal?: number
  gir?: number
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
  sgTotal?: number
  notes?: string
}

export interface HoleScore {
  id: string
  roundId: string
  holeId: string
  score: number
  putts?: number
  fairwayHit?: boolean
  gir?: boolean
  sgOffTee?: number
  sgApproach?: number
  sgAroundGreen?: number
  sgPutting?: number
}

export interface Shot {
  id: string
  holeScoreId: string
  userId: string
  shotNumber: number
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  aimLat?: number
  aimLng?: number
  distanceToTarget?: number
  club?: Club
  lieType?: LieType
  /** @deprecated read-only on legacy rows; new writes use lieSlopeForward + lieSlopeSide. */
  lieSlope?: LieSlope
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  penalty?: boolean
  ob?: boolean
  aimOffsetYards?: number
  breakDirection?:
    | 'left'
    | 'right'
    | 'straight'
    | 'left_to_right'
    | 'right_to_left'
    | 'uphill'
    | 'downhill'
  /** @deprecated combined value retained for back-compat reads. New code
   *  uses puttMade + puttDistanceResult + puttDirectionResult — three
   *  independent dimensions. */
  puttResult?: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'
  puttMade?: boolean
  puttDistanceResult?: 'short' | 'long'
  puttDirectionResult?: 'left' | 'right'
  puttDistanceFt?: number
  puttSlopePct?: number
  greenSpeed?: 'slow' | 'medium' | 'fast'
  notes?: string
}

export type LegacyPuttResult =
  | 'made'
  | 'short'
  | 'long'
  | 'missed_left'
  | 'missed_right'

/** Reconstruct legacy putt_result from the three new putting axes so
 *  writers can keep the legacy column populated for back-compat. */
export function combinedPuttResult(args: {
  made?: boolean
  distance?: 'short' | 'long' | null
  direction?: 'left' | 'right' | null
}): LegacyPuttResult | null {
  if (args.made) return 'made'
  if (args.distance === 'short') return 'short'
  if (args.distance === 'long') return 'long'
  if (args.direction === 'left') return 'missed_left'
  if (args.direction === 'right') return 'missed_right'
  return null
}

export interface SGBreakdown {
  offTee: number
  approach: number
  aroundGreen: number
  putting: number
  total: number
}

export interface FocusArea {
  category: ShotCategory
  priority: number
  sgValue: number
  insight: string
}

export interface PlanDrill {
  drillId: string
  name: string
  durationMin: number
  facility: string
  category: string
  description: string
  reason: string
}

export interface PracticePlan {
  id: string
  userId: string
  generatedAt: string
  validUntil: string
  basedOnRounds: number
  focusAreas: FocusArea[]
  drills: PlanDrill[]
  aiInsight: string
  completedDrillIds: string[]
}

export interface Drill {
  id: string
  name: string
  description: string
  durationMin: number
  category: string
  facility: string[]
  skillLevels: SkillLevel[]
  instructions: string
}
