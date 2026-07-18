// src/hooks/useClasses.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Class } from '../types';
import { assignColor, normalizeColor } from '../utils/colors';

function fromDb(row: Record<string, unknown>): Class {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    type: row.type as 'one-on-one' | 'group',
    maxCapacity: (row.max_capacity as number) ?? 1,
    color: (row.color as string | undefined) ?? undefined,
    textbook: (row.textbook as string) ?? '',
    currentUnit: (row.current_unit as string) ?? '',
    createdAt: row.created_at as string,
  };
}

function toDb(cls: Partial<Class>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (cls.name !== undefined) map.name = cls.name;
  if (cls.type !== undefined) map.type = cls.type;
  if (cls.maxCapacity !== undefined) map.max_capacity = cls.maxCapacity;
  if (cls.color !== undefined) map.color = cls.color;
  if (cls.textbook !== undefined) map.textbook = cls.textbook;
  if (cls.currentUnit !== undefined) map.current_unit = cls.currentUnit;
  return map;
}

export function useClasses() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setClasses([]);
    } else {
      setClasses((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const addClass = async (cls: Omit<Class, 'id' | 'userId' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // Auto-assign a color if one wasn't provided.
    const color = normalizeColor(cls.color) ?? assignColor(classes.map((c) => c.color));

    const payload = {
      ...toDb(cls),
      color,
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_classes')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newClass = fromDb(data);
    setClasses(prev => [newClass, ...prev]);
    return newClass;
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    const { data, error: sbError } = await supabase
      .from('ck_classes')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setClasses(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteClass = async (id: string) => {
    // Cascade: remove payments tied to this class's enrollments, then enrollments,
    // then sessions, then the class itself.
    const { data: classEnrollments } = await supabase
      .from('ck_enrollments')
      .select('id')
      .eq('class_id', id);

    const enrollmentIds = (classEnrollments || []).map((row) => row.id as string);

    if (enrollmentIds.length > 0) {
      const { error: paymentsError } = await supabase
        .from('ck_payments')
        .delete()
        .in('enrollment_id', enrollmentIds);
      if (paymentsError) throw new Error(paymentsError.message);

      const { error: enrollmentsError } = await supabase
        .from('ck_enrollments')
        .delete()
        .in('id', enrollmentIds);
      if (enrollmentsError) throw new Error(enrollmentsError.message);
    }

    const { error: sessionsError } = await supabase
      .from('ck_sessions')
      .delete()
      .eq('class_id', id);
    if (sessionsError) throw new Error(sessionsError.message);

    const { error: sbError } = await supabase
      .from('ck_classes')
      .delete()
      .eq('id', id);
    if (sbError) throw new Error(sbError.message);

    setClasses(prev => prev.filter(c => c.id !== id));
  };

  return {
    classes,
    loading,
    error,
    fetchClasses,
    addClass,
    updateClass,
    deleteClass,
  };
}