export function DrillLibraryPage() {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1
          className="text-oga-text-primary"
          style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
        >
          Drill library
        </h1>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 2 }}
        >
          Browse the full set of drills used by the planner
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
          Drill browser arrives in Phase 5
        </div>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}
        >
          The drill library is seeded in Supabase and surfaces here once Phase 5
          ships.
        </div>
      </div>
    </div>
  )
}
