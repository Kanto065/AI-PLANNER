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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  return `${DAY_NAMES[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
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
