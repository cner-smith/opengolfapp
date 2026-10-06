#!/usr/bin/env node
// Point-in-polygon labeler for the international crawl (#1062). The osm pass
// tags each new course with its fetch-tile key (AU-SE, FR-North, ... — see
// INTL_TILES in crawl/util.ts). This pass finds each course's Natural Earth
// admin-1 polygon and writes the real region to courses.state and the country
// to courses.country. Run it AFTER osm-holes: that pass finds courses by the
// tile key.
//
// Label format matches what is already in the DB:
//   UK + Ireland  -> state = constituent country (England, Scotland, ...), country = null
//   Australia     -> state = postal (NSW, VIC, ...), country = 'Australia'
//   FR/ES/IT/PT   -> state = region (Île-de-France, Catalonia, ...); NE admin-1 there is départements/provinces
//   elsewhere     -> state = English admin-1 name (Bavaria, Capital Region of Denmark, ...)
//   US / Canada   -> skipped (held): those are crawled by their own pass
//
// Usage (dry-run by default; --apply writes):
//   node scripts/label-intl.cjs [--apply]
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env, and the Natural Earth
// file at scripts/data/ne_10m_admin_1_states_provinces.geojson (gitignored).

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ray casting over a GeoJSON Polygon / MultiPolygon (outer ring minus holes).
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeometry(x, y, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));
}

const APPLY = process.argv.includes('--apply');
const BOUNDARY_PATH = path.join(__dirname, 'data', 'ne_10m_admin_1_states_provinces.geojson');
const OUT_JSON_PATH = path.join(__dirname, 'intl-relabels.json');

// Keep in sync with INTL_TILES in crawl/util.ts (a .cjs can't import the TS).
const TILE_KEYS = [
  'AU-SE', 'AU-NE', 'AU-West', 'FR-North', 'FR-South', 'DE-North', 'DE-South',
  'ES', 'ES-Canarias', 'IT', 'NL', 'BE', 'SE', 'DK', 'NO',
];
const REGION_FIELD_COUNTRIES = new Set(['France', 'Spain', 'Italy', 'Portugal']);

function label(props) {
  const admin = props.admin;
  if (admin === 'United States of America' || admin === 'Canada') return null;
  if (admin === 'United Kingdom' || admin === 'Ireland') return { state: props.geonunit, country: null };
  if (admin === 'Australia') return { state: props.postal || props.name_en || props.name, country: admin };
  // NE's name_en is sometimes just the country (Hovedstaden -> "Denmark"); fall back to the local name.
  const english = props.name_en && props.name_en !== admin ? props.name_en : props.name;
  const state = (REGION_FIELD_COUNTRIES.has(admin) && props.region) || english;
  return { state, country: admin };
}

function withBbox(features) {
  return features.map((f) => {
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
    walk(f.geometry.coordinates, f.geometry.type === 'Polygon' ? 2 : 3);
    return { feature: f, bbox: [minX, minY, maxX, maxY] };
  });
}

// Squared distance (cos-lat scaled) from a point to the nearest vertex of a geometry.
function nearestVertexD2(x, y, geom, cosLat) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let best = Infinity;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [vx, vy] of ring) {
        const dx = (vx - x) * cosLat;
        const dy = vy - y;
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
    }
  }
  return best;
}

