import { useEffect, useState } from 'react'
import { SECTION_LINKS } from '../data/learnSections'

export function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(SECTION_LINKS[0]?.id ?? null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0.1 },
    )
    for (const link of SECTION_LINKS) {
      const el = document.getElementById(link.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])
  return active
}
