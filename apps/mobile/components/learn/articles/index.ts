import type { ComponentType } from 'react'
import { BenchmarksArticle } from './Benchmarks'
import { BuildingYourBagArticle } from './BuildingYourBag'
import { CourseManagementArticle } from './CourseManagement'
import { FittingsWithCoachesArticle } from './FittingsWithCoaches'
import { GlossaryArticle } from './Glossary'
import { GuideToFittingsArticle } from './GuideToFittings'
import { HowToPracticeArticle } from './HowToPractice'
import { LessonsAndCoachingArticle } from './LessonsAndCoaching'
import { MeasurableGoalsArticle } from './MeasurableGoals'
import { MentalGameArticle } from './MentalGame'
import { Operation36Article } from './Operation36'
import { PracticeModesArticle } from './PracticeModes'
import { PracticeVsScoringRoundArticle } from './PracticeVsScoringRound'
import { QuestionsForCoachArticle } from './QuestionsForCoach'
import { SelfDiagnosisArticle } from './SelfDiagnosis'
import { SkillGamesArticle } from './SkillGames'
import { StrokesGainedArticle } from './StrokesGained'
import { SwingVariationsArticle } from './SwingVariations'
import { TrainingAidsArticle } from './TrainingAids'
import { UnderstandingYourSwingArticle } from './UnderstandingYourSwing'

// Every Learn article rendered on its own file, composing the shared
// primitives. Keyed by the catalog id in @oga/core/learn.ts. The [article]
// screen is a thin router over this map.
export const MOBILE_ARTICLES: Record<string, ComponentType> = {
  benchmarks: BenchmarksArticle,
  'building-your-bag': BuildingYourBagArticle,
  'course-management': CourseManagementArticle,
  'fittings-with-coaches': FittingsWithCoachesArticle,
  glossary: GlossaryArticle,
  'guide-to-fittings': GuideToFittingsArticle,
  'how-to-practice': HowToPracticeArticle,
  'lessons-and-coaching': LessonsAndCoachingArticle,
  'measurable-goals': MeasurableGoalsArticle,
  'mental-game': MentalGameArticle,
  'operation-36': Operation36Article,
  'practice-modes': PracticeModesArticle,
  'practice-vs-scoring-round': PracticeVsScoringRoundArticle,
  'questions-for-coach': QuestionsForCoachArticle,
  'self-diagnosis': SelfDiagnosisArticle,
  'skill-games-pressure-games': SkillGamesArticle,
  'strokes-gained': StrokesGainedArticle,
  'swing-variations': SwingVariationsArticle,
  'training-aids': TrainingAidsArticle,
  'understanding-your-swing': UnderstandingYourSwingArticle,
}
