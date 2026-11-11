import { sharedRunId } from './runLinks';
export interface CheckInReturnTarget { runId?: string; candidateIds?: string[] }

/** Carry only public navigation state, never credentials, email or code words. */
export function authReturnUrl(source: string, pending?: CheckInReturnTarget): string {
  const original = new URL(source);
  const result = new URL('/', original.origin);
  const runId = pending ? pending.runId : sharedRunId(original.search);
  if (runId) result.searchParams.set('run', runId);
  if (pending || original.searchParams.get('checkin') === 'true' || original.hash === '#checkin') result.searchParams.set('checkin', 'true');
  return result.toString();
}

/** Ignore a caller-supplied destination on another origin. */
export function safeAuthReturnUrl(current: string, destination?: string): string {
  if (destination) {
    try {
      const candidate = new URL(destination, current);
      if (candidate.origin === new URL(current).origin) return authReturnUrl(candidate.toString());
    } catch { /* Fall back to the current app's public navigation state. */ }
  }
  return authReturnUrl(current);
}
