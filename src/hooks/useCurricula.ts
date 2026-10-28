// src/hooks/useCurricula.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Curriculum } from '../types';

function fromDb(row: Record<string, unknown>): Curriculum {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    subject: (row.subject as string | undefined) ?? undefined,
    color: (row.color as string | undefined) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function toDb(curriculum: Partial<Curriculum>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (curriculum.title !== undefined) map.title = curriculum.title;
  if (curriculum.subject !== undefined) map.subject = curriculum.subject;
  if (curriculum.color !== undefined) map.color = curriculum.color;
  return map;
}

export function useCurricula() {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurricula = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_curricula')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setCurricula([]);
    } else {
      setCurricula((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCurricula();
  }, [fetchCurricula]);

  const addCurriculum = async (curriculum: Omit<Curriculum, 'id' | 'userId' | 'createdAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(curriculum),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_curricula')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newCurriculum = fromDb(data);
    setCurricula(prev => [newCurriculum, ...prev]);
    return newCurriculum;
  };

  const updateCurriculum = async (id: string, updates: Partial<Curriculum>) => {
    const { data, error: sbError } = await supabase
      .from('ck_curricula')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setCurricula(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteCurriculum = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_curricula')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setCurricula(prev => prev.filter(c => c.id !== id));
  };

  return {
    curricula,
    loading,
    error,
    fetchCurricula,
    addCurriculum,
    updateCurriculum,
    deleteCurriculum,
  };
}
