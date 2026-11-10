/**
 * Calculates current age from a birthday string (YYYY-MM-DD or standard date format).
 * Returns undefined if birthday is missing, invalid, or in the future.
 */
export function calculateAge(birthday?: string | null): number | undefined {
  if (!birthday || !birthday.trim()) return undefined;

  const parts = birthday.trim().split('-').map(Number);
  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  if (parts.length === 3 && !parts.some(isNaN)) {
    [birthYear, birthMonth, birthDay] = parts;
  } else {
    const d = new Date(birthday);
    if (isNaN(d.getTime())) return undefined;
    birthYear = d.getFullYear();
    birthMonth = d.getMonth() + 1;
    birthDay = d.getDate();
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const currentDay = today.getDate();

  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age--;
  }

  return age >= 0 && age <= 130 ? age : undefined;
}

/** A date as "YYYY-MM-DD" in this device's local time (toISOString() would give UTC, i.e. tomorrow on a Wednesday evening in California). */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Calendar date at the club, regardless of the runner's device time zone. */
export function clubYmd(date = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
