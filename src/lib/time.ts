// Zeitzonen-Helfer: Eingaben sind lokale Praxiszeit, gespeichert wird UTC.
export const TZ = "Europe/Berlin";

function offsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2026-11-17T09:30" (Praxiszeit) → Date (UTC) */
export function zonedToUtc(local: string, tz = TZ): Date {
  const [d, t = "00:00"] = local.split("T");
  const guess = new Date(`${d}T${t.slice(0, 5)}:00Z`);
  const off = offsetMinutes(guess, tz);
  let res = new Date(guess.getTime() - off * 60000);
  const off2 = offsetMinutes(res, tz);
  if (off2 !== off) res = new Date(guess.getTime() - off2 * 60000);
  return res;
}

/** Date → { date: "YYYY-MM-DD", time: "HH:mm", minutes } in Praxiszeit */
export function toZoned(date: Date | string, tz = TZ) {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const date_ = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date: date_, time, minutes: Number(get("hour")) * 60 + Number(get("minute")), local: `${date_}T${time}` };
}

export function today(tz = TZ) {
  return toZoned(new Date(), tz).date;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO-Wochentag 1 = Montag … 7 = Sonntag */
export function weekday(day: string): number {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(day: string) {
  return addDays(day, 1 - weekday(day));
}

export function dayRange(day: string, tz = TZ) {
  return { from: zonedToUtc(`${day}T00:00`, tz).toISOString(), to: zonedToUtc(`${addDays(day, 1)}T00:00`, tz).toISOString() };
}

export function fmtDate(v: string | Date, tz = TZ) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
}
export function fmtDay(day: string) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
export function fmtDayShort(day: string) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
export function fmtTime(v: string | Date, tz = TZ) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(v));
}
export function fmtDateTime(v: string | Date, tz = TZ) {
  return `${fmtDate(v, tz)} ${fmtTime(v, tz)}`;
}
export function minutesBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
export function age(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
export function hhmmToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToHhmm(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
