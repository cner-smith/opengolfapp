// "Coming soon" placeholder rendered for every article whose content
// hasn't been written yet. Live articles route through LiveArticle
// instead — both share the article id used as the in-page anchor.
export function StubEntry({ id, title }: { id: string; title: string }) {
  return (
    <section
      id={id}
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Coming soon
      </div>
      <h3
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      <p
        className="text-caddie-ink-mute"
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          fontStyle: 'italic',
          maxWidth: 640,
        }}
      >
        This guide is being written. Check back soon.
      </p>
    </section>
  )
}
