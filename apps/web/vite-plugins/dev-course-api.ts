import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
// Type-only, same reasoning as OgaSupabaseModule below — erased at build
// time, never a runtime resolution of '@oga/supabase'.
import type { Database } from '@oga/supabase'

// Type-only — erased at build time, so this never triggers a runtime
// resolution of '@oga/supabase' from vite.config.ts's own module graph
// (which loads through Node's native ESM loader, not Vite's transform
// pipeline, and can't resolve the package's extensionless TS imports).
type OgaSupabaseModule = typeof import('@oga/supabase')
type OgaSupabaseClient = ReturnType<OgaSupabaseModule['createOgaServiceClient']>

type CourseInsert = Database['public']['Tables']['courses']['Insert']
type CourseUpdate = Database['public']['Tables']['courses']['Update']
type FacilityInsert = Database['public']['Tables']['facilities']['Insert']
type FacilityUpdate = Database['public']['Tables']['facilities']['Update']
type HoleInsert = Database['public']['Tables']['holes']['Insert']
type CourseTeeInsert = Database['public']['Tables']['course_tees']['Insert']
type CourseTeeUpdate = Database['public']['Tables']['course_tees']['Update']
type HoleTeeInsert = Database['public']['Tables']['hole_tees']['Insert']

/**
 * Dev-only backend for the Course Editor (apps/web/src/pages/dev-editor).
 * `apply: 'serve'` means this plugin — and everything it touches — is only
 * ever loaded by `vite dev`; `vite build` never touches this file, so the
 * service-role key and these endpoints cannot ship to a production bundle.
 *
 * courses/holes have no UPDATE/DELETE RLS policy at all today (normal users
 * can only INSERT) and facilities require service_role for every write, so
 * this is the only way to edit existing course data short of raw SQL.
 *
 * The actual @oga/supabase functions are loaded at request time via
 * server.ssrLoadModule (Vite's own resolve/transform pipeline) rather than a
 * static import, since a static import here would be loaded by Node's
 * native ESM loader when Vite reads this config — and that loader can't
 * follow the package's extensionless relative TS imports (e.g. `./client`).
 */
