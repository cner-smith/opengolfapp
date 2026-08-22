import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' // from `npx supabase status`
const ANON = process.env.SUPABASE_ANON_KEY ?? '' // from `npx supabase status`
if (!SERVICE || !ANON) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY (npx supabase status)')

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
let failures = 0
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'test-pw-123456', email_confirm: true,
  })
  if (error) throw error
  return data.user!.id // handle_new_user() auto-creates the profiles row
}

async function signedInClient(email: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: 'test-pw-123456' })
  if (error) throw error
  return c
}

async function main() {
  const emailA = `del-a-${Date.now()}@example.com`
  const emailB = `del-b-${Date.now()}@example.com`
  const uidA = await makeUser(emailA)
  const uidB = await makeUser(emailB)

  // Seed A's round + hole + 4 shots via service role (bypasses RLS).
  // rounds.course_id is NOT NULL (FK to courses) — seed a minimal course first.
  const { data: course } = await admin.from('courses')
    .insert({ name: `Delete Shot RPC Test Course ${Date.now()}` })
    .select('id').single()
  const { data: round } = await admin.from('rounds')
    .insert({ user_id: uidA, course_id: course!.id, played_at: new Date('2026-08-17').toISOString() })
    .select('id').single()
  // hole_scores.hole_id is NOT NULL (FK to holes) — seed a real hole row first.
  const { data: hole } = await admin.from('holes')
    .insert({ course_id: course!.id, number: 1, par: 4 })
    .select('id').single()
  const { data: hs } = await admin.from('hole_scores')
    .insert({ round_id: round!.id, hole_id: hole!.id, par: 4, score: 4, putts: 1, penalties: 1 })
    .select('id').single()
  const mk = (n: number, lie: string, penalty = false) => ({
    hole_score_id: hs!.id, user_id: uidA, shot_number: n, lie_type: lie, penalty,
    start_lat: 35 + n * 0.001, start_lng: -97 + n * 0.001,
  })
  const { data: shots } = await admin.from('shots')
    .insert([mk(1, 'tee'), mk(2, 'fairway', true), mk(3, 'fairway'), mk(4, 'green')])
    .select('id, shot_number').order('shot_number')
  const shot2 = shots!.find((s) => s.shot_number === 2)!

  const A = await signedInClient(emailA)

  // 1. Happy path: delete the middle penalty shot (#2).
  const { data: deleted, error: delErr } = await A.rpc('delete_shot', { p_shot_id: shot2.id })
  check('rpc returns true on delete', !delErr && deleted === true)

  const { data: after } = await admin.from('shots')
    .select('shot_number, lie_type').eq('hole_score_id', hs!.id).order('shot_number')
  check('renumbered to 1,2,3', JSON.stringify(after!.map((s) => s.shot_number)) === '[1,2,3]')
  check('deleted shot gone (3 remain)', after!.length === 3)

  const { data: hsAfter } = await admin.from('hole_scores')
    .select('score, putts, penalties').eq('id', hs!.id).single()
  check('score 4->3', hsAfter!.score === 3)
  check('putts unchanged (deleted was not a putt)', hsAfter!.putts === 1)
  check('penalties 1->0 (deleted had penalty)', hsAfter!.penalties === 0)

  // 2. Idempotent double-delete.
  const { data: again, error: againErr } = await A.rpc('delete_shot', { p_shot_id: shot2.id })
  check('idempotent double-delete returns false, no error', !againErr && again === false)

  // 3. Ownership: B cannot delete A's shot.
  const B = await signedInClient(emailB)
  const { data: aShot } = await admin.from('shots')
    .select('id').eq('hole_score_id', hs!.id).eq('shot_number', 1).single()
  const { error: fbErr } = await B.rpc('delete_shot', { p_shot_id: aShot!.id })
  check('non-owner rejected (forbidden)', !!fbErr && /forbidden/i.test(fbErr.message))

  // 4. Anon / service-role (auth.uid() is null) rejected.
  const { error: anonErr } = await admin.rpc('delete_shot', { p_shot_id: aShot!.id })
  check('anon rejected (not authenticated)', !!anonErr && /not authenticated/i.test(anonErr.message))

  // Cleanup: deleting the round cascades hole_scores + shots; delete the users + course.
  await admin.from('rounds').delete().eq('id', round!.id)
  await admin.from('courses').delete().eq('id', course!.id)
  await admin.auth.admin.deleteUser(uidA)
  await admin.auth.admin.deleteUser(uidB)

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
