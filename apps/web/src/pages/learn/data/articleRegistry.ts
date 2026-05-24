import type { ComponentType } from 'react'
import { CourseManagementArticle } from '../articles/CourseManagementArticle'
import { GlossaryArticle } from '../articles/GlossaryArticle'
import { GuideToFittingsArticle } from '../articles/GuideToFittingsArticle'
import { HowToPracticeArticle } from '../articles/HowToPracticeArticle'
import { LessonsAndCoachingArticle } from '../articles/LessonsAndCoachingArticle'
import { MentalGameArticle } from '../articles/MentalGameArticle'
import { Operation36Article } from '../articles/Operation36Article'
import { ReadingStatsArticle } from '../articles/ReadingStatsArticle'
import { SelfDiagnosisArticle } from '../articles/SelfDiagnosisArticle'
import { SkillGamesArticle } from '../articles/SkillGamesArticle'
import { StrokesGainedArticle } from '../articles/StrokesGainedArticle'

const ARTICLE_COMPONENTS: Record<string, ComponentType> = {
  'strokes-gained': StrokesGainedArticle,
  benchmarks: ReadingStatsArticle,
  glossary: GlossaryArticle,
  'how-to-practice': HowToPracticeArticle,
  'course-management': CourseManagementArticle,
  'mental-game': MentalGameArticle,
  'skill-games-pressure-games': SkillGamesArticle,
  'self-diagnosis': SelfDiagnosisArticle,
  'guide-to-fittings': GuideToFittingsArticle,
  'operation-36': Operation36Article,
  'lessons-and-coaching': LessonsAndCoachingArticle,
}

export function getArticleComponent(slug: string): ComponentType | null {
  return ARTICLE_COMPONENTS[slug] ?? null
}
