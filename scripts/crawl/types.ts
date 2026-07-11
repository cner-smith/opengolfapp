// Shared types and constants for the course crawler.

export interface OgaListItem {
  id: string
  name: string
  city?: string
  state?: string
  lat?: number
  lng?: number
}

export interface OgaTee {
  color: string
  name?: string
  rating?: number
  slope?: number
  totalYards?: number
  par?: number
}

export interface OgaHole {
  number: number
  par: number
  yards?: number
}

export interface OgaCourseDetail {
  id: string
  name: string
  city?: string
  state?: string
  lat?: number
  lng?: number
  holes: OgaHole[]
  tees: OgaTee[]
}

export interface RawHole {
  number?: number
  hole?: number
  hole_number?: number
  par?: number | string
  yards?: number | string
  distance?: number | string
  yardage?: number | string
}

export interface RawTee {
  color?: string
  name?: string
  tee_color?: string
  tee_name?: string
  rating?: number | string
  course_rating?: number | string
  slope?: number | string
  slope_rating?: number | string
  yards?: number | string
  total_yards?: number | string
  total_yardage?: number | string
  par?: number | string
}

export interface RawCourse {
  id?: string | number
  course_id?: string | number
  name?: string
  course_name?: string
  city?: string
  state?: string
  region?: string
  par?: number | string
  total_par?: number | string
  holes?: RawHole[]
  scorecard?: RawHole[]
  tees?: RawTee[]
  lat?: number | string
  lng?: number | string
  longitude?: number | string
  latitude?: number | string
  coordinates?: { lat?: number | string; lng?: number | string; longitude?: number | string; latitude?: number | string }
  location?: { lat?: number | string; lng?: number | string; longitude?: number | string; latitude?: number | string }
}

export interface OsmCourseLite {
  osmType: 'way' | 'relation' | 'node'
  osmId: number
  name: string
  lat: number
  lng: number
  state: string
  city?: string
}

export type CrawlStatus = 'pending' | 'in_progress' | 'done' | 'error'

export type Source =
  | 'opengolfapi'
  | 'osm'
  | 'osm-first'
  | 'enrich'
  | 'osm-holes'
  | 'geocode'
  | 'complete'

/** A hole with optional per-hole geometry, written by the osm-holes pass. */
export interface OgaHoleGeo {
  number: number
  par: number
  yards?: number
  teeLat?: number
  teeLng?: number
  pinLat?: number
  pinLng?: number
}

/** Minimal course shape for nearest-centroid hole assignment. */
export interface CourseGeo {
  id: string
  lat: number
  lng: number
}

/** Overpass element from an `out geom` query (ways carry a node list). */
export interface OverpassGeomElement {
  type: 'way' | 'node' | 'relation'
  id: number
  lat?: number
  lon?: number
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}
export interface OverpassGeomResponse {
  elements: OverpassGeomElement[]
}

export interface Args {
  source: Source | null
  states: string[] | null // null = default (all for OpenGolfAPI / all w/ bbox for OSM)
  force: boolean
  status: boolean
  limit: number | null // optional cap on courses per state (for testing)
  maxCourses: number | null // global cap on API-processed courses this run (enrich rate-limit budget)
  dryRun: boolean // completion pass: report changes without writing
}

export interface CrawlStateRow {
  id: string
  status: CrawlStatus
  items_processed: number
  last_crawled_at: string | null
  error_message: string | null
}

export interface CourseRowMin {
  id: string
  name: string
  external_id: string | null
}

export interface OverpassNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  center?: undefined
  tags?: Record<string, string>
}
export interface OverpassWayOrRelation {
  type: 'way' | 'relation'
  id: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}
export type OverpassElement = OverpassNode | OverpassWayOrRelation
export interface OverpassResponse {
  elements: OverpassElement[]
}
