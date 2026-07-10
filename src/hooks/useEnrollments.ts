// src/hooks/useEnrollments.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Enrollment } from '../types';

function fromDb(row: Record<string, unknown>): Enrollment {
  return {
    id: row.id as string,
    studentId: (row.student_id as string) ?? '',
    classId: (row.class_id as string) ?? '',
    joinedAt: (row.joined_at as string) ?? new Date().toISOString().split('T')[0],
    leftAt: (row.left_at as string | null) ?? null,
    customRate: (row.custom_rate as number | null) ?? null,
    paymentType: (row.payment_type as Enrollment['paymentType']) ?? 'monthly_advance',
    prepaidBalance: (row.prepaid_balance as number | null) ?? 0,
    status: row.status as 'active' | 'paused' | 'dropped',
    createdAt: row.created_at as string,
  };
}

function toDb(en: Partial<Enrollment>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (en.studentId !== undefined) map.student_id = en.studentId;
  if (en.classId !== undefined) map.class_id = en.classId;
  if (en.joinedAt !== undefined) map.joined_at = en.joinedAt;
  if (en.leftAt !== undefined) map.left_at = en.leftAt;
  if (en.customRate !== undefined) map.custom_rate = en.customRate;
  if (en.paymentType !== undefined) map.payment_type = en.paymentType;
  if (en.prepaidBalance !== undefined) map.prepaid_balance = en.prepaidBalance;
  if (en.status !== undefined) map.status = en.status;
  return map;
}

export function useEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_enrollments')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setEnrollments([]);
    } else {
      setEnrollments((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const addEnrollment = async (en: Omit<Enrollment, 'id' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(en),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_enrollments')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newEn = fromDb(data);
    setEnrollments(prev => [newEn, ...prev]);
    return newEn;
  };

  const updateEnrollment = async (id: string, updates: Partial<Enrollment>) => {
    const { data, error: sbError } = await supabase
      .from('ck_enrollments')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setEnrollments(prev => prev.map(e => (e.id === id ? updated : e)));
    return updated;
  };

  const deleteEnrollment = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_enrollments')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setEnrollments(prev => prev.filter(e => e.id !== id));
  };

  return {
    enrollments,
    loading,
    error,
    fetchEnrollments,
    addEnrollment,
    updateEnrollment,
    deleteEnrollment,
  };
}