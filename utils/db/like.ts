/**
 * Escapes LIKE/ILIKE metacharacters in untrusted search input and wraps it for
 * a case-insensitive "contains" match. Without the escape, a `%` or `_` typed
 * into a search box would act as a wildcard and broaden the query.
 */
export function ilikeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
