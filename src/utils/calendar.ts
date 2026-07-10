import type { Session, Student } from '../types';

export interface SessionWithOverlap extends Session {
  hasOverlap: boolean;
}

function getSessionStartMs(session: Session): number | null {
  // Prefer the explicit date/time fields; fall back to plannedAt for legacy sessions.
  const plannedDateTime =
    session.plannedDate && session.plannedTime
      ? `${session.plannedDate}T${session.plannedTime}`
      : (session as unknown as { plannedAt?: string }).plannedAt;

  if (!plannedDateTime) {
    console.warn('[ClassKeep] Session has no planned date/time.', {
      id: session.id,
      plannedDate: session.plannedDate,
      plannedTime: session.plannedTime,
    });
    return null;
  }

  const start = new Date(plannedDateTime).getTime();
  if (isNaN(start)) {
    console.warn('[ClassKeep] Session has invalid planned date/time.', {
      id: session.id,
      plannedDateTime,
    });
    return null;
  }
  return start;
}

export function sessionsOverlap(a: Session, b: Session): boolean {
  const aStart = getSessionStartMs(a);
  const bStart = getSessionStartMs(b);
  if (aStart == null || bStart == null) return false;

  const aEnd = aStart + a.durationMinutes * 60_000;
  const bEnd = bStart + b.durationMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlappingSessions(sessions: Session[]): Set<string> {
  const overlapIds = new Set<string>();

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (sessionsOverlap(sessions[i], sessions[j])) {
        overlapIds.add(sessions[i].id);
        overlapIds.add(sessions[j].id);
      }
    }
  }

  return overlapIds;
}

export function wouldOverlap(newSession: Omit<Session, 'id'>, existing: Session[]): boolean {
  const temp = { ...newSession, id: '__temp__' } as Session;
  return existing.some((s) => sessionsOverlap(s, temp));
}

/**
 * Return the ids of all sessions that overlap with at least one other session
 * in the provided list. This can be used to check a mixed list of real and
 * draft sessions for clashes.
 */
export function checkOverlap(sessions: Session[]): Set<string> {
  return findOverlappingSessions(sessions);
}

export function getSessionColor(
  session: SessionWithOverlap,
  students: Student[],
  colorConflict = '#ef4444'
): string {
  const studentId = (session as unknown as { studentId?: string }).studentId;
  const student = students.find((s) => s.id === studentId);
  const studentColor = (student as unknown as { color?: string })?.color;
  if (studentColor) {
    return studentColor;
  }

  // Fallback status colors when a student has no color
  if (session.hasOverlap) return colorConflict;
  switch (session.status) {
    case 'completed':
    case 'scheduled':
    case 'no-show':
      return '#22c55e';
    case 'moved':
      return '#f97316';
    case 'cancelled':
    case 'holiday':
      return '#6b7280';
    default:
      return '#22c55e';
  }
}
