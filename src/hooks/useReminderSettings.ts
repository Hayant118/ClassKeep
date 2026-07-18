// src/hooks/useReminderSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ReminderSettings } from '../types';

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  id: '',
  userId: '',
  preClassEnabled: true,
  preClassMinutes: 30,
  lowBalanceEnabled: true,
  lowBalanceThreshold: 400,
  unreviewedEnabled: true,
  dailyDigestEnabled: true,
  dailyDigestTime: '08:00',
  browserNotificationsEnabled: false,
  updatedAt: new Date().toISOString(),
};

function fromDb(row: Record<string, unknown>): ReminderSettings {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    preClassEnabled: (row.pre_class_enabled as boolean) ?? true,
    preClassMinutes: (row.pre_class_minutes as number) ?? 30,
    lowBalanceEnabled: (row.low_balance_enabled as boolean) ?? true,
    lowBalanceThreshold: (row.low_balance_threshold as number) ?? 400,
    unreviewedEnabled: (row.unreviewed_enabled as boolean) ?? true,
    dailyDigestEnabled: (row.daily_digest_enabled as boolean) ?? true,
    dailyDigestTime: (row.daily_digest_time as string) ?? '08:00',
    browserNotificationsEnabled: (row.browser_notifications_enabled as boolean) ?? false,
    updatedAt: row.updated_at as string,
  };
}

function toDb(settings: Partial<ReminderSettings>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (settings.preClassEnabled !== undefined) map.pre_class_enabled = settings.preClassEnabled;
  if (settings.preClassMinutes !== undefined) map.pre_class_minutes = settings.preClassMinutes;
  if (settings.lowBalanceEnabled !== undefined) map.low_balance_enabled = settings.lowBalanceEnabled;
  if (settings.lowBalanceThreshold !== undefined) map.low_balance_threshold = settings.lowBalanceThreshold;
  if (settings.unreviewedEnabled !== undefined) map.unreviewed_enabled = settings.unreviewedEnabled;
  if (settings.dailyDigestEnabled !== undefined) map.daily_digest_enabled = settings.dailyDigestEnabled;
  if (settings.dailyDigestTime !== undefined) map.daily_digest_time = settings.dailyDigestTime;
  if (settings.browserNotificationsEnabled !== undefined) map.browser_notifications_enabled = settings.browserNotificationsEnabled;
  return map;
}

export function useReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error: sbError } = await supabase
      .from('ck_reminder_settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    if (sbError && sbError.code !== 'PGRST116') {
      setError(sbError.message);
    } else if (data) {
      setSettings(fromDb(data));
    } else {
      const payload = {
        user_id: userData.user.id,
        pre_class_enabled: DEFAULT_REMINDER_SETTINGS.preClassEnabled,
        pre_class_minutes: DEFAULT_REMINDER_SETTINGS.preClassMinutes,
        low_balance_enabled: DEFAULT_REMINDER_SETTINGS.lowBalanceEnabled,
        low_balance_threshold: DEFAULT_REMINDER_SETTINGS.lowBalanceThreshold,
        unreviewed_enabled: DEFAULT_REMINDER_SETTINGS.unreviewedEnabled,
        daily_digest_enabled: DEFAULT_REMINDER_SETTINGS.dailyDigestEnabled,
        daily_digest_time: DEFAULT_REMINDER_SETTINGS.dailyDigestTime,
        browser_notifications_enabled: DEFAULT_REMINDER_SETTINGS.browserNotificationsEnabled,
      };

      const { data: newData, error: insertError } = await supabase
        .from('ck_reminder_settings')
        .insert(payload)
        .select()
        .single();

      if (!insertError && newData) {
        setSettings(fromDb(newData));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<ReminderSettings>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const next = { ...settings, ...updates };
    setSettings(next);

    const { error: sbError } = await supabase
      .from('ck_reminder_settings')
      .update(toDb(updates))
      .eq('user_id', userData.user.id);

    if (sbError) {
      setError(sbError.message);
    }
  };

  return { settings, loading, error, updateSettings };
}
