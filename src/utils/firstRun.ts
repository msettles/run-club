/**
 * A member's First Run Date, shown as month/year.
 *
 * - With runs that have no check-in record, it is "Before mm/yyyy", where mm/yyyy is when the club's check-in records
 *   begin (the first recorded run, club-wide): from then on everyone should have checked in, so earlier runs have no record.
 * - Otherwise it is "mm/yyyy" of their oldest check-in (this app's check-ins, and dated sign-ins from claimed old names).
 */
const monthYear = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function firstRunLabel(noCheckInRuns: number, dates: string[], recordsBegin?: string): string | undefined {
  const valid = (d: string | undefined): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const oldest = dates.filter(valid).sort()[0];
  if (noCheckInRuns > 0) {
    const start = [recordsBegin, oldest].filter(valid).sort()[0];
    return start ? `Before ${monthYear(start)}` : 'Before check-ins began';
  }
  return oldest ? monthYear(oldest) : undefined;
}

/** What follows "Running since", whatever form the First Run Date takes ("03/2021", "Before 01/2021", or an older "2021-03-10"). */
export function runningSince(firstRun: string): string {
  const before = firstRun.match(/^Before (\d{2}\/\d{4})$/);
  if (before) return `before ${before[1]}`;
  if (/^\d{2}\/\d{4}$/.test(firstRun)) return firstRun;
  return /^\d{4}-/.test(firstRun) ? firstRun.slice(0, 4) : '';
}
