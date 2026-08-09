#!/usr/bin/env node
// Point-in-polygon labeler for British Isles courses. The osm discovery pass
// tags each course with its fetch-tile key (Scotland / Wales / Ireland /
// England-South / England-North — see UK_IE_TILES in crawl/util.ts). Those
// tiles overlap at the borders and England is split N/S for query size, so the
// fetch-time label is only approximate. This pass PIP-tests each course centroid
// against Natural Earth admin-1 boundaries and rewrites courses.state to the
// true constituent country via the `geonunit` field:
//   United Kingdom admin-1 -> geonunit in {Scotland, England, Wales, Northern Ireland}
//   Ireland admin-1        -> geonunit == "Ireland"
// Mirrors fix-course-states.cjs (the US/CA corrector); same prod guard,
// dry-run-by-default, and batched apply.
//
// Usage (run AFTER `--source osm --states <UK_IE_TILES>`):
//   set -a; source /home/cner/Projects/oga/.env.crawl.prod.local; set +a
//   NODE_PATH=$(pwd)/node_modules node scripts/label-uk-ie.cjs           # dry-run
//   NODE_PATH=$(pwd)/node_modules node scripts/label-uk-ie.cjs --apply   # write

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');

const APPLY = process.argv.includes('--apply');

const BOUNDARY_PATH = path.join(__dirname, 'data', 'ne_10m_admin_1_states_provinces.geojson');
const OUT_JSON_PATH = path.join(__dirname, 'uk-ie-relabels.json');

// Every state value a British Isles course could currently hold: the raw
// fetch-tile placeholders PLUS the corrected country names, so re-runs are
// idempotent (a course already labeled "England" re-resolves to "England" and
// is a no-op). Any course whose state is NOT one of these is left untouched —
// this pass never reaches US/CA rows.
const IN_SCOPE = new Set([
  'Scotland', 'Wales', 'Ireland', 'England-South', 'England-North',
  'England', 'Northern Ireland',
]);

function guardProdUrl() {
  const url = process.env.SUPABASE_URL || '';
  if (!url.includes('znjmkptblswxststjxwc')) {
    console.error(
      `Refusing to run: SUPABASE_URL does not look like prod (got "${url}"). Expected it to contain "znjmkptblswxststjxwc".`
    );
    process.exit(1);
  }
}

function loadBoundaries() {
  if (!fs.existsSync(BOUNDARY_PATH)) {
    console.error(`Boundary file missing at ${BOUNDARY_PATH}. Fetch it first (see fix-course-states.cjs header).`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(BOUNDARY_PATH, 'utf8'));
  const features = raw.features.filter((f) => {
    const p = f.properties || {};
    const admin = p.admin;
    const gu = p.geonunit;
    // UK constituent countries + Ireland; geonunit carries the exact label.
    return (
      (admin === 'United Kingdom' || admin === 'Ireland') &&
      typeof gu === 'string' &&
      ['Scotland', 'England', 'Wales', 'Northern Ireland', 'Ireland'].includes(gu)
    );
  });
  return features;
}

// Precompute each feature's bbox for a cheap reject before the PIP test.
function withBbox(features) {
  return features.map((f) => {
    let bbox = f.bbox;
    if (!bbox) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const walk = (coords, depth) => {
        if (depth === 0) {
          const [x, y] = coords;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          for (const c of coords) walk(c, depth - 1);
        }
      };
      const depth = f.geometry.type === 'Polygon' ? 2 : 3;
      walk(f.geometry.coordinates, depth);
      bbox = [minX, minY, maxX, maxY];
    }
    return { feature: f, bbox, geonunit: f.properties.geonunit, name: f.properties.name };
  });
}

function findCountry(lng, lat, indexed) {
  const pt = point([lng, lat]);
  for (const entry of indexed) {
    const [minX, minY, maxX, maxY] = entry.bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (booleanPointInPolygon(pt, entry.feature)) return entry;
  }
  return null;
}

async function main() {
  guardProdUrl();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Prod URL: ${supabaseUrl}`);

  console.log('Loading Natural Earth admin-1 (UK + Ireland)...');
  const features = loadBoundaries();
  console.log(`Loaded ${features.length} UK/IE admin-1 polygons.`);
  const indexed = withBbox(features);

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('Fetching British Isles courses (state in fetch-tile scope)...');
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, city, state, lat, lng')
      .in('state', [...IN_SCOPE])
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched ${all.length} in-scope courses.`);

  let matched = 0;
  let noMatch = 0;
  const noMatchRows = [];
  const relabels = [];
  const transitionCounts = new Map();
  const countryCounts = new Map();

  for (const c of all) {
    const lat = Number(c.lat);
    const lng = Number(c.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      noMatch++;
      noMatchRows.push({ id: c.id, name: c.name, reason: 'bad-coords' });
      continue;
    }
    const hit = findCountry(lng, lat, indexed);
    if (!hit) {
      // In a British Isles tile bbox but outside all 5 country polygons —
      // Isle of Man, Channel Islands, offshore, or a border-overlap course
      // that actually sits in the sea. Left as-is for review, never guessed.
      noMatch++;
      noMatchRows.push({ id: c.id, name: c.name, city: c.city, stored_state: c.state, lat, lng });
      continue;
    }
    matched++;
    const trueCountry = hit.geonunit;
    countryCounts.set(trueCountry, (countryCounts.get(trueCountry) || 0) + 1);
    if (c.state !== trueCountry) {
      relabels.push({
        id: c.id,
        name: c.name,
        city: c.city,
        stored_state: c.state,
        true_state: trueCountry,
        lat,
        lng,
      });
      const key = `${c.state} -> ${trueCountry}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`In-scope courses: ${all.length}`);
  console.log(`Matched to a country polygon: ${matched}`);
  console.log(`No polygon match (held, left as-is): ${noMatch}`);
  console.log(`Relabels (stored != true country): ${relabels.length}`);

  console.log('\n=== FINAL COUNTRY DISTRIBUTION (matched) ===');
  for (const [k, n] of [...countryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }

  console.log('\n=== TOP TRANSITIONS (stored -> true) ===');
  for (const [k, n] of [...transitionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  ${k}: ${n}`);
  }

  if (noMatchRows.length) {
    console.log(`\n=== HELD / NO-MATCH (up to 20 of ${noMatchRows.length}) ===`);
    for (const r of noMatchRows.slice(0, 20)) {
      console.log(`  ${r.name} (${r.city || 'n/a'}) [${r.stored_state || '?'}] ${r.lat ?? ''},${r.lng ?? ''}`);
    }
  }

  fs.writeFileSync(OUT_JSON_PATH, JSON.stringify({ relabels, noMatch: noMatchRows }, null, 2));
  console.log(`\nFull relabel + no-match list written to ${OUT_JSON_PATH}`);

  if (!APPLY) {
    console.log('\nDRY-RUN complete. Review the JSON, then re-run with --apply to write.');
    return;
  }

  console.log('\n=== APPLYING RELABELS ===');
  let applied = 0;
  for (const m of relabels) {
    const { error } = await supabase.from('courses').update({ state: m.true_state }).eq('id', m.id);
    if (error) {
      console.error(`  FAILED ${m.id} (${m.name}): ${error.message}`);
      continue;
    }
    applied++;
    if (applied % 100 === 0) console.log(`  applied ${applied}/${relabels.length}`);
  }
  console.log(`\nApplied ${applied}/${relabels.length} relabels. No-match rows (${noMatchRows.length}) left untouched.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
