import { StepHeading } from './shared'

// Shown after onboarding is already saved, so neither button can strand the
// user: both just choose where they land.
export function Step7Import({ onImport, onSkip }: { onImport: () => void; onSkip: () => void }) {
  return (
    <div>
      <StepHeading
        title="Coming from another app?"
        subtitle="Bring your Golf Pad rounds, or a scorecard spreadsheet, and your stats start from day one."
      />
      <button
        type="button"
        onClick={onImport}
        className="key key-primary"
        style={{
          width: '100%',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.02em',
          marginTop: 4,
        }}
      >
        Import rounds{' '}
        <span className="font-serif" style={{ fontStyle: 'italic' }}>
          →
        </span>
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="text-caddie-ink-dim hover:text-caddie-ink"
        style={{
          fontSize: 14,
          padding: '14px 0 0',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'center',
          display: 'block',
        }}
      >
        Skip
      </button>
    </div>
  )
}
