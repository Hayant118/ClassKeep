// src/hooks/usePreferences.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { AccentTheme, CalendarPreferences, ColorPaletteName, LanguagePreference, ThemePreference } from '../types';

const DEFAULT_PREFERENCES: CalendarPreferences = {
  id: '',
  userId: '',
  theme: 'system',
  accentTheme: 'indigo',
  colorPalette: 'vivid',
  language: 'en',
  currency: '¥',
  colorConfirmed: '#22c55e',
  colorMoved: '#f97316',
  colorCancelled: '#6b7280',
  colorDraft: '#3b82f6',
  colorConflict: '#ef4444',
  calendarStartTime: '08:00:00',
  calendarEndTime: '22:00:00',
  calendarSlotMinutes: 30,
  lowBalanceThreshold: 300,
  defaultCalendarView: 'week',
  billingPrimaryMetric: 'projected',
  updatedAt: new Date().toISOString(),
};

function fromDb(row: Record<string, unknown>): CalendarPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    theme: (row.theme as ThemePreference | undefined) ?? 'system',
    accentTheme: (row.accent_theme as AccentTheme | undefined) ?? 'indigo',
    colorPalette: (row.color_palette as ColorPaletteName | undefined) ?? 'vivid',
    language: (row.language as LanguagePreference | undefined) ?? 'en',
    currency: (row.currency as string | undefined) ?? '¥',
    colorConfirmed: (row.color_confirmed as string) ?? '#22c55e',
    colorMoved: (row.color_moved as string) ?? '#f97316',
    colorCancelled: (row.color_cancelled as string) ?? '#6b7280',
    colorDraft: (row.color_draft as string) ?? '#3b82f6',
    colorConflict: (row.color_conflict as string) ?? '#ef4444',
    calendarStartTime: (row.calendar_start_time as string) ?? '08:00:00',
    calendarEndTime: (row.calendar_end_time as string) ?? '22:00:00',
    calendarSlotMinutes: (row.calendar_slot_minutes as number) ?? 30,
    lowBalanceThreshold: (row.low_balance_threshold as number) ?? 300,
    defaultCalendarView: (row.default_calendar_view as 'day' | 'week' | 'month') ?? 'week',
    billingPrimaryMetric: (row.billing_primary_metric as 'projected' | 'earned' | undefined) ?? 'projected',
    updatedAt: row.updated_at as string,
  };
}

function toDb(prefs: Partial<CalendarPreferences>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (prefs.theme !== undefined) map.theme = prefs.theme;
  if (prefs.accentTheme !== undefined) map.accent_theme = prefs.accentTheme;
  if (prefs.colorPalette !== undefined) map.color_palette = prefs.colorPalette;
  if (prefs.language !== undefined) map.language = prefs.language;
  if (prefs.currency !== undefined) map.currency = prefs.currency;
  if (prefs.colorConfirmed !== undefined) map.color_confirmed = prefs.colorConfirmed;
  if (prefs.colorMoved !== undefined) map.color_moved = prefs.colorMoved;
  if (prefs.colorCancelled !== undefined) map.color_cancelled = prefs.colorCancelled;
  if (prefs.colorDraft !== undefined) map.color_draft = prefs.colorDraft;
  if (prefs.colorConflict !== undefined) map.color_conflict = prefs.colorConflict;
  if (prefs.calendarStartTime !== undefined) map.calendar_start_time = prefs.calendarStartTime;
  if (prefs.calendarEndTime !== undefined) map.calendar_end_time = prefs.calendarEndTime;
  if (prefs.calendarSlotMinutes !== undefined) map.calendar_slot_minutes = prefs.calendarSlotMinutes;
  if (prefs.lowBalanceThreshold !== undefined) map.low_balance_threshold = prefs.lowBalanceThreshold;
  if (prefs.defaultCalendarView !== undefined) map.default_calendar_view = prefs.defaultCalendarView;
  if (prefs.billingPrimaryMetric !== undefined) map.billing_primary_metric = prefs.billingPrimaryMetric;
  return map;
}

