import type { ComponentType } from 'react'
import { CourseManagementArticle } from '../articles/CourseManagementArticle'
import { GlossaryArticle } from '../articles/GlossaryArticle'
import { GuideToFittingsArticle } from '../articles/GuideToFittingsArticle'
import { HowToPracticeArticle } from '../articles/HowToPracticeArticle'
import { MentalGameArticle } from '../articles/MentalGameArticle'
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
}

export function getArticleComponent(slug: string): ComponentType | null {
  return ARTICLE_COMPONENTS[slug] ?? null
}
