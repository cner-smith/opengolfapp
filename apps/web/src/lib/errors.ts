// Generic user-facing error string. PostgREST surfaces row data,
// column names, and policy snippets in error.message — fine in dev,
// not fine in production. In dev we keep the raw message so failures
// stay debuggable; in prod we collapse to a single neutral string and
// rely on console.error for the detail.
export function toUserMessage(error: unknown): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return String(error)
  }
  return 'Something went wrong. Please try again.'
}
