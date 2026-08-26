// Generic user-facing error string. PostgREST surfaces row data,
// column names, and policy snippets in error.message — fine in dev,
// not fine in production. In dev we keep the raw message so failures
// stay debuggable; in prod we collapse to a single neutral string and
// rely on console.error for the detail.
// postgrest-js only wraps a query error in a real Error when you call
// `.throwOnError()` — every query in this app just awaits the {data, error}
// tuple, so `error` here is normally the raw JSON error body PostgREST sent
// back (message/details/hint/code), not an Error instance. Without this
// check, `error instanceof Error` is false, `typeof error === 'string'` is
// false, and it falls through to `String(error)` → "[object Object]" for
// every single DB error in the app.
function isMessageBearing(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

export function toUserMessage(error: unknown): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    if (isMessageBearing(error)) return error.message
    return String(error)
  }
  return 'Something went wrong. Please try again.'
}
