import type { ReactNode } from 'react'

// Support page. Apple requires a reachable support URL for App Store
// submission. Kept honest: OGA is one person's open-source project, so the
// contact channel is the public issue tracker — mirrors the stance already
// stated on the privacy page. Same inline-primitive styling as PrivacyPage
// so it doesn't pull in the Learn article chunk.
const ISSUES_URL = 'https://github.com/cner-smith/opengolfapp/issues'

export function SupportPage() {
  return (
    <main style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Support
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 38,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Stuck? Here's how to get help.
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 10, lineHeight: 1.55, maxWidth: 600 }}
        >
          OGA is free, open source, and run by one person. There's no call
          center — but every question reaches a human, and nothing's hidden.
        </p>

        <div style={{ marginTop: 36 }}>
          <H3>Start with Learn</H3>
          <P>
            Most "how does this work" questions — strokes gained, shot
            patterns, what a stat means — are answered in{' '}
            <a
              href="/learn"
              style={{ color: '#1F3D2C', textDecoration: 'underline' }}
            >
              the yardage book
            </a>
            . It's written to teach the concepts, not just the app.
          </P>

          <Hr />

          <H3>Report a bug or ask a question</H3>
          <P>
            The contact channel is{' '}
            <ExtLink href={ISSUES_URL}>GitHub Issues</ExtLink>. Open one for a
            bug, a question, a feature idea, or anything that looks wrong. It's
            public, so the answer helps the next person too.
          </P>
          <P>
            For a bug, it helps to include: what you were doing, what you
            expected, what happened instead, and your platform (web, or the
            Android / iOS app). A screenshot is worth a paragraph.
          </P>

          <Hr />

          <H3>Your account and data</H3>
          <P>
            You can delete your account and all of its data yourself, at any
            time, from <em>Settings</em> (in the app, under your profile). It's
            permanent and immediate.
          </P>
          <P>
            No longer have the app installed? Email{' '}
            <a
              href="mailto:support@oga.golf"
              style={{ color: '#1F3D2C', textDecoration: 'underline' }}
            >
              support@oga.golf
            </a>{' '}
            to request deletion of your account and all of its data.
          </P>
          <P>
            For anything else about your data — a correction, an export, a
            question about what's stored — open an issue and we'll handle it.
            The full rundown of what we collect is on the{' '}
            <a
              href="/privacy"
              style={{ color: '#1F3D2C', textDecoration: 'underline' }}
            >
              privacy page
            </a>
            .
          </P>

          <Hr />

          <H3>How fast you'll hear back</H3>
          <P>
            One person maintains this in their spare time, so there's no
            guaranteed response time — but issues are read, and real bugs get
            fixed. If something is broken for you, it's worth reporting; that's
            how most of the app got better.
          </P>
        </div>

        <Footnote>
          Last reviewed: June 2026. The fastest way to reach the project is the
          issue tracker linked above.
        </Footnote>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Local primitives — same shape as PrivacyPage, kept inline so this page
// doesn't pull in the Learn article registry chunk.
// ---------------------------------------------------------------------------

function H3({ children }: { children: ReactNode }) {
  return (
    <h3
      className="font-serif text-caddie-ink"
      style={{
        fontSize: 22,
        fontWeight: 500,
        fontStyle: 'italic',
        lineHeight: 1.2,
        marginTop: 28,
        marginBottom: 14,
      }}
    >
      {children}
    </h3>
  )
}

function P({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-caddie-ink"
      style={{ fontSize: 15, lineHeight: 1.65, marginBottom: 14 }}
    >
      {children}
    </p>
  )
}

function Hr() {
  return (
    <hr style={{ border: 0, borderTop: '1px solid #D9D2BF', margin: '26px 0' }} />
  )
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ color: '#1F3D2C', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

function Footnote({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono uppercase text-caddie-ink-mute"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        borderTop: '1px solid #D9D2BF',
        paddingTop: 18,
        marginTop: 36,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}
