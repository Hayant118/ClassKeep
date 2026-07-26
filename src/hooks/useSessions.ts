// src/hooks/useSessions.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, Enrollment, Student } from '../types';
import { DEFAULT_TIMEZONE, toUtcIso } from '../utils/timezone';

function fromDb(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    classId: (row.class_id as string | undefined) ?? undefined,
    studentId: (row.student_id as string | undefined) ?? undefined,
    plannedDate: row.planned_date as string,
    plannedTime: row.planned_time as string,
    actualDate: (row.actual_date as string | null) ?? null,
    actualTime: (row.actual_time as string | null) ?? null,
    durationMinutes: (row.duration_minutes as number) ?? 60,
    rateMode: (row.rate_mode as 'auto' | 'override' | 'flat') ?? 'auto',
    rateValue: (row.rate_value as number | null) ?? null,
    totalCharge: (row.total_charge as number | null) ?? null,
    status: row.status as Session['status'],
    movedFromDate: (row.moved_from_date as string | null) ?? null,
    movedFromTime: (row.moved_from_time as string | null) ?? null,
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  };
}

function toDb(s: Partial<Session>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (s.classId !== undefined) map.class_id = s.classId ?? null;
  if (s.studentId !== undefined) map.student_id = s.studentId ?? null;
  if (s.plannedDate !== undefined) map.planned_date = s.plannedDate;
  if (s.plannedTime !== undefined) map.planned_time = s.plannedTime;
  if (s.actualDate !== undefined) map.actual_date = s.actualDate;
  if (s.actualTime !== undefined) map.actual_time = s.actualTime;
  if (s.durationMinutes !== undefined) map.duration_minutes = s.durationMinutes;
  if (s.rateMode !== undefined) map.rate_mode = s.rateMode;
  if (s.rateValue !== undefined) map.rate_value = s.rateValue;
  if (s.totalCharge !== undefined) map.total_charge = s.totalCharge;
  if (s.status !== undefined) map.status = s.status;
  if (s.movedFromDate !== undefined) map.moved_from_date = s.movedFromDate;
  if (s.movedFromTime !== undefined) map.moved_from_time = s.movedFromTime;
  if (s.notes !== undefined) map.notes = s.notes;
  return map;
}

const AUTO_COMPLETE_STORAGE_KEY = 'classkeep-auto-completed-sessions';
const AUTO_COMPLETE_WINDOW_MS = 24 * 60 * 60 * 1000;

function loadAutoCompletedMap(): Map<string, number> {
  try {
    const raw = localStorage.getItem(AUTO_COMPLETE_STORAGE_KEY);
    if (raw) {
      const entries = JSON.parse(raw) as [string, number][];
      const now = Date.now();
      return new Map(entries.filter(([, ts]) => now - ts < AUTO_COMPLETE_WINDOW_MS));
    }
  } catch {
    // ignore storage errors
  }
  return new Map();
}

