// src/components/ProposalsView.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProposals } from '../hooks/useProposals';
import type { Proposal } from '../types';

const STATUS_STYLES: Record<Proposal['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  committed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  sent: 'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatusBadge({ status }: { status: Proposal['status'] }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function SkeletonList() {
  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <li key={i} className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-1/3 bg-slate-200 rounded" />
            <div className="h-3 w-1/4 bg-slate-200 rounded" />
          </div>
          <div className="h-5 w-16 bg-slate-200 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function ProposalsView() {
  const navigate = useNavigate();
  const { proposals, loading, error, createDraft } = useProposals();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  const filteredProposals = useMemo(() => {
    if (filter === 'archived') {
      return proposals.filter(p => p.status === 'archived');
    }
    return proposals.filter(p => p.status !== 'archived');
  }, [proposals, filter]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const proposal = await createDraft();
      navigate(`/proposals/${proposal.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = (id: string) => {
    navigate(`/proposals/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Proposals</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : 'New Proposal'}
        </button>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setFilter('archived')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filter === 'archived'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Archived
        </button>
      </div>

      {loading && <SkeletonList />}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
          Error loading proposals: {error}
        </div>
      )}

      {!loading && !error && filteredProposals.length === 0 && (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          {filter === 'archived'
            ? 'No archived proposals.'
            : 'No active proposals. Click "New Proposal" to create a draft.'}
        </div>
      )}

      {!loading && !error && filteredProposals.length > 0 && (
        <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filteredProposals.map((proposal) => (
            <li key={proposal.id}>
              <button
                type="button"
                onClick={() => handleOpen(proposal.id)}
                className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {proposal.title || 'Untitled Proposal'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Created {formatDate(proposal.createdAt)}
                    {proposal.status === 'committed' && proposal.committedAt && (
                      <span className="ml-2">· Committed {formatDate(proposal.committedAt)}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={proposal.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
