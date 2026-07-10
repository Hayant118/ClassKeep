import { format, startOfMonth, startOfWeek, addDays, addMonths } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

export function getTeacherTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

export function toUtcIso(date: string, time: string, timezone: string): string {
  const safeDate = isValidDateString(date) ? date : formatDateKey(new Date());
  const safeTime = isValidTimeString(time) ? time : '09:00';

  if (safeDate !== date || safeTime !== time) {
    console.warn('[ClassKeep] Invalid date/time provided to toUtcIso, using fallback.', {
      originalDate: date,
      originalTime: time,
      safeDate,
      safeTime,
      timezone,
    });
  }

  const result = fromZonedTime(`${safeDate} ${safeTime}`, timezone);
  if (isNaN(result.getTime())) {
    console.warn('[ClassKeep] fromZonedTime produced Invalid Date, falling back to UTC now.', {
      safeDate,
      safeTime,
      timezone,
    });
    return new Date().toISOString();
  }
  return result.toISOString();
}

export function fromUtcIso(utcIso: string, timezone: string): Date {
  const parsed = new Date(utcIso);
  if (isNaN(parsed.getTime())) {
    console.warn('[ClassKeep] Invalid utcIso passed to fromUtcIso, returning current UTC time.', { utcIso, timezone });
    return new Date();
  }
  return toZonedTime(parsed, timezone);
}

export function formatDateKeyInTz(utcIso: string, timezone: string): string {
  try {
    return format(fromUtcIso(utcIso, timezone), 'yyyy-MM-dd');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format date key.', { utcIso, timezone, err });
    return 'invalid-date';
  }
}

export function formatTimeInTz(utcIso: string, timezone: string): string {
  try {
    return format(fromUtcIso(utcIso, timezone), 'HH:mm');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format time.', { utcIso, timezone, err });
    return 'invalid-time';
  }
}

export function formatDisplayDateInTz(utcIso: string, timezone: string): string {
  try {
    return format(fromUtcIso(utcIso, timezone), 'MMM d');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format display date.', { utcIso, timezone, err });
    return 'Invalid';
  }
}

export function formatDisplayWeekdayInTz(utcIso: string, timezone: string): string {
  try {
    return format(fromUtcIso(utcIso, timezone), 'EEE');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format weekday.', { utcIso, timezone, err });
    return '???';
  }
}

export function formatFullDateTimeInTz(utcIso: string, timezone: string): string {
  try {
    return format(fromUtcIso(utcIso, timezone), 'MMM d, yyyy h:mm a');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format full date time.', { utcIso, timezone, err });
    return 'Invalid';
  }
}

export function isSameDayInTz(aIso: string, bIso: string, timezone: string): boolean {
  return formatDateKeyInTz(aIso, timezone) === formatDateKeyInTz(bIso, timezone);
}

function safeDateInput(date: Date, label: string): Date {
  if (date instanceof Date && !isNaN(date.getTime())) return date;
  console.warn(`[ClassKeep] Invalid Date passed to ${label}, using current time.`, date);
  return new Date();
}

export function startOfWeekInTz(utcDate: Date, timezone: string): Date {
  const safe = safeDateInput(utcDate, 'startOfWeekInTz');
  const zoned = toZonedTime(safe, timezone);
  const monday = startOfWeek(zoned, { weekStartsOn: 1 });
  return fromZonedTime(format(monday, 'yyyy-MM-dd HH:mm:ss'), timezone);
}

export function startOfMonthInTz(utcDate: Date, timezone: string): Date {
  const safe = safeDateInput(utcDate, 'startOfMonthInTz');
  const zoned = toZonedTime(safe, timezone);
  const firstOfMonth = startOfMonth(zoned);
  return fromZonedTime(format(firstOfMonth, 'yyyy-MM-dd HH:mm:ss'), timezone);
}

export function addDaysInTz(utcDate: Date, days: number, timezone: string): Date {
  const safe = safeDateInput(utcDate, 'addDaysInTz');
  const zoned = toZonedTime(safe, timezone);
  const next = addDays(zoned, days);
  return fromZonedTime(format(next, 'yyyy-MM-dd HH:mm:ss'), timezone);
}

export function addMonthsInTz(utcDate: Date, months: number, timezone: string): Date {
  const safe = safeDateInput(utcDate, 'addMonthsInTz');
  const zoned = toZonedTime(safe, timezone);
  const next = addMonths(zoned, months);
  return fromZonedTime(format(next, 'yyyy-MM-dd HH:mm:ss'), timezone);
}

export function getCalendarDaysForMonth(
  monthStartUtc: Date,
  timezone: string
): Date[] {
  const safe = safeDateInput(monthStartUtc, 'getCalendarDaysForMonth');
  const zonedMonthStart = toZonedTime(safe, timezone);
  const gridStart = startOfWeek(zonedMonthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const zonedDay = addDays(gridStart, i);
    days.push(fromZonedTime(format(zonedDay, 'yyyy-MM-dd HH:mm:ss'), timezone));
  }
  return days;
}

export function formatMonthYearInTz(utcDate: Date, timezone: string): string {
  try {
    const safe = safeDateInput(utcDate, 'formatMonthYearInTz');
    return format(toZonedTime(safe, timezone), 'MMMM yyyy');
  } catch (err) {
    console.warn('[ClassKeep] Failed to format month/year.', { utcDate, timezone, err });
    return 'Invalid';
  }
}

export function formatWeekRangeInTz(
  weekStartUtc: Date,
  timezone: string
): string {
  try {
    const safe = safeDateInput(weekStartUtc, 'formatWeekRangeInTz');
    const startZoned = toZonedTime(safe, timezone);
    const endZoned = addDays(startZoned, 6);
    const startStr = format(startZoned, 'MMM d');
    const endStr = format(endZoned, 'MMM d, yyyy');
    return `${startStr} - ${endStr}`;
  } catch (err) {
    console.warn('[ClassKeep] Failed to format week range.', { weekStartUtc, timezone, err });
    return 'Invalid range';
  }
}

export function getDayIndexInWeek(utcDate: Date, timezone: string): number {
  try {
    const safe = safeDateInput(utcDate, 'getDayIndexInWeek');
    const day = Number(format(toZonedTime(safe, timezone), 'i'));
    return day - 1;
  } catch (err) {
    console.warn('[ClassKeep] Failed to get day index.', { utcDate, timezone, err });
    return 0;
  }
}

export function getSlotIndexFromTime(time: string, startHour: number): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    console.warn('[ClassKeep] Invalid time passed to getSlotIndexFromTime.', { time, startHour });
    return 0;
  }
  return ((hours - startHour) * 60 + minutes) / 30;
}
