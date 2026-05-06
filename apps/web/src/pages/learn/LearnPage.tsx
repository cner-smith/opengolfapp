import { useState } from 'react'
import { useDetailedStats } from '../../hooks/useDetailedStats'
import { SECTION_LINKS } from './data/learnSections'
import { useActiveSection } from './hooks/useActiveSection'
import { Footnote } from './components/ArticlePrimitives'
import {
  JumpSheet,
  LearnTableOfContents,
} from './components/LearnTableOfContents'
import { UnderstandingTheGame } from './sections/UnderstandingTheGame'
import { YourEquipment } from './sections/YourEquipment'
import { ImprovingYourGame } from './sections/ImprovingYourGame'
import { OnTheCourse } from './sections/OnTheCourse'
import { WorkingWithCoaches } from './sections/WorkingWithCoaches'

export function LearnPage() {
  const stats = useDetailedStats(10)
  const me = stats.data ?? null
  const activeId = useActiveSection()
  const [jumpOpen, setJumpOpen] = useState(false)

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[1fr_220px]"
      style={{ gap: 32 }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 28 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Yardage book
          </div>
          <h1
            className="font-serif text-caddie-ink"
            style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
          >
            Learn
          </h1>
          <p
            className="text-caddie-ink-dim"
            style={{ fontSize: 15, marginTop: 6, maxWidth: 640 }}
          >
            A coach's column on the stats this app tracks — what they
            mean, why they matter, and what the numbers look like across
            the field.
          </p>
        </div>

        <LearnTableOfContents />

        <UnderstandingTheGame me={me} />
        <YourEquipment />
        <ImprovingYourGame />
        <OnTheCourse />
        <WorkingWithCoaches />

        <Footnote>
          Benchmarks based on Mark Broadie's strokes gained research
          and PGA Tour ShotLink data. Amateur averages approximate.
        </Footnote>
      </div>

      <aside
        className="hidden lg:block"
        style={{
          alignSelf: 'start',
          position: 'sticky',
          top: 28,
        }}
      >
        <div className="kicker" style={{ marginBottom: 12 }}>
          On this page
        </div>
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid #D9D2BF',
          }}
        >
          {SECTION_LINKS.map((s) => {
            const active = activeId === s.id
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(s.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #D9D2BF',
                  fontSize: 13,
                  color: active ? '#1F3D2C' : '#5C6356',
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                {s.label}
              </a>
            )
          })}
        </nav>
      </aside>

      <button
        type="button"
        onClick={() => setJumpOpen(true)}
        className="lg:hidden fixed"
        style={{
          right: 18,
          bottom: 18,
          background: '#FBF8F1',
          border: '1px solid #9F9580',
          borderRadius: 999,
          padding: '12px 16px',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#1C211C',
          zIndex: 30,
        }}
      >
        Jump to section
      </button>

      {jumpOpen && (
        <JumpSheet
          activeId={activeId}
          onSelect={(id) => {
            document
              .getElementById(id)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setJumpOpen(false)
          }}
          onClose={() => setJumpOpen(false)}
        />
      )}
    </div>
  )
}
