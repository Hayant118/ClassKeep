// src/hooks/useSessions.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '../types';

function fromDb(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    classId: (row.class_id as string) ?? '',
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
  if (s.classId !== undefined) map.class_id = s.classId;
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