export type ArticleStatus = 'live' | 'stub'

export interface ArticleStub {
  id: string
  title: string
  description: string
  status: ArticleStatus
  /** Approx word count for prose-only articles. Used for reading time. */
  words?: number
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
      {
        id: 'strokes-gained',
        title: 'How strokes gained works',
        description:
          'How every shot is graded against an expectation, and what +0.3 SG-Putting actually means.',
        status: 'live',
        words: 720,
      },
      {
        id: 'benchmarks',
        title: 'Reading your stats',
        description:
          'Where each stat lands across the field, from a 25-handicap weekend round up to the PGA Tour.',
        status: 'live',
        words: 200,
      },
      {
        id: 'glossary',
        title: 'Glossary of golf terms',
        description:
          'Handicap, GIR, scrambling, up-and-down, sand save, dispersion — the working vocabulary of the app.',
        status: 'live',
        words: 700,
      },
    ],
  },
  {
    id: 'your-equipment',
    number: 'Section two',
    title: 'Your equipment',
    articles: [
      {
        id: 'guide-to-fittings',
        title: 'Guide to golf fittings',
        description: 'What a fitting actually changes and when one is worth the money.',
        status: 'stub',
      },
      {
        id: 'training-aids',
        title: 'Training aids explained',
        description: 'Which devices teach a real skill and which ones just feel productive.',
        status: 'stub',
      },
      {
        id: 'building-your-bag',
        title: 'Building your bag',
        description: 'Picking 14 clubs that cover your distances without dead zones.',
        status: 'stub',
      },
    ],
  },
  {
    id: 'improving-your-game',
    number: 'Section three',
    title: 'Improving your game',
    articles: [
      {
        id: 'how-to-practice',
        title: 'How to practice effectively',
        description:
          'Block, random, variable, pressure — what each kind of practice is for and when to use it.',
        status: 'live',
        words: 2700,
      },
      {
        id: 'practice-modes',
        title: 'Block, random, and pressure practice',
        description: 'A deeper look at the three modes and how to combine them.',
        status: 'stub',
      },
      {
        id: 'measurable-goals',
        title: 'Creating measurable practice goals',
        description: 'Turning "work on my irons" into something you can actually pass or fail.',
        status: 'stub',
      },
      {
        id: 'skill-and-pressure-games',
        title: 'Skill games and pressure games',
        description: 'Range games that build skills that survive the first tee.',
        status: 'stub',
      },
      {
        id: 'understanding-your-swing',
        title: 'Understanding your own swing',
        description: 'Reading your own miss patterns without an instructor in the bay.',
        status: 'stub',
      },
      {
        id: 'swing-variations',
        title: 'Swing variations for different body types',
        description: 'Why the textbook swing fits some bodies and not others.',
        status: 'stub',
      },
      {
        id: 'operation-36',
        title: 'The Operation 36 philosophy',
        description: 'Building a game from inside out, par at every distance.',
        status: 'stub',
      },
    ],
  },
  {
    id: 'on-the-course',
    number: 'Section four',
    title: 'On the course',
    articles: [
      {
        id: 'course-management',
        title: 'Course management guide',
        description:
          'Way of the Playa, the Scoring Zone, planning a hole backwards. The mental side of shooting your number.',
        status: 'live',
        words: 2200,
      },
      {
        id: 'mental-game',
        title: 'Mental game and on-course psychology',
        description: 'Routines, target focus, recovering from a bad shot mid-round.',
        status: 'stub',
      },
      {
        id: 'practice-vs-scoring-round',
        title: 'Practice round vs scoring round',
        description: 'Two different activities you should never mix.',
        status: 'stub',
      },
      {
        id: 'self-diagnosis',
        title: 'Self-diagnosis: finding your weaknesses',
        description: 'Using your own SG and pattern data to know where strokes are leaking.',
        status: 'stub',
      },
    ],
  },
  {
    id: 'working-with-coaches',
    number: 'Section five',
    title: 'Working with coaches',
    articles: [
      {
        id: 'lessons-and-coaching',
        title: 'Guide to lessons and coaching',
        description: 'Picking an instructor and getting a return on the lesson hour.',
        status: 'stub',
      },
      {
        id: 'fittings-with-coaches',
        title: 'Guide to golf fittings (all types)',
        description: 'Driver, iron, wedge, putter — what each fitting covers.',
        status: 'stub',
      },
      {
        id: 'questions-for-coach',
        title: 'Questions to ask your coach',
        description: 'The conversation that makes a lesson stick beyond the bay.',
        status: 'stub',
      },
    ],
  },
]

export interface SectionLink {
  id: string
  label: string
}

export const SECTION_LINKS: SectionLink[] = LEARN_SECTIONS.map((s) => ({
  id: s.id,
  label: s.title,
}))

export function findArticle(
  slug: string,
): { article: ArticleStub; section: LearnSection } | null {
  for (const section of LEARN_SECTIONS) {
    const article = section.articles.find((a) => a.id === slug)
    if (article) return { article, section }
  }
  return null
}

export function readingTimeMinutes(article: ArticleStub): number | null {
  if (!article.words) return null
  return Math.max(1, Math.ceil(article.words / 200))
}
