/**
 * A member's First Run Date: their oldest check-in date (this app's check-ins, and any claimed old sign-ins with a date),
 * or "Before mm/yyyy" when they also have runs with no check-in record. Those runs came before the recorded dates,
 * so the month and year are those of the oldest recorded date.
 */
export function firstRunLabel(noCheckInRuns: number, dates: string[]): string | undefined {
  const oldest = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
  if (noCheckInRuns > 0) return oldest ? `Before ${oldest.slice(5, 7)}/${oldest.slice(0, 4)}` : 'Before check-ins began';
  return oldest;
}

/** The year to show as "Running since", whatever form the First Run Date takes ("2021-03-10" or "Before 03/2021"). */
export function runningSince(firstRun: string): string {
  const before = firstRun.match(/^Before (\d{2}\/\d{4})$/);
  if (before) return `before ${before[1]}`;
  return /^\d{4}/.test(firstRun) ? firstRun.slice(0, 4) : '';
}
