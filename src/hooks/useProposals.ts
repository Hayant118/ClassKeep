// src/hooks/useProposals.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Proposal } from '../types';

function fromDb(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: (row.title as string) ?? 'Untitled Proposal',
    status: (row.status as Proposal['status']) ?? 'draft',
    draftSessions: Array.isArray(row.draft_sessions) ? (row.draft_sessions as Record<string, unknown>[]) : [],
    committedAt: (row.committed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDb(p: Partial<Proposal>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (p.title !== undefined) map.title = p.title;
  if (p.status !== undefined) map.status = p.status;
  if (p.draftSessions !== undefined) map.draft_sessions = p.draftSessions;
  if (p.committedAt !== undefined) map.committed_at = p.committedAt;
  return map;
}

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setProposals([]);
    } else {
      setProposals((data || []).map(fromDb));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const addProposal = async (proposal: Omit<Proposal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...toDb(proposal),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_proposals')
      .insert(payload)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const newProposal = fromDb(data);
    setProposals(prev => [newProposal, ...prev]);
    return newProposal;
  };

  const createDraft = async (title = 'Untitled Proposal') => {
    return addProposal({
      title,
      status: 'draft',
      draftSessions: [],
      committedAt: null,
    });
  };

  const updateProposal = async (id: string, updates: Partial<Proposal>) => {
    const { data, error: sbError } = await supabase
      .from('ck_proposals')
      .update(toDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = fromDb(data);
    setProposals(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  };

  const updateProposalStatus = async (id: string, status: Proposal['status']) => {
    return updateProposal(id, { status });
  };

  const updateDraftSessions = async (id: string, draftSessions: Record<string, unknown>[]) => {
    return updateProposal(id, { draftSessions });
  };

  const commitProposal = async (id: string) => {
    return updateProposal(id, {
      status: 'committed',
      committedAt: new Date().toISOString(),
    });
  };

  const deleteProposal = async (id: string) => {
    const { error: sbError } = await supabase.from('ck_proposals').delete().eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setProposals(prev => prev.filter(p => p.id !== id));
  };

  return {
    proposals,
    loading,
    error,
    fetchProposals,
    addProposal,
    createDraft,
    updateProposal,
    updateProposalStatus,
    updateDraftSessions,
    commitProposal,
    deleteProposal,
  };
}