export function devCourseApi(): Plugin {
  let modPromise: Promise<OgaSupabaseModule> | null = null
  let clientPromise: Promise<OgaSupabaseClient | null> | null = null

  function loadOgaModule(server: ViteDevServer): Promise<OgaSupabaseModule> {
    modPromise ??= server.ssrLoadModule('@oga/supabase') as Promise<OgaSupabaseModule>
    return modPromise
  }

  function getClient(server: ViteDevServer): Promise<OgaSupabaseClient | null> {
    clientPromise ??= (async () => {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceKey) {
        server.config.logger.warn(
          '[dev-course-api] SUPABASE_SERVICE_ROLE_KEY not set — /api/dev/* will 500. Add bare SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local (see .env.example).',
        )
        return null
      }
      const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
      const mod = await loadOgaModule(server)
      return mod.createOgaServiceClient(url, serviceKey)
    })()
    return clientPromise
  }

  return {
    name: 'dev-course-api',
    apply: 'serve',
    configureServer(server) {
      // No auth check on any /api/dev/* route — every request runs against
      // the full service-role client (RLS bypass). Acceptable only because
      // this whole plugin is dev-server-only (see file header); anything
      // reachable at `vite dev` gets unauthenticated write access to the DB.
      server.middlewares.use('/api/dev', async (req, res, next) => {
        const client = await getClient(server)
        if (!client) {
          sendJson(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY not set on the dev server' })
          return
        }
        const mod = await loadOgaModule(server)
        const method = req.method ?? 'GET'
        const parsedUrl = new URL(req.url ?? '/', 'http://localhost')
        const segments = parsedUrl.pathname.split('/').filter(Boolean)

        try {
          if (segments[0] === 'courses') {
            if (segments.length === 1 && method === 'POST') {
              const body = (await readJson(req)) as CourseInsert
              const { data, error } = await mod.createCourse(client, body)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'GET') {
              const { data, error } = await mod.getFullCourseById(client, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              if (!data) return sendJson(res, 404, { error: 'Course not found' })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'PATCH') {
              const body = (await readJson(req)) as CourseUpdate
              const { data, error } = await mod.updateCourse(client, segments[1]!, body)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 3 && segments[2] === 'refetch-osm' && method === 'POST') {
              const body = (await readJson(req)) as { lat?: number; lng?: number; radius?: number }
              const { data: course, error: courseErr } = await mod.getFullCourseById(client, segments[1]!)
              if (courseErr) return sendJson(res, 400, { error: courseErr.message })
              if (!course) return sendJson(res, 404, { error: 'Course not found' })
              const lat = body.lat ?? course.lat
              const lng = body.lng ?? course.lng
              if (lat == null || lng == null) {
                return sendJson(res, 400, { error: 'lat/lng required (course has neither set nor provided)' })
              }
              const summary = await mod.runOsmImport(client, {
                name: course.name,
                lat,
                lng,
                radius: body.radius ?? 1200,
                updateExisting: true,
              })
              return sendJson(res, 200, summary)
            }
          }

          if (segments[0] === 'facilities') {
            if (segments.length === 1 && method === 'POST') {
              const body = (await readJson(req)) as FacilityInsert
              const { data, error } = await mod.createFacility(client, body)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'GET') {
              const { data, error } = await mod.getFullFacilityById(client, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              if (!data) return sendJson(res, 404, { error: 'Facility not found' })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'PATCH') {
              const body = (await readJson(req)) as FacilityUpdate
              const { data, error } = await mod.updateFacility(client, segments[1]!, body)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
          }

          if (segments[0] === 'holes') {
            if (segments.length === 1 && method === 'GET') {
              const courseId = parsedUrl.searchParams.get('courseId')
              if (!courseId) return sendJson(res, 400, { error: 'courseId query param required' })
              const { data, error } = await mod.getHolesForCourse(client, courseId)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 1 && method === 'POST') {
              const body = (await readJson(req)) as HoleInsert | HoleInsert[]
              const rows = Array.isArray(body) ? body : [body]
              const { data, error } = await mod.upsertHoles(client, rows)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'DELETE') {
              const { error } = await mod.deleteHole(client, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, { ok: true })
            }
          }

          if (segments[0] === 'course-tees') {
            if (segments.length === 1 && method === 'GET') {
              const courseId = parsedUrl.searchParams.get('courseId')
              if (!courseId) return sendJson(res, 400, { error: 'courseId query param required' })
              const { data, error } = await mod.getCourseTees(client, courseId)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 1 && method === 'POST') {
              const body = (await readJson(req)) as CourseTeeInsert | CourseTeeInsert[]
              const rows = Array.isArray(body) ? body : [body]
              const { data, error } = await mod.upsertCourseTees(client, rows)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'PATCH') {
              const body = (await readJson(req)) as CourseTeeUpdate
              const { data, error } = await mod.updateCourseTee(client, segments[1]!, body)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'DELETE') {
              const { error } = await mod.deleteCourseTee(client, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, { ok: true })
            }
            if (segments.length === 3 && segments[2] === 'set-primary' && method === 'POST') {
              const body = (await readJson(req)) as { courseId?: string }
              if (!body.courseId) return sendJson(res, 400, { error: 'courseId required in body' })
              const { data, error } = await mod.setPrimaryCourseTee(client, body.courseId, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 3 && segments[2] === 'set-primary-if-none' && method === 'POST') {
              const body = (await readJson(req)) as { courseId?: string }
              if (!body.courseId) return sendJson(res, 400, { error: 'courseId required in body' })
              const { data, error } = await mod.setPrimaryIfNone(client, body.courseId, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
          }

          if (segments[0] === 'hole-tees') {
            if (segments.length === 1 && method === 'GET') {
              const courseId = parsedUrl.searchParams.get('courseId')
              if (!courseId) return sendJson(res, 400, { error: 'courseId query param required' })
              const { data, error } = await mod.getHoleTeesForCourse(client, courseId)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 1 && method === 'POST') {
              const body = (await readJson(req)) as HoleTeeInsert | HoleTeeInsert[]
              const rows = Array.isArray(body) ? body : [body]
              const { data, error } = await mod.upsertHoleTees(client, rows)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, data)
            }
            if (segments.length === 2 && method === 'DELETE') {
              const { error } = await mod.deleteHoleTee(client, segments[1]!)
              if (error) return sendJson(res, 400, { error: error.message })
              return sendJson(res, 200, { ok: true })
            }
          }

          next()
        } catch (err) {
          sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
        }
      })
    },
  }
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
