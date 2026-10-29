import { useEffect } from 'react'

// Names the page in the tab, history and screen readers (WCAG 2.4.2), and
// puts the previous title back on the way out so a page without one never
// inherits a stale name.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
