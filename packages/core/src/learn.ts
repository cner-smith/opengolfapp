// Learn-section catalog: shared between web and mobile so the two apps
// can never drift on article ids, descriptions, or status vocabulary.

export type ArticleStatus = 'published' | 'draft' | 'soon'

export interface LearnArticle {
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
  articles: LearnArticle[]
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
        status: 'published',
        words: 720,
      },
      {
        id: 'benchmarks',
        title: 'Reading your stats',
        description:
          'Where each stat lands across the field, from a 25-handicap weekend round up to the PGA Tour.',
        status: 'published',
        words: 200,
      },
      {
        id: 'glossary',
        title: 'Glossary of golf terms',
        description:
          'Intermediate and advanced terms beyond the basics — shot shapes, green reading, slang, rules, and historical terms.',
        status: 'published',
        words: 3500,
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
        status: 'published',
        words: 2200,
      },
      {
        id: 'training-aids',
        title: 'Training aids explained',
        description: 'Which devices teach a real skill and which ones just feel productive.',
        status: 'published',
        words: 1400,
      },
      {
        id: 'building-your-bag',
        title: 'Building your bag',
        description: 'Picking 14 clubs that cover your distances without dead zones.',
        status: 'published',
        words: 850,
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
          'Block, random, skill games, pressure — what each kind of practice is for and when to use it.',
        status: 'published',
        words: 2700,
      },
      {
        id: 'practice-modes',
        title: 'Block, random, and pressure practice',
        description: 'A deeper look at the three modes and how to combine them.',
        status: 'published',
        words: 800,
      },
      {
        id: 'measurable-goals',
        title: 'Creating measurable practice goals',
        description: 'Turning "work on my irons" into something you can actually pass or fail.',
        status: 'published',
        words: 800,
      },
      {
        id: 'skill-games-pressure-games',
        title: 'Skill games and pressure games',
        description:
          'Clock drill, putting circuits, flag left or right, HORSE, and why the last ball in the bucket matters.',
        status: 'published',
        words: 1900,
      },
      {
        id: 'understanding-your-swing',
        title: 'Understanding your own swing',
        description: 'Reading your own miss patterns without an instructor in the bay.',
        status: 'published',
        words: 900,
      },
      {
        id: 'swing-variations',
        title: 'Swing variations for different body types',
        description: 'Why the textbook swing fits some bodies and not others.',
        status: 'published',
        words: 2400,
      },
      {
        id: 'operation-36',
        title: 'The Operation 36 philosophy',
        description: 'Building a game from inside out, par at every distance.',
        status: 'published',
        words: 1600,
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
        status: 'published',
        words: 2200,
      },
      {
        id: 'mental-game',
        title: 'The mental game',
        description:
          'One shot at a time, the productive delusion, visualization, and staying calm when it matters.',
        status: 'published',
        words: 2900,
      },
      {
        id: 'practice-vs-scoring-round',
        title: 'Practice round vs scoring round',
        description: 'Two different activities you should never mix.',
        status: 'published',
        words: 1700,
      },
      {
        id: 'self-diagnosis',
        title: 'Self-diagnosis: finding your weaknesses',
        description:
          'A framework for reading your own miss patterns and finding where your game leaks strokes.',
        status: 'published',
        words: 1500,
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
        status: 'published',
        words: 1300,
      },
      {
        id: 'fittings-with-coaches',
        title: 'Fittings and your coach',
        description: 'Who should fit you, and timing a fitting around your lessons.',
        status: 'published',
        words: 1000,
      },
      {
        id: 'questions-for-coach',
        title: 'Questions to ask your coach',
        description: 'The conversation that makes a lesson stick beyond the bay.',
        status: 'published',
        words: 900,
      },
    ],
  },
]

export function findLearnArticle(
  slug: string,
): { article: LearnArticle; section: LearnSection } | null {
  for (const section of LEARN_SECTIONS) {
    const article = section.articles.find((a) => a.id === slug)
    if (article) return { article, section }
  }
  return null
}

const WORDS_PER_MINUTE = 200

export function readingTimeMinutes(article: LearnArticle): number | null {
  if (!article.words) return null
  return Math.max(1, Math.ceil(article.words / WORDS_PER_MINUTE))
}

// Readable articles across every section — everything except 'soon' stubs,
// which aren't tappable. Single source so the Learn index's count and the
// home preview's "See all N" can never drift apart. #524
export const READABLE_LEARN_ARTICLES: LearnArticle[] = LEARN_SECTIONS.flatMap(
  (s) => s.articles,
).filter((a) => a.status !== 'soon')
