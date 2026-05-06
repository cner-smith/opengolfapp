import { HowToPracticeArticle } from '../articles/HowToPracticeArticle'
import { StubEntry } from './ArticleStub'

export function LiveArticle({ id, title }: { id: string; title: string }) {
  switch (id) {
    case 'how-to-practice':
      return <HowToPracticeArticle />
    default:
      return <StubEntry id={id} title={title} />
  }
}
