// App Store + Google Play badges for the landing page. Official-style
// black badges drawn as inline SVG (no external assets, no CSP change).
// ponytail: hrefs are '#' placeholders until the apps are published —
// swap in the real store URLs when the listings go live.

const APP_STORE_URL = '#'
const PLAY_STORE_URL = '#'

const badgeLink: React.CSSProperties = {
  display: 'inline-flex',
  textDecoration: 'none',
  borderRadius: 8,
  overflow: 'hidden',
  lineHeight: 0,
}

export function StoreBadges({
  align = 'left',
  className,
}: {
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      <a href={APP_STORE_URL} style={badgeLink} aria-label="Download on the App Store">
        <AppStoreBadge />
      </a>
      <a href={PLAY_STORE_URL} style={badgeLink} aria-label="Get it on Google Play">
        <GooglePlayBadge />
      </a>
    </div>
  )
}

// Badges are 152×44, equal width so they align cleanly side by side.
function AppStoreBadge() {
  return (
    <svg width="152" height="44" viewBox="0 0 152 44" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect width="152" height="44" rx="8" fill="#000" />
      <rect x="0.5" y="0.5" width="151" height="43" rx="7.5" fill="none" stroke="#A6A6A6" strokeOpacity="0.5" />
      <path
        fill="#fff"
        transform="translate(0 1.5)"
        d="M27.9 20.3c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.1-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.5 2.3 2.6 2.2 1-.04 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1.1 2.5-2.1.8-1.2 1.1-2.4 1.1-2.4s-2.1-.8-2.1-3.2zm-2.2-6c.6-.7 1-1.7.9-2.7-.8.03-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.07 1.8-.5 2.5-1.2z"
      />
      <text x="42" y="19" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="8.5" letterSpacing="0.2">
        Download on the
      </text>
      <text x="42" y="34" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="17" fontWeight="600">
        App Store
      </text>
    </svg>
  )
}

function GooglePlayBadge() {
  return (
    <svg width="152" height="44" viewBox="0 0 152 44" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect width="152" height="44" rx="8" fill="#000" />
      <rect x="0.5" y="0.5" width="151" height="43" rx="7.5" fill="none" stroke="#A6A6A6" strokeOpacity="0.5" />
      {/* Play triangle: four segments meeting at the central elbow (10.6,11). */}
      <g transform="translate(15 11)">
        <path fill="#00D3FF" d="M0 1.1C0 .5.3 0 .8.2L10.6 11 .8 21.8C.3 22 0 21.5 0 20.9V1.1z" />
        <path fill="#00F076" d="M14.5 6.9 2 .1C1.5-.2 1 -.1.8.2L10.6 11 14.5 6.9z" />
        <path fill="#FFCE00" d="M14.5 6.9 10.6 11l3.9 4.1 4.8-2.7c.9-.5.9-1.8 0-2.3L14.5 6.9z" />
        <path fill="#FF3B30" d="M.8 21.8C1 22.1 1.5 22.2 2 21.9l12.5-6.8L10.6 11 .8 21.8z" />
      </g>
      <text x="46" y="19" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="7.5" letterSpacing="1.2">
        GET IT ON
      </text>
      <text x="46" y="34" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="15.5" fontWeight="600">
        Google Play
      </text>
    </svg>
  )
}
