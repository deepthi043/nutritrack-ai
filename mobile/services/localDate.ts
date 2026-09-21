/** YYYY-MM-DD in the device's own local timezone. Deliberately NOT
 * `Date#toISOString().slice(0, 10)` — that converts to UTC first, which
 * reports the wrong calendar day near midnight in any non-UTC timezone
 * (e.g. 11pm in UTC+5:30 is already 6pm UTC the same day, but 11:30pm in
 * UTC-8 is 7:30am UTC the *next* day). Every endpoint that accepts a
 * `local_date` query param (activity, streaks) needs this exact same
 * value so the server's notion of "today" matches the device's. */
export function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
