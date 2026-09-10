// Simplification: dates are handled in the server's local timezone (no
// per-user timezone setting exists in the schema - this is a single-user
// app and out of scope for the design as given).

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function dayOffsetToDate(offset: number): Date {
  return addDays(startOfDay(new Date()), offset);
}

export function addMinutes(d: Date, minutes: number): Date {
  const out = new Date(d);
  out.setMinutes(out.getMinutes() + minutes);
  return out;
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// yyyy-mm-dd, for URL params - constructed/parsed in local time (not UTC)
// to match this file's server-local-time convention.
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

/** Full calendar weeks (Sun-Sat) covering `month` (0-indexed), including
 * leading/trailing days from adjacent months so every week is 7 days. */
export function getMonthGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);

  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  return `${DAY_NAMES[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
}

export function dayLabelForDate(date: Date): string {
  const offsetDays = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  return dayLabel(offsetDays, date);
}

export function formatHM(d: Date | null): string {
  if (!d) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function fmtElapsedSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
