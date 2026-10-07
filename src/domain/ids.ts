/**
 * Next id following an existing convention ("TASK-007" → "TASK-008").
 * Shared by the browser (to propose an id) and the server (to confirm it).
 */
export function nextId(existing: readonly string[], fallbackPrefix: string): string {
  const parsed = existing.map((id) => /^(.*?)(\d+)$/.exec(id)).filter((m): m is RegExpExecArray => m !== null);
  if (parsed.length === 0) return `${fallbackPrefix}001`;
  const prefixes = new Map<string, number>();
  for (const m of parsed) prefixes.set(m[1], (prefixes.get(m[1]) ?? 0) + 1);
  const prefix = [...prefixes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const same = parsed.filter((m) => m[1] === prefix);
  const max = Math.max(...same.map((m) => Number(m[2])));
  const width = Math.max(...same.map((m) => m[2].length));
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}
