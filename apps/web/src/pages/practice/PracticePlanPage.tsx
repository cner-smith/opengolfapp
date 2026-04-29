export function PracticePlanPage() {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1
          className="text-oga-text-primary"
          style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
        >
          Practice plan
        </h1>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 2 }}
        >
          AI-generated drill checklist tuned to your strokes gained data
        </div>
      </div>
      <div
        className="bg-oga-bg-card text-center"
        style={{
          border: '0.5px solid #E4E4E0',
          borderRadius: 10,
          padding: '40px 24px',
        }}
      >
        <div className="font-medium" style={{ fontSize: 15 }}>
          Plan generation arrives in Phase 5
        </div>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}
        >
          Once enough rounds are logged, this page will generate a drill plan
          calibrated to the categories where you're losing the most strokes.
        </div>
      </div>
    </div>
  )
}
