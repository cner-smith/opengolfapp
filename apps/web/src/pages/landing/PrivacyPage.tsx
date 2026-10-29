import type { ReactNode } from 'react'

// Privacy policy. Plain language, no boilerplate. Mirrors the Learn
// article styling (italic title → H2 / P / Hr blocks) so it
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
          OGA is free and open source. We keep only what the app needs. We
          never sell your data, never use it for ads, and never give your
          account or your rounds to anyone for their own use.
        </p>

        <div style={{ marginTop: 36 }}>
          <H2>What we collect</H2>
          <P>
            <strong>Account.</strong> Your email address, a hashed password,
            and the username you pick. If you sign in with Google, we also get
            the name and picture on your Google account.
          </P>
          <P>
            <strong>Profile.</strong> What you tell us: skill level, goal,
            handicap index, how often you play, where you practise, which hand
            you play, and your clubs. Change any of it under{' '}
            <em>Profile</em>.
          </P>
          <P>
            <strong>Rounds.</strong> Courses, scores, shots, clubs, lies,
            putts, and where each shot was played from. That's what strokes
            gained, your handicap and your shot patterns are built from.
          </P>
          <P>
            <strong>Your plan note.</strong> If you leave a note for next
            week's plan, we keep it with the plan.
          </P>
          <P>
            <strong>Location, only while you use it.</strong> During a round
            the app uses your phone's GPS to place shots. We save the shot
            positions, not a trail, and the app never asks for location in
            the background. When you look for a course, it may use where you
            are to list nearby courses first; that isn't saved. A course you
            add may be placed where you are when you add it.
          </P>

          <Hr />

          <H2>Why we have it</H2>
          <P>
            To show you your own game: your stats, your patterns, your
            practice plan, and a short email after each round (switch it off
            under <em>Profile → Email</em>). We use your data to run the
            service you signed up for, to keep sign-in safe from bots, and,
            for AI plans, because you asked for one. There are no ads, no
            analytics and no tracking tools in OGA.
          </P>

          <Hr />

          <H2>Who runs parts of OGA for us</H2>
          <P>
            OGA is one person, so a few services do some of the work. They
            handle your data for OGA, not for themselves, except where noted.
          </P>
          <P>
            <strong>Supabase</strong> stores your account and everything
            above.
          </P>
          <P>
            <strong>Anthropic</strong> writes your practice plan with its AI,
            Claude, when you ask for one. It gets your skill level, handicap,
            goal, how often you play, where you practise, your strokes-gained
            averages and trends, and your plan note. Never your name, email,
            courses or shot positions. Anthropic doesn't train its models on
            it and deletes it within 30 days, longer only if it's flagged
            under their usage rules or the law requires it (
            <ExtLink href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data">
              Anthropic's retention policy
            </ExtLink>
            ). Plans are written by an AI, so use your judgement.
          </P>
          <P>
            <strong>Resend</strong> sends the round email: your email address,
            the course, your score and your strokes gained.
          </P>
          <P>
            <strong>Mapbox</strong> draws the maps, and sees your internet
            address and the part of the map you're looking at. In the phone
            apps, Mapbox's map software also sends Mapbox de-identified
            location and usage data while the app is using your location (a
            round, or finding courses near you), which Mapbox uses for its own
            products. Mapbox offers its own opt-out under the small “i” in
            the corner of the map.
          </P>
          <P>
            <strong>Vercel</strong> (the website), <strong>Expo</strong> (app
            updates, which also see a random ID for your install),{' '}
            <strong>Cloudflare Turnstile</strong> (the bot check at sign-in),{' '}
            <strong>Google Fonts</strong> (the website's type) and{' '}
            <strong>OpenGolfAPI</strong> (course search, which gets what you
            type) see your internet address and nothing from your account.
            Cloudflare also uses the check to improve Turnstile.
          </P>
          <P>
            Signing in with Google or Apple is between you and them, under
            their own policies.
          </P>
          <P>
            Your data is stored in the United States, in Supabase's Oregon
            region, and most of the services above are US companies. If you
            use OGA from outside the US, your data goes there.
          </P>

          <Hr />

          <H2>How long we keep it</H2>
          <P>
            As long as you have an account. Delete it and your data goes with
            it, straight away. Copies at the services above expire on their
            own: Anthropic's within 30 days, and Resend keeps a log of the
            emails it sent.
          </P>

          <Hr />

          <H2>Deleting your account</H2>
          <P>
            In the app or on the website: <em>Profile → Account → Delete
            account</em>. It removes your profile, rounds, shots, plans and
            clubs, permanently. Courses and drills stay because they're
            shared; a course you added stays, no longer linked to you.
          </P>
          <P>
            Can't sign in? Email{' '}
            <ExtLink href="mailto:support@oga.golf">support@oga.golf</ExtLink>{' '}
            from your account's address and we'll delete it for you.
          </P>

          <Hr />

          <H2>Your rights</H2>
          <P>
            Ask for a copy of your data, a correction, or deletion, or object
            to how we use it: email{' '}
            <ExtLink href="mailto:support@oga.golf">support@oga.golf</ExtLink>.
            In the EU or UK you can also complain to your data protection
            authority.
          </P>
          <P>
            OGA isn't meant for children under 13 (16 in the EU), and we don't
            knowingly collect their data.
          </P>

          <Hr />

          <H2>Questions, complaints, corrections</H2>
          <P>
            OGA is open source and run by one person, Conner Smith.{' '}
            <ExtLink href="https://github.com/cner-smith/opengolfapp/issues">
              File an issue
            </ExtLink>{' '}
            if you want something changed, removed, or explained. For anything
            you'd rather not post in public, email{' '}
            <ExtLink href="mailto:support@oga.golf">support@oga.golf</ExtLink>.
          </P>
        </div>

        <Footnote>
          Last updated: 29 October 2026. If this page changes in a way that
          matters, we'll say so at the top of it.
        </Footnote>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Local primitives — same shape as Learn articles but kept inline so this
// page doesn't pull in the article registry chunk.
// ---------------------------------------------------------------------------

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
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
    </h2>
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
      className="text-caddie-ink-dim"
      style={{
        fontSize: 12,
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
