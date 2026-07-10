// src/components/HomeView.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions';
import { useProposals } from '../hooks/useProposals';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatToday(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function HomeView() {
  const navigate = useNavigate();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { proposals, loading: proposalsLoading } = useProposals();

  const today = todayStr();

  const todaysSessionsCount = useMemo(
    () => sessions.filter((s) => s.plannedDate === today).length,
    [sessions, today]
  );

  const pendingProposalsCount = useMemo(
    () => proposals.filter((p) => p.status === 'draft').length,
    [proposals]
  );

  const isLoading = sessionsLoading || proposalsLoading;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-indigo-600 tracking-tight">ClassKeep</h1>
          <p className="text-slate-500">{formatToday(today)}</p>
        </div>

        {isLoading ? (
          <div className="text-slate-400 text-sm">Loading dashboard...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-indigo-700">{todaysSessionsCount}</div>
              <div className="text-sm text-indigo-600 mt-1">Session{todaysSessionsCount !== 1 ? 's' : ''} today</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-amber-700">{pendingProposalsCount}</div>
              <div className="text-sm text-amber-600 mt-1">
                Pending proposal{pendingProposalsCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => navigate('/calendar')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Go to Calendar
          </button>
          <button
            onClick={() => navigate('/students')}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Go to Students
          </button>
        </div>
      </div>
    </div>
  );
}
