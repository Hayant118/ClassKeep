// src/utils/draftSessionAdapter.ts
import type { Session } from '../types';

export interface DraftSessionItem {
  id?: string;
  date?: string;
  time?: string;
  plannedDate?: string;
  plannedTime?: string;
  durationMinutes?: number;
  duration_minutes?: number;
  studentId?: string;
  student_id?: string;
  classId?: string;
  class_id?: string;
  rateMode?: 'auto' | 'override' | 'flat';
  rate_mode?: 'auto' | 'override' | 'flat';
  rateValue?: number | null;
  rate_value?: number | null;
  status?: Session['status'];
  notes?: string;
}

export type AdaptedDraftSession = Session & { studentId?: string };

function getString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function getNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number') return value;
  }
  return undefined;
}

/**
 * Convert the JSONB `draft_sessions` array stored on a proposal into Session-like
 * objects that WeekView / DayView can render.
 */
export function draftSessionsToSessions(
  draftSessions: unknown[],
  options: { proposalId?: string; userId?: string } = {}
): AdaptedDraftSession[] {
  return (draftSessions || []).map((item, index) => {
    const raw = (item ?? {}) as DraftSessionItem & Record<string, unknown>;

    const plannedDate = getString(raw, ['plannedDate', 'date']) ?? '';
    const plannedTime = getString(raw, ['plannedTime', 'time']) ?? '08:00';
    const durationMinutes = getNumber(raw, ['durationMinutes', 'duration_minutes']) ?? 60;
    const id = getString(raw, ['id']) ?? `${options.proposalId ?? 'proposal'}-draft-${index}`;

    return {
      id,
      userId: options.userId ?? '',
      classId: getString(raw, ['classId', 'class_id']) ?? '',
      plannedDate,
      plannedTime,
      actualDate: null,
      actualTime: null,
      durationMinutes,
      rateMode: (getString(raw, ['rateMode', 'rate_mode']) as Session['rateMode']) ?? 'auto',
      rateValue: (getNumber(raw, ['rateValue', 'rate_value']) as number | null) ?? null,
      totalCharge: null,
      status: (getString(raw, ['status']) as Session['status']) ?? 'scheduled',
      movedFromDate: null,
      movedFromTime: null,
      notes: getString(raw, ['notes']) ?? '',
      createdAt: new Date().toISOString(),
      studentId: getString(raw, ['studentId', 'student_id']),
    };
  });
}

/**
 * Convert a Session payload (e.g. from SessionModal) back into a DraftSessionItem
 * to store in the proposal's `draft_sessions` JSONB column.
 */
export function sessionPayloadToDraftSession(
  payload: Omit<Session, 'id' | 'userId' | 'createdAt'>,
  options: { id?: string; studentId?: string } = {}
): DraftSessionItem {
  return {
    id: options.id,
    plannedDate: payload.plannedDate,
    plannedTime: payload.plannedTime,
    durationMinutes: payload.durationMinutes,
    classId: payload.classId,
    studentId: options.studentId,
    rateMode: payload.rateMode,
    rateValue: payload.rateValue,
    status: payload.status,
    notes: payload.notes,
  };
}
