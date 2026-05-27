// Appends `.ts` to relative import/export specifiers (Deno requires explicit
// extensions; @oga/core source omits them per TS convention). Anchored on `from`
// so multi-line imports work; bare specifiers (npm:, jsr:) are untouched.
export function addTsExt(src) {
  return src.replace(
    /(\bfrom\s*['"])(\.\.?\/[^'"]+)(['"])/g,
    (m, pre, spec, post) =>
      spec.endsWith('.ts') || spec.endsWith('.json') ? m : `${pre}${spec}.ts${post}`,
  )
}
