/** A permission refusal alone does not establish that a run's code word is locked. */
export function friendlyRunError(error: unknown): Error {
  const err = error as { code?: string; message?: string } | null;
  if (['duplicate-code-word', 'club-maintenance'].includes(err?.code || '') && err?.message) return new Error(err.message);
  if (err?.code === 'permission-denied') return new Error('Not saved: your account is not allowed to save this run. If club maintenance is on, use the club admin account; otherwise refresh and try again.');
  return new Error(`Not saved${err?.code ? ` (${err.code})` : ''}. Please check your connection and try again.`);
}
