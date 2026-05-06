import { LEARN_SECTIONS } from '../data/learnSections'
import { SectionHeader } from '../components/ArticlePrimitives'
import { LiveArticle } from '../components/LiveArticle'
import { StubEntry } from '../components/ArticleStub'

export function YourEquipment() {
  const section = LEARN_SECTIONS.find((s) => s.id === 'your-equipment')!
  return (
    <>
      <SectionHeader id={section.id} number={section.number} title={section.title} />
      {section.articles.map((a) =>
        a.status === 'live' ? (
          <LiveArticle key={a.id} id={a.id} title={a.title} />
        ) : (
          <StubEntry key={a.id} id={a.id} title={a.title} />
        ),
      )}
    </>
  )
}
