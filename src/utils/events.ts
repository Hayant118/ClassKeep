// src/utils/events.ts
import type { CalendarEvent } from '../types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Background tint for a day covered by an event. First event of the day wins. */
export function getEventTint(event: CalendarEvent): string {
  if (event.type === 'holiday') {
    return 'repeating-linear-gradient(45deg, rgba(107,114,128,0.15) 0px, rgba(107,114,128,0.15) 6px, transparent 6px, transparent 12px)';
  }
  if (event.type === 'travel') {
    return '#dbeafe';
  }
  return `${event.color ?? '#3b82f6'}1f`;
}

/** Accent color for dots / badges / borders. */
export function getEventColor(event: CalendarEvent): string {
  if (event.type === 'holiday') return '#6b7280';
  if (event.type === 'travel') return '#2563eb';
  return event.color ?? '#3b82f6';
}

export function getEventTypeLabel(event: CalendarEvent): string {
  if (event.type === 'holiday') return 'Holiday';
  if (event.type === 'travel') return 'Travel';
  return 'Event';
}

/**
 * Expand event ranges ('YYYY-MM-DD' plain strings) into a dateKey -> events map.
 * Uses LOCAL date arithmetic so timezone cannot shift the day boundaries.
 */
export function buildEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const startParts = event.startDate.split('-').map(Number);
    const endParts = event.endDate.split('-').map(Number);
    if (startParts.length !== 3 || endParts.length !== 3) continue;
    const [sy, sm, sd] = startParts;
    const [ey, em, ed] = endParts;
    if ([sy, sm, sd, ey, em, ed].some((n) => Number.isNaN(n))) continue;

    const cursor = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 370) {
      const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
  }
  return map;
}

/** First event whose [startDate, endDate] range covers dateKey (plain string compare). */
export function findEventForDate(events: CalendarEvent[], dateKey: string): CalendarEvent | undefined {
  return events.find((e) => e.startDate <= dateKey && dateKey <= e.endDate);
}
