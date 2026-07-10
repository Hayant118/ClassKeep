// src/hooks/useStudents.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Student } from '../types';

function fromDb(row: Record<string, unknown>): Student {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    contact: (row.contact as string) ?? '',
    defaultRate: (row.default_rate as number) ?? 0,
    timezone: (row.timezone as string) ?? 'Asia/Shanghai',
    color: (row.color as string | undefined) ?? undefined,
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  };
}

function toDb(student: Partial<Student>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (student.name !== undefined) map.name = student.name;
  if (student.contact !== undefined) map.contact = student.contact;
  if (student.defaultRate !== undefined) map.default_rate = student.defaultRate;
  if (student.timezone !== undefined) map.timezone = student.timezone;
  if (student.color !== undefined) map.color = student.color;
  if (student.notes !== undefined) map.notes = student.notes;
  return map;
}

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_students')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setStudents([]);
    } else {
      setStudents((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const addStudent = async (student: Omit<Student, 'id' | 'userId' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(student),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_students')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    setStudents(prev => [fromDb(data), ...prev]);
    return fromDb(data);
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const { data, error: sbError } = await supabase
      .from('ck_students')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setStudents(prev => prev.map(s => (s.id === id ? updated : s)));
    return updated;
  };

  const deleteStudent = async (id: string) => {
    const { error: sbError } = await supabase.from('ck_students').delete().eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return {
    students,
    loading,
    error,
    fetchStudents,
    addStudent,
    updateStudent,
    deleteStudent,
  };
}