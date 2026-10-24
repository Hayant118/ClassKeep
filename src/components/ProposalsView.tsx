// src/components/ProposalsView.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useProposals } from '../hooks/useProposals';
import type { Proposal } from '../types';

const STATUS_STYLES: Record<Proposal['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-gray-300 dark:border-gray-600',
  committed: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  sent: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  accepted: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  archived: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-gray-400 dark:border-gray-600',
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
    <ul className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <li key={i} className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-1/3 bg-slate-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-1/4 bg-slate-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-5 w-16 bg-slate-200 dark:bg-gray-700 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function ProposalsView() {
  const navigate = useNavigate();
  const { proposals, loading, error, createDraft, deleteProposal } = useProposals();
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this proposal? This cannot be undone.')) return;
    try {
      await deleteProposal(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete proposal');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Proposals</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : 'New Proposal'}
        </button>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 p-1 rounded-lg self-start">
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setFilter('archived')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filter === 'archived'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100'
          }`}
        >
          Archived
        </button>
      </div>

      {loading && <SkeletonList />}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm">
          Error loading proposals: {error}
        </div>
      )}

      {!loading && !error && filteredProposals.length === 0 && (
        <div className="p-8 text-center text-slate-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
          {filter === 'archived'
            ? 'No archived proposals.'
            : 'No active proposals. Click "New Proposal" to create a draft.'}
        </div>
      )}

      {!loading && !error && filteredProposals.length > 0 && (
        <ul className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700">
          {filteredProposals.map((proposal) => (
            <li key={proposal.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
              <button
                type="button"
                onClick={() => handleOpen(proposal.id)}
                className="flex-1 min-w-0 text-left flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-gray-100 truncate">
                    {proposal.title || 'Untitled Proposal'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    Created {formatDate(proposal.createdAt)}
                    {proposal.status === 'committed' && proposal.committedAt && (
                      <span className="ml-2">· Committed {formatDate(proposal.committedAt)}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={proposal.status} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(proposal.id)}
                className="p-2 rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                aria-label="Delete proposal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
