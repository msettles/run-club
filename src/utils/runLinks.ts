/** Canonical public links contain only a run ID, never check-in credentials. */
export function runShareUrl(id: string, origin: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('run', id);
  return url.toString();
}

/** Run IDs the app creates: "run-" + a timestamp (see createRunWithCheckIn). */
const APP_RUN_ID = /^run-\d+/;

/**
 * The run ID from a shared link's query string, or null.
 *
 * Shared links are often pasted with text stuck to them: a share sheet's "Copy"
 * can put the message on the next line, and the address bar drops that line break
 * ("?run=run-1794268066923Join us for…"), or a trailing "!" or "." comes along.
 * For app-made IDs only the "run-<digits>" part is used; anything after it is ignored.
 */
export function sharedRunId(search: string): string | null {
  const raw = new URLSearchParams(search).get('run')?.trim();
  if (!raw) return null;
  const id = raw.match(APP_RUN_ID)?.[0] ?? raw;
  return id.length <= 1500 && !id.includes('/') && id !== '.' && id !== '..' ? id : null;
}
