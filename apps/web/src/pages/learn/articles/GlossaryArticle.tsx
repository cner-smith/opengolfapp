import { Body, Lede } from '../components/ArticlePrimitives'
import type { ReactNode } from 'react'

export function GlossaryArticle() {
  return (
    <article
      id="glossary"
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 14 }}>
        Understanding the game · Glossary
      </div>
      <h2
        className="font-serif text-caddie-ink"
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontStyle: 'italic',
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          marginBottom: 18,
        }}
      >
        Stat glossary.
      </h2>

      <Term kicker="Handicap index" title="The handicap, briefly.">
        <Lede>
          A handicap index is your <em>potential best</em> — the average
          of your eight best score differentials over the last twenty
          rounds, give or take. It is not your average score; it's a
          portrait of what you can do when things go right.
        </Lede>
        <Body>
          Each round's "score differential" adjusts the raw score for
          course difficulty (rating + slope), so 84 at a brutal track is
          treated more kindly than 84 at a pitch-and-putt. After you
          post a round, the system recomputes your index, which is why
          your number can move a touch even after you played well.
        </Body>
      </Term>

      <Term kicker="GIR" title="Greens in regulation.">
        <Lede>
          Reaching the green in <em>par minus two</em> strokes — one on
          a par-3, two on a par-4, three on a par-5. Once on, you have
          two putts to match par.
        </Lede>
        <Body>
          GIR percentage is the cleanest read on ball-striking. PGA Tour
          pros sit around 67%, scratch amateurs 50%, low double digits
          land closer to 30%. Ten extra GIRs across a season tend to
          translate to a couple of strokes in scoring average.
        </Body>
      </Term>

      <Term kicker="Scrambling" title="When you miss the green.">
        <Lede>
          The percent of holes where you missed the green and{' '}
          <em>still made par or better</em>. It rewards saving strokes
          you should have lost.
        </Lede>
        <Body>
          A useful pair with GIR — high GIR with low scrambling means
          you bleed strokes whenever the ball-striking blinks. High
          scrambling with low GIR means your short game props you up,
          but a leak above the green still costs you long-term.
        </Body>
      </Term>

      <Term kicker="Up and down" title="Two strokes from off the green.">
        <Lede>
          A subset of scrambling: a <em>chip and a putt</em> from within
          ~30 yards of the green, completed without going to a third
          shot. Doesn't apply when you're already on the green or when
          you've reached green-side bunker territory.
        </Lede>
        <Body>
          Tour up-and-down rate hovers around 60%. For mid-handicaps
          it's closer to 30%. Improving here is largely about distance
          control on chips and reading the first putt.
        </Body>
      </Term>

      <Term kicker="Sand save" title="From the bunker, par or better.">
        <Lede>
          A specific case: any hole where one of your shots was hit from
          a sand bunker and you still made par or better. Hard for
          amateurs because the shot itself is hard.
        </Lede>
        <Body>
          A 50% sand save is excellent recreational play; the field
          average is closer to 35%. The right baseline depends on how
          far from the hole you typically end up — a buried 30-yard
          bunker shot is a different animal than a tap from a green-side
          trap.
        </Body>
      </Term>

      <Term kicker="Dispersion" title="Reading your shot pattern.">
        <Lede>
          The pattern of where your shots actually land relative to
          where you aimed. Centred on your aim point, not the pin.
        </Lede>
        <Body>
          The inner ellipse covers 68% of your shots — your typical
          window. The outer one covers 95% — including the bad ones. Two
          ellipses tilted right of centre means a fade pattern; shifted
          long means you over-club. Aim correction tips you to move the
          centre back over the target by adjusting aim the opposite way
          of the bias.
        </Body>
      </Term>
    </article>
  )
}

function Term({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        borderTop: '1px solid #D9D2BF',
        paddingTop: 22,
        marginBottom: 32,
      }}
    >
      <div className="kicker" style={{ marginBottom: 12 }}>
        {kicker}
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
      {children}
    </section>
  )
}
