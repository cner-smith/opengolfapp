import type { ReactNode } from 'react'

// Privacy policy. Plain language, no boilerplate. Mirrors the Learn
// article styling (kicker → italic title → H3 / P / Hr blocks) so it
// reads as part of the same editorial voice.
export function PrivacyPage() {
  return (
    <main style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 28px',
        }}
      >
        <div className="kicker" style={{ marginBottom: 8 }}>
          Privacy
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
          What we collect, and why.
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 10, lineHeight: 1.55, maxWidth: 600 }}
        >
          OGA is free and open source. We collect the minimum data
          required to run the service and never sell it.
        </p>

        <div style={{ marginTop: 36 }}>
          <H3>What we collect</H3>
          <P>
            <strong>Account.</strong> Your email address and a hashed
            password (or the OAuth identifier from your provider when you
            sign in with one). That's it for account data — no name, no
            phone, no address.
          </P>
          <P>
            <strong>Profile.</strong> The fields you fill in during
            onboarding: skill level, goal, handicap index, play frequency,
            and the equipment you tell us you carry. You can edit or
            delete any of this from <em>Settings</em>.
          </P>
          <P>
            <strong>Round data.</strong> The rounds you log: courses
            played, scores, hole-by-hole shot data, club used, lie type
            and slope, putt outcomes, and the GPS coordinates of each
            shot when you use the live tracker. We need this to compute
            strokes gained, your handicap, and shot patterns.
          </P>
          <P>
            <strong>GPS during live rounds.</strong> While you're tracking
            a round, the app reads your device's GPS to place shots on the
            map. The samples are stored as part of the round you saved —
            we don't keep a continuous location stream, and we don't track
            you when the app is closed or in the background.
          </P>

          <Hr />

          <H3>How we use it</H3>
          <P>
            Your data exists for a single reason: to compute the things
            the app shows you. Strokes gained, dispersion patterns, your
            handicap index, and the practice plan that is calibrated to
            them. We don't analyze it for any other purpose, and we don't
            train models on it.
          </P>
          <P>
            We don't run advertising. We don't share or sell your data to
            anyone. There are no third-party trackers in the app.
          </P>

          <Hr />

          <H3>Where it lives</H3>
          <P>
            All data is stored in a Postgres database hosted on{' '}
            <ExtLink href="https://supabase.com">Supabase</ExtLink>. Their
            privacy policy is{' '}
            <ExtLink href="https://supabase.com/privacy">here</ExtLink>.
            Maps are rendered via{' '}
            <ExtLink href="https://www.mapbox.com">Mapbox</ExtLink> — they
            see the bounding box of the area you're viewing in order to
            serve the satellite tiles, but they don't see your shot
            placements or any other round data.
          </P>
          <P>
            Course geometry comes from{' '}
            <ExtLink href="https://opengolfapi.org">OpenGolfAPI</ExtLink>{' '}
            and{' '}
            <ExtLink href="https://www.openstreetmap.org">
              OpenStreetMap
            </ExtLink>
            ; queries to those services are scoped to the course you
            select and don't include any account information.
          </P>

          <Hr />

          <H3>Deleting your account and data</H3>
          <P>
            Open <em>Settings</em> and use the "Delete account" action.
            That removes your profile, all rounds, all shot data, and all
            user-attributed rows. Course geometry and other shared data
            stays — it isn't yours to delete.
          </P>
          <P>
            No longer have the app installed? Email{' '}
            <ExtLink href="mailto:support@oga.golf">support@oga.golf</ExtLink>{' '}
            to request deletion of your account and all of its data.
          </P>
          <P>
            If something goes wrong with self-service deletion, open a
            ticket on{' '}
            <ExtLink href="https://github.com/cner-smith/opengolfapp/issues">
              GitHub Issues
            </ExtLink>{' '}
            and we'll handle it manually.
          </P>

          <Hr />

          <H3>Questions, complaints, corrections</H3>
          <P>
            The project is open source and run by one person.{' '}
            <ExtLink href="https://github.com/cner-smith/opengolfapp/issues">
              File an issue
            </ExtLink>{' '}
            if you want something changed, removed, or explained. There's
            no support email; the issue tracker is the contact channel.
          </P>
        </div>

        <Footnote>
          Last reviewed: May 2026. Material changes will be noted at the
          top of this page.
        </Footnote>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Local primitives — same shape as Learn articles but kept inline so this
// page doesn't pull in the article registry chunk.
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
    <hr
      style={{
        border: 0,
        borderTop: '1px solid #D9D2BF',
        margin: '26px 0',
      }}
    />
  )
}

function ExtLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
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
