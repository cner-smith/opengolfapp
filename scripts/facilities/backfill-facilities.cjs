// Curated-seed facility grouping. Group ONLY the hand-listed facilities below,
// resolving each unit to exactly one existing course row by name (+ optional
// state). Dry-run by default; --apply writes. Excludes zero-holes rows so no
// under-mapped loop becomes a one-tap pick (inferHoleCount([])=18 would lie).
const { createClient } = require('@supabase/supabase-js');

// Each unit: { match } is an ilike pattern that must resolve to exactly ONE course.
// fix_state (optional, facility-level) normalizes polluted state on the matched rows.
const SEEDS = [
  { name: 'Lake Hefner Golf Club', state: 'OK', city: 'Oklahoma City', fix_state: 'OK',
    units: [
      { match: 'Lake Hefner North%', unit_name: 'North Course', unit_order: 1 },
      { match: 'Lake Hefner South%', unit_name: 'South Course', unit_order: 2 },
    ] },
  { name: 'Earlywine Golf Course', state: 'OK', city: 'Oklahoma City', fix_state: 'OK',
    units: [
      { match: 'North At Earlywine%', unit_name: 'North Course', unit_order: 1 },
      { match: 'South At Earlywine%', unit_name: 'South Course', unit_order: 2 },
    ] },
  // Pacific Dunes + Old Macdonald are not in the prod dataset yet; group the 3 present.
  { name: 'Bandon Dunes Golf Resort', state: 'OR', city: 'Bandon',
    units: [
      { match: 'Bandon Dunes%', unit_name: 'Bandon Dunes', unit_order: 1 },
      { match: 'Bandon Trails%', unit_name: 'Bandon Trails', unit_order: 2 },
      { match: '%Sheep Ranch%', unit_name: 'Sheep Ranch', unit_order: 3 },
    ] },
];

const APPLY = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
if (!url.includes('znjmkptblswxststjxwc')) throw new Error('refusing: not the prod project');
const db = createClient(url, key, { auth: { persistSession: false } });

async function resolveUnit(u, seed) {
  let q = db.from('courses')
    .select('id, name, city, state, facility_id, hole_count')
    .ilike('name', u.match);
  if (seed.state) q = q.or(`state.eq.${seed.state},state.is.null`); // tolerate null/polluted state
  const { data, error } = await q;
  if (error) throw error;
  // Exclude already-grouped and zero-holes (under-mapped) rows.
  return (data || []).filter((c) => !c.facility_id && (c.hole_count ?? 0) > 0);
}

(async () => {
  const { data: roundCourses } = await db.from('rounds').select('course_id');
  const withRounds = new Set((roundCourses || []).map((r) => r.course_id));

  const plans = [];
  for (const seed of SEEDS) {
    const resolved = [];
    const problems = [];
    for (const u of seed.units) {
      const cands = await resolveUnit(u, seed);
      if (cands.length !== 1) { problems.push(`${u.match} -> ${cands.length} matches`); continue; }
      resolved.push({ ...u, id: cands[0].id, foundName: cands[0].name,
        has_rounds: withRounds.has(cands[0].id), hole_count: cands[0].hole_count });
    }
    plans.push({ seed, resolved, problems });
  }

  // FULL plan output (no truncation — this IS the review artifact).
  for (const p of plans) {
    console.log(`\n[${p.seed.state}] ${p.seed.name} (${p.seed.city})`);
    for (const u of p.resolved) console.log(`   OK ${u.foundName} -> "${u.unit_name}" (#${u.unit_order}, holes=${u.hole_count}${u.has_rounds ? ', HAS ROUNDS' : ''})`);
    for (const pr of p.problems) console.log(`   !! UNRESOLVED: ${pr}`);
  }
  const ready = plans.filter((p) => p.problems.length === 0 && p.resolved.length >= 2);
  console.log(`\nseeds ready to apply: ${ready.length}/${plans.length}`);
  if (plans.some((p) => p.problems.length)) console.log('FIX unresolved matches before --apply (each unit must resolve to exactly 1 course).');

  if (!APPLY) { console.log('DRY RUN — review the full list above, then pass --apply'); return; }

  let made = 0;
  for (const p of ready) {
    const { data: fac, error: fe } = await db.from('facilities')
      .insert({ name: p.seed.name, city: p.seed.city, state: p.seed.state }).select('id').single();
    if (fe) throw fe;
    for (const u of p.resolved) {
      const patch = { facility_id: fac.id, unit_name: u.unit_name, unit_order: u.unit_order };
      if (p.seed.fix_state) patch.state = p.seed.fix_state;
      const { error: ue } = await db.from('courses').update(patch).eq('id', u.id);
      if (ue) throw ue;
    }
    made++;
    console.log(`applied: ${p.seed.name} (${p.resolved.length} units)`);
  }
  console.log(`APPLIED: created ${made} facilities`);
})().catch((e) => { console.error('ERR:', e?.message, JSON.stringify(e)); process.exit(1); });