// Exact PIP first; then, for links / island courses just outside the 1:10m
// coastline, the admin-1 with the nearest coastline vertex within ~0.4°.
// (label-uk-ie.cjs's bbox-centre rule put Malmö-area courses in Denmark: the
// Øresund is narrower than the regions are wide.) Null = offshore, held.
function findAdmin1(lng, lat, indexed) {
  for (const e of indexed) {
    const [minX, minY, maxX, maxY] = e.bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (inGeometry(lng, lat, e.feature.geometry)) return { entry: e, exact: true };
  }
  const BUF = 0.4;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = null;
  let bestD = Infinity;
  for (const e of indexed) {
    const [minX, minY, maxX, maxY] = e.bbox;
    if (lng < minX - BUF || lng > maxX + BUF || lat < minY - BUF || lat > maxY + BUF) continue;
    const d = nearestVertexD2(lng, lat, e.feature.geometry, cosLat);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best ? { entry: best, exact: false } : null;
}

// `node scripts/label-intl.cjs --selftest`: known points, no DB.
function selftest() {
  const indexed = withBbox(JSON.parse(fs.readFileSync(BOUNDARY_PATH, 'utf8')).features);
  const cases = [
    [56.046, 12.436, 'Denmark', 'Hovedstaden'], // Hornbæk
    [-32.0017, 115.8809, 'Australia', 'WA'], // Collier Park
    [50.5016, 1.5983, 'France', 'Hauts-de-France'], // Le Touquet
    [51.27, 1.35, null, 'England'], // Royal St George's, Kent (inside FR-North's bbox)
    [41.5735, 2.0539, 'Spain', 'Cataluña'], // El Prat
    // coastal fallback: just outside the 1:10m coastline
    [55.4016, 12.83, 'Sweden', 'Skåne'], // Flommens GK, Falsterbo
    [55.3726, 13.0867, 'Sweden', 'Skåne'], // Trelleborgs GK
    [54.8659, 8.4569, 'Germany', 'Schleswig-Holstein'], // Morsum, Sylt
    [55.0821, 8.5477, 'Denmark'], // Rømø
  ];
  for (const [lat, lng, country, state] of cases) {
    const l = label(findAdmin1(lng, lat, indexed).entry.feature.properties);
    console.log(`${lat},${lng} -> ${l.state} / ${l.country}`);
    if (l.country !== country || (state && l.state !== state)) throw new Error(`selftest failed at ${lat},${lng}`);
  }
  console.log('selftest ok');
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  if (!fs.existsSync(BOUNDARY_PATH)) {
    console.error(`Boundary file missing at ${BOUNDARY_PATH}.`);
    process.exit(1);
  }
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} against ${url}`);

  const raw = JSON.parse(fs.readFileSync(BOUNDARY_PATH, 'utf8'));
  const indexed = withBbox(raw.features);
  const supabase = createClient(url, key);

  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, state, lat, lng')
      .in('state', TILE_KEYS)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Courses still holding a tile key: ${all.length}`);

  const relabels = [];
  const held = [];
  const byCountry = new Map();
  let fallback = 0;
  for (const c of all) {
    const hit = findAdmin1(Number(c.lng), Number(c.lat), indexed);
    const l = hit && label(hit.entry.feature.properties);
    if (!l || !l.state) {
      held.push({ id: c.id, name: c.name, tile: c.state, lat: c.lat, lng: c.lng, admin: hit?.entry.feature.properties.admin ?? null });
      continue;
    }
    if (!hit.exact) fallback++;
    relabels.push({ id: c.id, name: c.name, tile: c.state, ...l, exact: hit.exact });
    const k = l.country ?? l.state;
    byCountry.set(k, (byCountry.get(k) || 0) + 1);
  }

  console.log(`Relabel: ${relabels.length} (${fallback} via coastal fallback) · held: ${held.length}`);
  for (const [k, n] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
  for (const h of held.slice(0, 20)) console.log(`  HELD ${h.name} [${h.tile}] ${h.lat},${h.lng} ${h.admin ?? 'offshore'}`);
  fs.writeFileSync(OUT_JSON_PATH, JSON.stringify({ relabels, held }, null, 2));
  console.log(`Full list: ${OUT_JSON_PATH}`);

  if (!APPLY) return console.log('DRY-RUN complete. Re-run with --apply to write.');

  let applied = 0;
  for (const r of relabels) {
    const { error } = await supabase.from('courses').update({ state: r.state, country: r.country }).eq('id', r.id);
    if (error) {
      console.error(`  FAILED ${r.id} (${r.name}): ${error.message}`);
      continue;
    }
    if (++applied % 200 === 0) console.log(`  applied ${applied}/${relabels.length}`);
  }
  console.log(`Applied ${applied}/${relabels.length}. Held rows keep their tile key.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
