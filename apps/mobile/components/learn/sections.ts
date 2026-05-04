export type ArticleStatus = 'live' | 'stub'

export interface ArticleStub {
  id: string
  title: string
  status: ArticleStatus
}

export interface LearnSection {
  id: string
  number: string
  title: string
  articles: ArticleStub[]
}

export const LEARN_SECTIONS: LearnSection[] = [
  {
    id: 'understanding-the-game',
    number: 'Section one',
    title: 'Understanding the game',
    articles: [
      { id: 'strokes-gained', title: 'How strokes gained works', status: 'live' },
      { id: 'benchmarks', title: 'Reading your stats', status: 'live' },
      { id: 'glossary', title: 'Glossary of golf terms', status: 'live' },
    ],
  },
  {
    id: 'your-equipment',
    number: 'Section two',
    title: 'Your equipment',
    articles: [
      { id: 'guide-to-fittings', title: 'Guide to golf fittings', status: 'stub' },
      { id: 'training-aids', title: 'Training aids explained', status: 'stub' },
      { id: 'building-your-bag', title: 'Building your bag', status: 'stub' },
    ],
  },
  {
    id: 'improving-your-game',
    number: 'Section three',
    title: 'Improving your game',
    articles: [
      { id: 'how-to-practice', title: 'How to practice effectively', status: 'stub' },
      { id: 'practice-modes', title: 'Block, random, and pressure practice', status: 'stub' },
      { id: 'measurable-goals', title: 'Creating measurable practice goals', status: 'stub' },
      { id: 'skill-and-pressure-games', title: 'Skill games and pressure games', status: 'stub' },
      { id: 'understanding-your-swing', title: 'Understanding your own swing', status: 'stub' },
      { id: 'swing-variations', title: 'Swing variations for different body types', status: 'stub' },
      { id: 'operation-36', title: 'The Operation 36 philosophy', status: 'stub' },
    ],
  },
  {
    id: 'on-the-course',
    number: 'Section four',
    title: 'On the course',
    articles: [
      { id: 'course-management', title: 'Course management guide', status: 'stub' },
      { id: 'mental-game', title: 'Mental game and on-course psychology', status: 'stub' },
      { id: 'practice-vs-scoring-round', title: 'Practice round vs scoring round', status: 'stub' },
      { id: 'self-diagnosis', title: 'Self-diagnosis: finding your weaknesses', status: 'stub' },
    ],
  },
  {
    id: 'working-with-coaches',
    number: 'Section five',
    title: 'Working with coaches',
    articles: [
      { id: 'lessons-and-coaching', title: 'Guide to lessons and coaching', status: 'stub' },
      { id: 'fittings-with-coaches', title: 'Guide to golf fittings (all types)', status: 'stub' },
      { id: 'questions-for-coach', title: 'Questions to ask your coach', status: 'stub' },
    ],
  },
]

export function findArticle(id: string): { article: ArticleStub; section: LearnSection } | null {
  for (const section of LEARN_SECTIONS) {
    const article = section.articles.find((a) => a.id === id)
    if (article) return { article, section }
  }
  return null
}
