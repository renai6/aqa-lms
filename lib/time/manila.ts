// Vercel runs in UTC while the academy runs on Philippine time, so every
// "which month is this" question has to be answered on the Manila calendar.
// A payment submitted at 00:30 on 1 October in Manila is still 30 September
// in UTC, and answering from the server clock bills it to the wrong month.
//
// `lib/batches/name.ts` has its own Manila formatter. It produces a different
// format for a different purpose - a label snapshotted at batch creation that
// must never be recomputed - and the two are deliberately not shared.

// "2026-09". The canonical key for a billing month across the payment code.
// Zero-padded so plain string comparison orders months correctly, which is
// what makes the range and sort logic below safe.
export type MonthKey = string;

const MANILA_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
});

// For an instant that really happened, such as "now" or an enrollment date.
export function toMonthKey(date: Date): MonthKey {
  const parts = MANILA_PARTS.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

// The value stored in `Payment.periodMonth`: the month's first day at UTC
// midnight. The column is `@db.Date`, which carries no time, so there is no
// clock left to drift across the date line.
export function monthKeyToDate(key: MonthKey): Date {
  return new Date(`${key}-01T00:00:00.000Z`);
}

// The inverse, for a value read back out of `@db.Date`. Deliberately UTC and
// not Manila: this unwraps an anchor we wrote ourselves, it does not convert
// a real instant into a calendar month the way `toMonthKey` does.
export function dateToMonthKey(date: Date): MonthKey {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function nextMonthKey(key: MonthKey): MonthKey {
  const [year, month] = key.split("-").map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Inclusive of both ends. An end before the start yields nothing rather than
// looping forever, which is the failure mode of the obvious implementation.
export function monthKeysBetween(start: MonthKey, end: MonthKey): MonthKey[] {
  if (end < start) return [];
  const keys: MonthKey[] = [];
  for (let cur = start; cur <= end; cur = nextMonthKey(cur)) keys.push(cur);
  return keys;
}

// Both labels format the UTC anchor in UTC. Formatting it in Manila would
// render the same day at 08:00, which cannot change the month, but keeping
// the anchor's own zone makes the intent obvious.
const LONG_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});

const SHORT_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

export function monthKeyLabel(key: MonthKey): string {
  return LONG_LABEL.format(monthKeyToDate(key));
}

export function monthKeyShort(key: MonthKey): string {
  return SHORT_LABEL.format(monthKeyToDate(key));
}