function saveAutoCompletedMap(map: Map<string, number>) {
  try {
    localStorage.setItem(AUTO_COMPLETE_STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
  } catch {
    // ignore storage errors
  }
}

function markAutoCompletedSessions(sessionIds: string[]) {
  const map = loadAutoCompletedMap();
  const now = Date.now();
  for (const id of sessionIds) {
    map.set(id, now);
  }
  saveAutoCompletedMap(map);
}

export function clearAutoCompletedSession(sessionId: string) {
  const map = loadAutoCompletedMap();
  map.delete(sessionId);
  saveAutoCompletedMap(map);
}

export function isSessionAutoCompleted(sessionId: string): boolean {
  const map = loadAutoCompletedMap();
  const ts = map.get(sessionId);
  if (!ts) return false;
  return Date.now() - ts < AUTO_COMPLETE_WINDOW_MS;
}

function getSessionTimezone(
  session: Session,
  enrollments: Enrollment[],
  students: Student[]
): string {
  if (session.classId) {
    const enrollment = enrollments.find(
      (e) => e.classId === session.classId && e.status === 'active'
    );
    if (enrollment) {
      const student = students.find((s) => s.id === enrollment.studentId);
      if (student?.timezone) return student.timezone;
    }
  } else if (session.studentId) {
    const student = students.find((s) => s.id === session.studentId);
    if (student?.timezone) return student.timezone;
  }
  return DEFAULT_TIMEZONE;
}

function computeAutoCompleteCharge(
  session: Session,
  enrollments: Enrollment[],
  students: Student[]
): number {
  const hours = session.durationMinutes / 60;

  if (session.rateMode === 'flat' && session.rateValue != null) {
    return session.rateValue;
  }

  if (session.rateMode === 'override' && session.rateValue != null) {
    return session.rateValue * hours;
  }

  let rate = 0;
  if (session.classId) {
    const enrollment = enrollments.find(
      (e) => e.classId === session.classId && e.status === 'active'
    );
    if (enrollment) {
      const student = students.find((s) => s.id === enrollment.studentId);
      rate = enrollment.customRate ?? student?.defaultRate ?? 0;
    }
  } else if (session.studentId) {
    const student = students.find((s) => s.id === session.studentId);
    rate = student?.defaultRate ?? 0;
  }

  return rate * hours;
}

export async function checkAndAutoCompleteSessions(
  sessions: Session[],
  enrollments: Enrollment[],
  students: Student[]
): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const now = new Date();
  const sessionsToComplete: Session[] = [];
  const enrollmentBalanceUpdates = new Map<string, number>();

  for (const session of sessions) {
    if (session.status !== 'scheduled') continue;
    if (session.actualDate) continue;

    const timezone = getSessionTimezone(session, enrollments, students);
    const plannedUtc = new Date(toUtcIso(session.plannedDate, session.plannedTime, timezone));
    if (plannedUtc > now) continue;

    const charge = computeAutoCompleteCharge(session, enrollments, students);
    sessionsToComplete.push({ ...session, status: 'completed', totalCharge: charge });

    if (session.classId) {
      const enrollment = enrollments.find(
        (e) => e.classId === session.classId && e.status === 'active'
      );
      if (enrollment && enrollment.paymentType === 'prepaid') {
        enrollmentBalanceUpdates.set(enrollment.id, enrollment.prepaidBalance - charge);
      }
    }
  }

  if (sessionsToComplete.length === 0) return 0;

  const sessionRows = sessionsToComplete.map((s) => ({
    id: s.id,
    status: 'completed' as const,
    total_charge: s.totalCharge,
  }));

  const { error: sessionError } = await supabase
    .from('ck_sessions')
    .upsert(sessionRows, { onConflict: 'id' });

  if (sessionError) throw new Error(sessionError.message);

  if (enrollmentBalanceUpdates.size > 0) {
    const enrollmentRows = Array.from(enrollmentBalanceUpdates.entries()).map(
      ([id, prepaidBalance]) => ({ id, prepaid_balance: prepaidBalance })
    );
    const { error: enrollmentError } = await supabase
      .from('ck_enrollments')
      .upsert(enrollmentRows, { onConflict: 'id' });
    if (enrollmentError) throw new Error(enrollmentError.message);
  }

  markAutoCompletedSessions(sessionsToComplete.map((s) => s.id));
  return sessionsToComplete.length;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (opts?: { startDate?: string; endDate?: string }) => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('ck_sessions')
      .select('*')
      .order('planned_date', { ascending: true });

    if (opts?.startDate) {
      query = query.gte('planned_date', opts.startDate);
    }
    if (opts?.endDate) {
      query = query.lte('planned_date', opts.endDate);
    }

    const { data, error: sbError } = await query;

    if (sbError) {
      setError(sbError.message);
      setSessions([]);
    } else {
      setSessions((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const addSession = async (session: Omit<Session, 'id' | 'userId' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');
    if (!session.classId) throw new Error('Please select a class');

    const payload = {
      ...toDb(session),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_sessions')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newSession = fromDb(data);
    setSessions(prev => [...prev, newSession].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)));
    return newSession;
  };

  const updateSession = async (id: string, updates: Partial<Session>) => {
    const { data, error: sbError } = await supabase
      .from('ck_sessions')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setSessions(prev => prev.map(s => (s.id === id ? updated : s)));
    clearAutoCompletedSession(id);
    return updated;
  };

  const deleteSession = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_sessions')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setSessions(prev => prev.filter(s => s.id !== id));
  };

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    addSession,
    updateSession,
    deleteSession,
  };
}
