import {
  LEARN_SECTIONS,
  SECTION_LINKS,
  type LearnSection,
} from '../data/learnSections'

export function LearnTableOfContents({
  sections = LEARN_SECTIONS,
}: {
  sections?: LearnSection[]
}) {
  return (
    <section
      style={{
        border: '1px solid #D9D2BF',
        background: '#FBF8F1',
        borderRadius: 4,
        padding: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Contents
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sections.map((s) => (
          <div key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="font-serif text-caddie-ink"
              style={{
                fontSize: 17,
                fontWeight: 500,
                fontStyle: 'italic',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              {s.title}
              <span
                className="font-mono uppercase text-caddie-ink-mute"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  fontStyle: 'normal',
                  fontWeight: 500,
                  marginLeft: 10,
                }}
              >
                {s.articles.length} {s.articles.length === 1 ? 'article' : 'articles'}
              </span>
            </a>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '6px 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {s.articles.map((a) => (
                <li key={a.id}>
                  <a
                    href={`#${a.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      document
                        .getElementById(a.id)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="text-caddie-ink-dim"
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      textDecoration: 'none',
                    }}
                  >
                    {a.title}
                    {a.status === 'stub' && (
                      <span
                        className="font-mono uppercase text-caddie-ink-mute"
                        style={{
                          fontSize: 9,
                          letterSpacing: '0.14em',
                          marginLeft: 8,
                        }}
                      >
                        Soon
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function JumpSheet({
  activeId,
  onSelect,
  onClose,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(28,33,28,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-caddie-surface w-full"
        style={{
          maxWidth: 480,
          borderTop: '1px solid #9F9580',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: 18,
          paddingBottom: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kicker" style={{ marginBottom: 14 }}>
          Jump to section
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
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #D9D2BF',
                  fontSize: 15,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: active ? '#1F3D2C' : '#1C211C',
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'Fraunces, serif',
                  fontStyle: 'italic',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
