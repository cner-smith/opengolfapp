import type { ComponentType } from 'react'
import { BuildingYourBagArticle } from './BuildingYourBag'
import { FittingsWithCoachesArticle } from './FittingsWithCoaches'
import { GuideToFittingsArticle } from './GuideToFittings'
import { LessonsAndCoachingArticle } from './LessonsAndCoaching'
import { MeasurableGoalsArticle } from './MeasurableGoals'
import { Operation36Article } from './Operation36'
import { PracticeModesArticle } from './PracticeModes'
import { PracticeVsScoringRoundArticle } from './PracticeVsScoringRound'
import { QuestionsForCoachArticle } from './QuestionsForCoach'
import { SelfDiagnosisArticle } from './SelfDiagnosis'
import { SwingVariationsArticle } from './SwingVariations'
import { TrainingAidsArticle } from './TrainingAids'
import { UnderstandingYourSwingArticle } from './UnderstandingYourSwing'

// Learn articles ported into their own files (the original 7 stay inline in
// the [article].tsx screen). Keyed by the catalog id in @oga/core/learn.ts.
export const MOBILE_ARTICLES: Record<string, ComponentType> = {
  'building-your-bag': BuildingYourBagArticle,
  'fittings-with-coaches': FittingsWithCoachesArticle,
  'guide-to-fittings': GuideToFittingsArticle,
  'lessons-and-coaching': LessonsAndCoachingArticle,
  'measurable-goals': MeasurableGoalsArticle,
  'operation-36': Operation36Article,
  'practice-modes': PracticeModesArticle,
  'practice-vs-scoring-round': PracticeVsScoringRoundArticle,
  'questions-for-coach': QuestionsForCoachArticle,
  'self-diagnosis': SelfDiagnosisArticle,
  'swing-variations': SwingVariationsArticle,
  'training-aids': TrainingAidsArticle,
  'understanding-your-swing': UnderstandingYourSwingArticle,
}
