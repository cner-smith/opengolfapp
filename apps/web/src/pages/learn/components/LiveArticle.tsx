import { CourseManagementArticle } from '../articles/CourseManagementArticle'
import { HowToPracticeArticle } from '../articles/HowToPracticeArticle'
import { StubEntry } from './ArticleStub'

export function LiveArticle({ id, title }: { id: string; title: string }) {
  switch (id) {
    case 'how-to-practice':
      return <HowToPracticeArticle />
    case 'course-management':
      return <CourseManagementArticle />
    default:
      return <StubEntry id={id} title={title} />
  }
}
