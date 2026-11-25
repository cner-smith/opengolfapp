import type { ReactNode } from 'react'

// Data sources page (#1382): who made the data OGA shows, and under what
// licence. Same inline primitives as SupportPage.
const ISSUES_URL = 'https://github.com/cner-smith/opengolfapp/issues'

export function DataSourcesPage() {
  return (
    <main style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
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
          Where the data comes from
        </h1>
        <p
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 10, lineHeight: 1.55, maxWidth: 600 }}
        >
          OGA is built on open data. These are the people and agencies who made it, and the terms we use it under.
        </p>

        <div style={{ marginTop: 36 }}>
          <H2>Courses and holes</H2>
          <P>
            Course names, holes, tees and pins come from{' '}
            <ExtLink href="https://opengolfapi.org">OpenGolfAPI</ExtLink>,{' '}
            <ExtLink href="https://golfcourseapi.com">GolfCourseAPI</ExtLink> and ©{' '}
            <ExtLink href="https://www.openstreetmap.org/copyright">OpenStreetMap</ExtLink> contributors, available
            under the Open Database License (ODbL).
          </P>

          <Hr />

          <H2>Green slope maps</H2>
          <P>
            The height and slope of each green come from airborne lidar surveys. Each green names its survey under
            its map.
          </P>
          <P>
            <strong>USGS 3D Elevation Program (3DEP)</strong>, U.S. Geological Survey.{' '}
            <ExtLink href="https://www.usgs.gov/3d-elevation-program">usgs.gov/3d-elevation-program</ExtLink>. Public
            domain.
          </P>
          <P>
            <strong>Oregon Department of Geology and Mineral Industries / Oregon Lidar Consortium</strong>, bare-earth
            lidar for Oregon.{' '}
            <ExtLink href="https://www.oregon.gov/dogami/lidar/Pages/index.aspx">oregon.gov/dogami/lidar</ExtLink>.
            Public domain.
          </P>

          <Hr />

          <H2>Green outlines</H2>
          <P>
            We trace each green&rsquo;s edge from <strong>USDA National Agriculture Imagery Program (NAIP)</strong>{' '}
            aerial photos (public domain), using OpenStreetMap&rsquo;s green shapes as a starting hint. Players can
            redraw an outline that looks off.
          </P>
          <P>
            Because the outlines build on OpenStreetMap data, the green outline layer is published under the{' '}
            <ExtLink href="https://opendatacommons.org/licenses/odbl/">Open Database License (ODbL)</ExtLink>. To get
            a copy, <ExtLink href={ISSUES_URL}>open an issue</ExtLink> and ask.
          </P>

          <Hr />

          <H2>Maps</H2>
          <P>
            The satellite map is from <ExtLink href="https://www.mapbox.com/about/maps">Mapbox</ExtLink> and its
            imagery providers, credited on the map itself.
          </P>
        </div>

        <Footnote>
          Last updated: 25 November 2026. Spotted a missing or wrong credit?{' '}
          <ExtLink href={ISSUES_URL}>Tell us on GitHub</ExtLink>.
        </Footnote>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Local primitives — same shape as PrivacyPage, kept inline so this page
// doesn't pull in the Learn article registry chunk.
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