/**
 * Resolve the current user's id. Validates via getUser() first (network), then
 * falls back to the locally stored session — on a cold load or a flaky network
 * getUser() can come back empty while a perfectly good session sits in storage,
 * which previously made every save silently do nothing.
 */
async function resolveUserId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) return userData.user.id;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user?.id ?? null;
}

// Event broadcast whenever any usePreferences instance writes, so all other
// instances (App's theme/applier, data hooks, other screens) apply the new
// values instantly instead of waiting for a reload.
const PREFS_UPDATED_EVENT = 'classkeep:prefs-updated';

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<CalendarPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every local write so a slow SELECT that started earlier can't
  // overwrite fresher optimistic state when it finally resolves.
  const writeEpoch = useRef(0);

  const fetchPreferences = useCallback(async () => {
    const epoch = writeEpoch.current;
    setLoading(true);
    const userId = await resolveUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error: sbError } = await supabase
      .from('ck_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (sbError && sbError.code !== 'PGRST116') {
      setError(sbError.message);
    } else if (data) {
      if (writeEpoch.current === epoch) {
        setPreferencesState(fromDb(data));
      }
    } else {
      const payload = {
        user_id: userId,
        theme: DEFAULT_PREFERENCES.theme,
        accent_theme: DEFAULT_PREFERENCES.accentTheme,
        color_palette: DEFAULT_PREFERENCES.colorPalette,
        language: DEFAULT_PREFERENCES.language,
        currency: DEFAULT_PREFERENCES.currency,
        color_confirmed: DEFAULT_PREFERENCES.colorConfirmed,
        color_moved: DEFAULT_PREFERENCES.colorMoved,
        color_cancelled: DEFAULT_PREFERENCES.colorCancelled,
        color_draft: DEFAULT_PREFERENCES.colorDraft,
        color_conflict: DEFAULT_PREFERENCES.colorConflict,
        calendar_start_time: DEFAULT_PREFERENCES.calendarStartTime,
        calendar_end_time: DEFAULT_PREFERENCES.calendarEndTime,
        calendar_slot_minutes: DEFAULT_PREFERENCES.calendarSlotMinutes,
        low_balance_threshold: DEFAULT_PREFERENCES.lowBalanceThreshold,
      };

      const { data: newData, error: insertError } = await supabase
        .from('ck_preferences')
        .insert(payload)
        .select()
        .single();

      if (!insertError && newData && writeEpoch.current === epoch) {
        setPreferencesState(fromDb(newData));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
    // Refetch once the auth session is (re)established: on a cold load the
    // first getUser() can race session restoration, and without a user the
    // hook would otherwise sit on defaults forever (theme/accent/palette
    // "saved but not applied"). INITIAL_SESSION fires on subscribe if a
    // session already exists, guaranteeing a second fetch with auth ready.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        fetchPreferences();
      }
    });
    // Apply writes made by any other hook instance (theme/accent toggles
    // happen in Settings, but App's instance drives the visuals).
    const onPrefsUpdated = (e: Event) => {
      const next = (e as CustomEvent<CalendarPreferences>).detail;
      if (next) setPreferencesState(next);
    };
    window.addEventListener(PREFS_UPDATED_EVENT, onPrefsUpdated);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(PREFS_UPDATED_EVENT, onPrefsUpdated);
    };
  }, [fetchPreferences]);

  const setPreferences = async (updates: Partial<CalendarPreferences>) => {
    const userId = await resolveUserId();
    if (!userId) {
      setError('You appear to be signed out. Log out and back in, then retry.');
      return;
    }

    writeEpoch.current += 1;
    const next = { ...preferences, ...updates };
    setPreferencesState(next);
    window.dispatchEvent(new CustomEvent(PREFS_UPDATED_EVENT, { detail: next }));

    const { error: sbError } = await supabase
      .from('ck_preferences')
      .update(toDb(updates))
      .eq('user_id', userId);

    if (sbError) {
      setError(sbError.message);
    }
  };

  return { preferences, loading, error, setPreferences };
}
