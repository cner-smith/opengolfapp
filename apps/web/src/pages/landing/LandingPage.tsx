import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PhoneShot } from '../../components/landing/PhoneShot'
import { StoreBadges } from '../../components/landing/StoreBadges'
import '../../components/landing/landing.css'
import { Close, Free, Negation, PrimaryCta } from './LandingSections'

// The chart and its made-up bag load after the hero paints.
const PatternsDemo = lazy(() => import('../../components/landing/PatternsDemo'))
const LadderDemo = lazy(() => import('../../components/landing/LadderDemo'))

// Marketing page served at `/`. Built around the sentences OGA tells a
// golfer: the hero is one of them, a live example chart follows, and each
// section after is one more sentence beside the real screen that says it.
// Every screen is the same promo golfer, so the numbers agree across them.
export function LandingPage() {
  return (
    <main style={{ paddingBottom: 0 }}>
      <Hero />
      <TryIt />
      <Finding
        sentence="Mark the ball, set your aim, hit."
        src="/landing/round-map.webp"
        alt="Bear Creek Golf Club, hole 9, par 4, 376 yards, scored 4: three marked shots up the fairway to a 3-foot putt that was made"
        caption="Bear Creek, hole 9, after the round"
      >
        On the course OGA follows your phone&apos;s GPS. Stand by the ball and
        mark it, set where you&apos;re aiming, and play. Each mark is where a
        shot was played from, so <em>the hole draws itself</em>: here a
        376-yard par 4 in four, the last a 3-foot putt. Nothing is asked of you
        before the shot.
      </Finding>
      <Finding
        reverse
        sentence="Over your last 10 rounds, off the tee gains you 1.5 strokes a round. Approach gives back 0.8."
        src="/landing/stats.webp"
        alt="Stats, last 10 rounds against a 12-handicap: off the tee +1.51, approach −0.79, around the green +0.90, putting +0.98, with a round-by-round chart"
        caption="Stats, last 10 rounds"
        to="/learn/strokes-gained"
        linkLabel="How strokes gained works"
      >
        Every shot is scored against what a golfer of your handicap does from
        the same spot. Add those up by part of the game and you see{' '}
        <em>where a round is won and where it leaks</em>, in strokes, not
        percentages.
      </Finding>
      <Finding
        sentence="Your 7-iron finishes about 7 yd short and 6 yd right."
        src="/landing/patterns.webp"
        alt="Shot patterns for the 7-iron, 24 shots around the aim: two in three finish inside the solid ring, the average sits short and right of the aim flag"
        caption="Shot patterns, 7-iron, 24 shots"
        to="/learn/course-management"
        linkLabel="Course management guide"
      >
        You set where you&apos;re aiming before each shot, and the next mark
        is where the ball finished. Twenty-four 7-irons draw the spread: where
        two in three finish, where nearly all do, and what to do about it.{' '}
        <em>Aim about 6 yd left and take a little more club.</em>
      </Finding>
      <Finding
        reverse
        sentence="Your driver to your lob wedge, 226 to 87 yd, with every gap under 20 yd."
        src="/landing/bag.webp"
        alt="My bag, 14 clubs: typical distance per club from driver 226 to lob wedge 87 yards, with the overlaps between neighbouring clubs shaded"
        caption="My bag, typical distance per club"
        to="/learn/building-your-bag"
        linkLabel="Building your bag"
        after={<TryYourBag />}
      >
        Each club&apos;s typical distance comes from where your shots finished,
        and the bag lines up from there. <em>Overlaps show too</em>: this
        5-wood and 5-hybrid share 8 yd, so you know which one earns its
        place.
      </Finding>
      <Finding
        sentence="Two sessions this week, built on your approach."
        src="/landing/practice.webp"
        alt="Practice, week of Oct 21: two sessions, 125 minutes. The first, Iron contact and start line, 70 minutes, opens with a 7-iron calibration warm-up"
        caption="Practice, week of Oct 21"
        to="/learn/how-to-practice"
        linkLabel="How to practice effectively"
      >
        Your plan starts from your own numbers and your handicap, so{' '}
        <em>a 12 gets a 12&apos;s drills</em>, not a tour pro&apos;s. The
        first session, Iron contact and start line, opens with a 7-iron
        calibration: on the course it averages 7 yd short of where you aim.
      </Finding>
      <Free />
      <Negation />
      <Close />
    </main>
  )
}

const WRAP: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 28px' }

