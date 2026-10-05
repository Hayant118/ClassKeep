// src/hooks/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CalendarEvent } from '../types';

function fromDb(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    type: row.type as CalendarEvent['type'],
    color: (row.color as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    createdAt: row.created_at as string,
  };
}

function toDb(e: Partial<CalendarEvent>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (e.title !== undefined) map.title = e.title;
  if (e.type !== undefined) map.type = e.type;
  if (e.color !== undefined) map.color = e.color;
  if (e.notes !== undefined) map.notes = e.notes;
  if (e.startDate !== undefined) map.start_date = e.startDate;
  if (e.endDate !== undefined) map.end_date = e.endDate;
  return map;
}

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (opts?: { startDate?: string; endDate?: string }) => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('ck_events')
      .select('*')
      .order('start_date', { ascending: true });

    if (opts?.startDate) {
      query = query.gte('end_date', opts.startDate);
    }
    if (opts?.endDate) {
      query = query.lte('start_date', opts.endDate);
    }

    const { data, error: sbError } = await query;

    if (sbError) {
      setError(sbError.message);
      setEvents([]);
    } else {
      setEvents((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = async (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(event),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_events')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newEvent = fromDb(data);
    setEvents(prev => [...prev, newEvent].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    return newEvent;
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const { data, error: sbError } = await supabase
      .from('ck_events')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setEvents(prev => prev.map(e => (e.id === id ? updated : e)));
    return updated;
  };

  const deleteEvent = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_events')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setEvents(prev => prev.filter(e => e.id !== id));
  };

  return {
    events,
    loading,
    error,
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
