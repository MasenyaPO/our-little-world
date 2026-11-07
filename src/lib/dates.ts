export type Recurrence = 'once' | 'annual' | 'monthly';

/** 'YYYY-MM-DD' -> local midnight. (new Date('YYYY-MM-DD') is UTC and can land on the wrong day.) */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toDateInput = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const startOfToday = (): Date => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** Builds a date, clamping the day so e.g. Jan 31 -> Feb 28 instead of overflowing into March. */
const clamped = (y: number, m0: number, day: number) => new Date(y, m0, Math.min(day, daysInMonth(y, m0)));

export interface Occurrence {
  next: Date;          // the next time it happens (or the date itself if it was a one-off)
  daysRemaining: number; // negative only for one-off dates already in the past
  yearsOn: number | null; // "3rd anniversary" count for yearly dates
}

export const nextOccurrence = (dateStr: string, rec: Recurrence, today = startOfToday()): Occurrence => {
  const orig = parseLocalDate(dateStr);
  let next = orig;

  if (rec === 'annual') {
    next = clamped(today.getFullYear(), orig.getMonth(), orig.getDate());
    if (next < today) next = clamped(today.getFullYear() + 1, orig.getMonth(), orig.getDate());
  } else if (rec === 'monthly') {
    next = clamped(today.getFullYear(), today.getMonth(), orig.getDate());
    if (next < today) next = clamped(today.getFullYear(), today.getMonth() + 1, orig.getDate());
    if (next < orig) next = orig; // a monthly date that hasn't started yet
  }

  const daysRemaining = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  const yearsOn = rec === 'annual' ? next.getFullYear() - orig.getFullYear() : null;
  return { next, daysRemaining, yearsOn };
};

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const formatLongDate = (s: string): string =>
  parseLocalDate(s).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const formatShortDate = (d: Date | string): string =>
  (typeof d === 'string' ? parseLocalDate(d) : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "2 hours ago", "yesterday" ... */
export const timeAgo = (iso: string): string => {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, secs] of steps) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return 'just now';
};