function Hero() {
  const { user, loading } = useAuth()
  const isAuthed = !loading && !!user
  return (
    <section className="lb-hero">
      <div style={WRAP} className="lb-hero-grid">
        <div>
          <h1 className="lb-hero-title font-serif">
            <span className="lb-hero-finding lb-rise">Approach costs you 0.8 strokes a round.</span>{' '}
            <span className="lb-hero-promise lb-rise lb-rise-2">Track your rounds. OGA finds yours.</span>
          </h1>
          <p className="lb-lede" style={{ maxWidth: 520, margin: '26px 0 0' }}>
            Free shot tracking with strokes gained, on iPhone, Android and the
            web. No sensors on your clubs, no subscription.
          </p>
          <div style={{ marginTop: 30, display: 'flex', gap: '14px 26px', alignItems: 'center', flexWrap: 'wrap' }}>
            <PrimaryCta isAuthed={isAuthed} />
            <a href="#try" className="lb-link" style={{ marginTop: 0 }}>
              Try the chart{' '}
              <span className="font-serif" style={{ fontStyle: 'italic' }}>
                ↓
              </span>
            </a>
          </div>
          <StoreBadges align="left" className="landing-store-badges" />
        </div>
        <figure className="lb-figure lb-phone-in">
          <PhoneShot
            priority
            src="/landing/home.webp"
            alt="Home after 15 rounds, handicap 12.4: Approach costs you 0.8 strokes a round; off the tee gains you 1.6"
            tag={{ text: <>the one<br />sentence</>, left: 186, top: 24, width: 96 }}
            arrow={[238, 70, 250, 152]}
          />
          <figcaption className="lb-caption">Home, after 15 rounds</figcaption>
        </figure>
      </div>
    </section>
  )
}

// Sets data-reveal on a section until a quarter of it is on screen, then
// lets it rise in once (landing.css). Without IntersectionObserver, or with
// reduced motion (the CSS ignores it), the section is simply there.
function useOnView<T extends HTMLElement>(threshold: number) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen] as const
}

// The live chart: the app's own Shot patterns parts on a made-up bag. It
// mounts when it comes into view, so its shots draw out in front of the
// reader instead of off screen.
function TryIt() {
  const [ref, seen] = useOnView<HTMLDivElement>(0.1)
  return (
    <section className="lb-section lb-try" id="try">
      <div style={WRAP} className="lb-try-grid">
        <div>
          <h2 className="lb-sentence font-serif">Try it: one made&#8209;up golfer.</h2>
          <p className="lb-lede" style={{ margin: '22px 0 0', maxWidth: 440 }}>
            This is the app&apos;s own Shot patterns chart, fed 162 invented
            shots. Pick a club, switch between around the aim and from the
            tee, and colour the shots by shape, start line or contact.
          </p>
          <dl className="lb-key" aria-label="How to read the chart">
            <div>
              <dt>Amber flag</dt>
              <dd>where you aimed</dd>
            </div>
            <div>
              <dt>Solid ring</dt>
              <dd>where two shots in three finish</dd>
            </div>
            <div>
              <dt>Dashed ring</dt>
              <dd>nearly all of them</dd>
            </div>
            <div>
              <dt>Open circle</dt>
              <dd>the average finish</dd>
            </div>
          </dl>
        </div>
        <figure className="lb-demo" aria-label="A live example of the Shot patterns chart">
          <div className="lb-demo-body" ref={ref}>
            <Suspense fallback={<div className="lb-demo-wait">Setting out the example…</div>}>
              {seen ? <PatternsDemo /> : <div className="lb-demo-wait">Setting out the example…</div>}
            </Suspense>
          </div>
          <figcaption className="lb-demo-foot">
            Your own chart draws itself from the shots you track: where you
            aimed, and where each one finished.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function Finding({
  sentence,
  children,
  src,
  alt,
  caption,
  reverse,
  to,
  linkLabel,
  after,
}: {
  sentence: string
  children: React.ReactNode
  src: string
  alt: string
  caption: string
  reverse?: boolean
  to?: string
  linkLabel?: string
  after?: React.ReactNode
}) {
  const [ref, seen] = useOnView<HTMLElement>(0.25)
  return (
    <section className="lb-section" ref={ref} data-reveal={seen ? 'shown' : 'waiting'}>
      <div style={WRAP}>
        <div className={reverse ? 'landing-spread reverse' : 'landing-spread'}>
          <div className="spread-copy">
            <h2 className="lb-sentence font-serif">{sentence}</h2>
            <p className="lb-lede" style={{ margin: '22px 0 0', maxWidth: 500 }}>
              {children}
            </p>
            {to && (
              <Link to={to} className="lb-link">
                {linkLabel}{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </Link>
            )}
          </div>
          <figure className="spread-figure lb-figure">
            <PhoneShot src={src} alt={alt} />
            <figcaption className="lb-caption">{caption}</figcaption>
          </figure>
        </div>
        {after}
      </div>
    </section>
  )
}

// The Bag section's working ladder: My Bag's gapping chart on a bag the
// visitor types. Nothing is saved.
function TryYourBag() {
  const { user, loading } = useAuth()
  return (
    <div className="lb-ladder" role="group" aria-label="Try your own gapping ladder">
      <div className="lb-ladder-body">
        <Suspense fallback={<div className="lb-ladder-wait">Setting out the example…</div>}>
          <LadderDemo />
        </Suspense>
      </div>
      <div className="lb-ladder-foot">
        <p>Track your rounds and OGA measures these for you, from where each shot finished.</p>
        <PrimaryCta isAuthed={!loading && !!user} />
      </div>
    </div>
  )
}
