/** Canonical public links contain only a run ID, never check-in credentials. */
export function runShareUrl(id: string, origin: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('run', id);
  return url.toString();
}
export function sharedRunId(search: string): string | null {
  const id = new URLSearchParams(search).get('run');
  return id && id.length <= 1500 && !id.includes('/') && id !== '.' && id !== '..' ? id : null;
}
