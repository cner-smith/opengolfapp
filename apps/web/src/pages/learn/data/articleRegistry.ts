import type { ComponentType } from 'react'
import { CourseManagementArticle } from '../articles/CourseManagementArticle'
import { GlossaryArticle } from '../articles/GlossaryArticle'
import { HowToPracticeArticle } from '../articles/HowToPracticeArticle'
import { MentalGameArticle } from '../articles/MentalGameArticle'
import { ReadingStatsArticle } from '../articles/ReadingStatsArticle'
import { StrokesGainedArticle } from '../articles/StrokesGainedArticle'

const ARTICLE_COMPONENTS: Record<string, ComponentType> = {
  'strokes-gained': StrokesGainedArticle,
  benchmarks: ReadingStatsArticle,
  glossary: GlossaryArticle,
  'how-to-practice': HowToPracticeArticle,
  'course-management': CourseManagementArticle,
  'mental-game': MentalGameArticle,
}

export function getArticleComponent(slug: string): ComponentType | null {
  return ARTICLE_COMPONENTS[slug] ?? null
}
