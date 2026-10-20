import type { Club } from '@oga/core'

// The club row as a yardage-book gapping chart: each cell is the club over its
// typical distance, so choosing a club also reads the bag's gaps. A club
// without enough aimed shots shows no number.
export function ClubLadder({
  clubs,
  value,
  onChange,
  typical,
}: {
  clubs: readonly Club[]
  value: Club
  onChange: (c: Club) => void
  typical: (c: Club) => number | null
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Club"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))',
        borderTop: '1px solid #9F9580',
        borderLeft: '1px solid #D9D2BF',
      }}
    >
      {clubs.map((c) => {
        const on = c === value
        const t = typical(c)
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t != null ? `${c}, ${t}` : c}
            onClick={() => onChange(c)}
            style={{
              background: on ? '#1F3D2C' : 'transparent',
              color: on ? '#F2EEE5' : '#1C211C',
              border: 'none',
              borderRight: '1px solid #D9D2BF',
              borderBottom: '1px solid #D9D2BF',
              padding: '8px 4px 9px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minHeight: 54,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: on ? 600 : 400 }}>{c === 'driver' ? 'dr' : c}</span>
            <span
              className="font-serif tabular"
              style={{
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.1,
                color: on ? '#F2EEE5' : t != null ? '#1C211C' : '#B7B2A2',
              }}
            >
              {t != null ? t : '·'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
