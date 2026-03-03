export function matchesSearch(query: string, fields: (string | number | undefined | null)[]): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  return fields.some((f) => f != null && String(f).toLowerCase().includes(lower));
}
