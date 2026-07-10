// src/hooks/usePreferences.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CalendarPreferences } from '../types';

const DEFAULT_PREFERENCES: CalendarPreferences = {
  id: '',
  userId: '',
  colorConfirmed: '#22c55e',
  colorMoved: '#f97316',
  colorCancelled: '#6b7280',
  colorDraft: '#3b82f6',
  colorConflict: '#ef4444',
  calendarStartTime: '08:00:00',
  calendarEndTime: '22:00:00',
  calendarSlotMinutes: 30,
  updatedAt: new Date().toISOString(),
};

function fromDb(row: Record<string, unknown>): CalendarPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    colorConfirmed: (row.color_confirmed as string) ?? '#22c55e',
    colorMoved: (row.color_moved as string) ?? '#f97316',
    colorCancelled: (row.color_cancelled as string) ?? '#6b7280',
    colorDraft: (row.color_draft as string) ?? '#3b82f6',
    colorConflict: (row.color_conflict as string) ?? '#ef4444',
    calendarStartTime: (row.calendar_start_time as string) ?? '08:00:00',
    calendarEndTime: (row.calendar_end_time as string) ?? '22:00:00',
    calendarSlotMinutes: (row.calendar_slot_minutes as number) ?? 30,
    updatedAt: row.updated_at as string,
  };
}

function toDb(prefs: Partial<CalendarPreferences>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (prefs.colorConfirmed !== undefined) map.color_confirmed = prefs.colorConfirmed;
  if (prefs.colorMoved !== undefined) map.color_moved = prefs.colorMoved;
  if (prefs.colorCancelled !== undefined) map.color_cancelled = prefs.colorCancelled;
  if (prefs.colorDraft !== undefined) map.color_draft = prefs.colorDraft;
  if (prefs.colorConflict !== undefined) map.color_conflict = prefs.colorConflict;
  if (prefs.calendarStartTime !== undefined) map.calendar_start_time = prefs.calendarStartTime;
  if (prefs.calendarEndTime !== undefined) map.calendar_end_time = prefs.calendarEndTime;
  if (prefs.calendarSlotMinutes !== undefined) map.calendar_slot_minutes = prefs.calendarSlotMinutes;
  return map;
}

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<CalendarPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error: sbError } = await supabase
      .from('ck_preferences')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    if (sbError && sbError.code !== 'PGRST116') {
      setError(sbError.message);
    } else if (data) {
      setPreferencesState(fromDb(data));
    } else {
      const payload = {
        user_id: userData.user.id,
        color_confirmed: DEFAULT_PREFERENCES.colorConfirmed,
        color_moved: DEFAULT_PREFERENCES.colorMoved,
        color_cancelled: DEFAULT_PREFERENCES.colorCancelled,
        color_draft: DEFAULT_PREFERENCES.colorDraft,
        color_conflict: DEFAULT_PREFERENCES.colorConflict,
        calendar_start_time: DEFAULT_PREFERENCES.calendarStartTime,
        calendar_end_time: DEFAULT_PREFERENCES.calendarEndTime,
        calendar_slot_minutes: DEFAULT_PREFERENCES.calendarSlotMinutes,
      };

      const { data: newData, error: insertError } = await supabase
        .from('ck_preferences')
        .insert(payload)
        .select()
        .single();

      if (!insertError && newData) {
        setPreferencesState(fromDb(newData));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const setPreferences = async (updates: Partial<CalendarPreferences>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const next = { ...preferences, ...updates };
    setPreferencesState(next);

    const { error: sbError } = await supabase
      .from('ck_preferences')
      .update(toDb(updates))
      .eq('user_id', userData.user.id);

    if (sbError) {
      setError(sbError.message);
    }
  };

  return { preferences, loading, error, setPreferences };
}