// src/hooks/useReminders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Reminder } from '../types';

function fromDb(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as Reminder['type'],
    reference_id: (row.reference_id as string | undefined) ?? undefined,
    title: row.title as string,
    body: (row.body as string | undefined) ?? undefined,
    scheduled_at: (row.scheduled_at as string | undefined) ?? undefined,
    dismissed_at: (row.dismissed_at as string | undefined) ?? undefined,
    created_at: row.created_at as string,
  };
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<Reminder[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setReminders([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('ck_reminders')
      .select('*')
      .eq('user_id', userData.user.id)
      .is('dismissed_at', null)
      .order('scheduled_at', { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ClassKeep] Failed to fetch reminders:', error);
      setReminders([]);
      setUnreadCount(0);
    } else {
      const items = (data || []).map(fromDb);
      setReminders(items);
      setUnreadCount(items.length);
    }

    setLoading(false);
  }, []);

  const fetchReminderHistory = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setHistory([]);
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('ck_reminders')
      .select('*')
      .eq('user_id', userData.user.id)
      .not('dismissed_at', 'is', null)
      .gte('dismissed_at', thirtyDaysAgo.toISOString())
      .order('dismissed_at', { ascending: false });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ClassKeep] Failed to fetch reminder history:', error);
      setHistory([]);
    } else {
      setHistory((data || []).map(fromDb));
    }
  }, []);

  const createReminder = useCallback(async (reminder: Omit<Reminder, 'id' | 'created_at'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from('ck_reminders').insert({
      user_id: userData.user.id,
      type: reminder.type,
      reference_id: reminder.reference_id,
      title: reminder.title,
      body: reminder.body,
      scheduled_at: reminder.scheduled_at,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ClassKeep] Failed to create reminder:', error);
    }
  }, []);

  const dismissReminder = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('ck_reminders')
        .update({ dismissed_at: now })
        .eq('id', id);

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[ClassKeep] Failed to dismiss reminder:', error);
      } else {
        await fetchReminders();
        await fetchReminderHistory();
      }
    },
    [fetchReminders, fetchReminderHistory]
  );

  const dismissAll = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('ck_reminders')
      .update({ dismissed_at: now })
      .eq('user_id', userData.user.id)
      .is('dismissed_at', null);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ClassKeep] Failed to dismiss all reminders:', error);
    } else {
      await fetchReminders();
      await fetchReminderHistory();
    }
  }, [fetchReminders, fetchReminderHistory]);

  const getUnreadCount = useCallback(async () => {
    await fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    fetchReminders();
    fetchReminderHistory();
  }, [fetchReminders, fetchReminderHistory]);

  return {
    reminders,
    history,
    unreadCount,
    loading,
    fetchReminders,
    fetchReminderHistory,
    createReminder,
    dismissReminder,
    dismissAll,
    getUnreadCount,
  };
}
