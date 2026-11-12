// src/hooks/usePayments.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Payment } from '../types';

function fromDb(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    enrollmentId: (row.enrollment_id as string) ?? '',
    studentId: (row.student_id as string | null | undefined) ?? null,
    amount: (row.amount as number) ?? 0,
    paymentDate: (row.payment_date as string) ?? new Date().toISOString().split('T')[0],
    paymentMethod: (row.payment_method as string) ?? '',
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  };
}

function toDb(payment: Partial<Payment>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (payment.enrollmentId !== undefined) map.enrollment_id = payment.enrollmentId || null;
  if (payment.studentId !== undefined) map.student_id = payment.studentId;
  if (payment.amount !== undefined) map.amount = payment.amount;
  if (payment.paymentDate !== undefined) map.payment_date = payment.paymentDate;
  if (payment.paymentMethod !== undefined) map.payment_method = payment.paymentMethod;
  if (payment.notes !== undefined) map.notes = payment.notes;
  return map;
}

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async (enrollmentIds?: string[], studentId?: string) => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('ck_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    // Student-level payments (enrollment_id null, e.g. prepaid top-ups) need a
    // separate filter branch; an OR combines both scopes. Guard empty arrays
    // and blank ids first — an empty .in() or malformed .or() silently
    // matches zero rows.
    const enrollmentFilter = (enrollmentIds ?? []).filter((enrollmentId) => Boolean(enrollmentId));
    const studentFilter = studentId?.trim();
    const filters: string[] = [];
    if (enrollmentFilter.length > 0) {
      filters.push(`enrollment_id.in.(${enrollmentFilter.join(',')})`);
    }
    if (studentFilter) {
      filters.push(`student_id.eq.${studentFilter}`);
    }
    if (filters.length > 0) {
      query = query.or(filters.join(','));
    }

    const { data, error: sbError } = await query;

    if (sbError) {
      setError(sbError.message);
      setPayments([]);
    } else {
      setPayments((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  const insertPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(payment),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_payments')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newPayment = fromDb(data);
    setPayments((prev) => [newPayment, ...prev]);
    return newPayment;
  };

  const updateBalance = async (enrollmentId: string, newBalance: number) => {
    const { error: sbError } = await supabase
      .from('ck_enrollments')
      .update({ prepaid_balance: newBalance })
      .eq('id', enrollmentId);

    if (sbError) throw new Error(sbError.message);
  };

  const deletePayment = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_payments')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  return {
    payments,
    loading,
    error,
    fetchPayments,
    insertPayment,
    updateBalance,
    deletePayment,
  };
}
