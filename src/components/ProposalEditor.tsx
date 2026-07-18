// src/components/ProposalEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useProposals } from '../hooks/useProposals';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { useEnrollments } from '../hooks/useEnrollments';
import { useSessions } from '../hooks/useSessions';
import { usePreferences } from '../hooks/usePreferences';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { SessionModal } from './SessionModal';
import { ProposalExport } from './ProposalExport';
import { draftSessionsToSessions, sessionPayloadToDraftSession } from '../utils/draftSessionAdapter';
import { checkOverlap } from '../utils/calendar';
import type { Proposal, Session, Enrollment } from '../types';

const TIMEZONE = 'Asia/Shanghai';

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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getPrimaryStudentId(
  classId: string | undefined,
  studentId: string | undefined,
  enrollments: Enrollment[]
): string | undefined {
  if (studentId) return studentId;
  if (!classId) return undefined;
  const enrollment = enrollments.find(e => e.classId === classId && e.status === 'active');
  return enrollment?.studentId;
}

function SkeletonHeader() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="h-9 w-24 bg-slate-200 rounded-lg" />
      <div className="flex items-center gap-2">
        <div className="h-9 w-24 bg-slate-200 rounded-lg" />
        <div className="h-9 w-24 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 animate-pulse mt-6">
      <div className="h-10 bg-slate-200 rounded-lg" />
      <div className="h-4 w-1/3 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonCalendar() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
      <div className="h-6 w-32 bg-slate-200 rounded mb-4" />
      <div className="h-96 bg-slate-100 rounded-lg" />
    </div>
  );
}

export function ProposalEditor() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { proposals, loading, error, updateProposal, updateProposalStatus, updateDraftSessions, commitProposal } =
    useProposals();
  const { students } = useStudents();
  const { classes } = useClasses();
  const { enrollments } = useEnrollments();
  const { sessions: realSessions } = useSessions();
  const { preferences, loading: prefsLoading } = usePreferences();

  const proposal = useMemo(
    () => proposals.find(p => p.id === proposalId) ?? null,
    [proposals, proposalId]
  );

  const [title, setTitle] = useState('');
  const [calendarView, setCalendarView] = useState<'week' | 'day'>('week');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | undefined>(undefined);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('08:00');

  const [committing, setCommitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title);
    }
  }, [proposal]);

  const calendarSessions = useMemo(
    () =>
      draftSessionsToSessions(proposal?.draftSessions ?? [], {
        proposalId: proposal?.id,
        userId: proposal?.userId,
      }),
    [proposal]
  );

  const draftSessionIds = useMemo(
    () => new Set(calendarSessions.map(s => s.id)),
    [calendarSessions]
  );

  const allCalendarSessions = useMemo<Session[]>(
    () => [...realSessions, ...calendarSessions],
    [realSessions, calendarSessions]
  );

  const overlapIds = useMemo(() => checkOverlap(allCalendarSessions), [allCalendarSessions]);

  const conflictCount = useMemo(
    () => calendarSessions.filter(s => overlapIds.has(s.id)).length,
    [calendarSessions, overlapIds]
  );

  const anchorDate = useMemo(() => {
    const firstDate = calendarSessions.find(s => s.plannedDate)?.plannedDate;
    return firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();
  }, [calendarSessions]);

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);
  const day = useMemo(() => anchorDate, [anchorDate]);

  const handleTitleBlur = async () => {
    if (!proposal || title === proposal.title) return;
    await updateProposal(proposal.id, { title });
  };

  const handleStatusChange = async (status: Proposal['status']) => {
    if (!proposal) return;
    await updateProposalStatus(proposal.id, status);
  };

  const openNewDraftModal = (dateKey: string, time: string) => {
    setEditingSession(undefined);
    setModalDate(dateKey);
    setModalTime(time);
    setIsModalOpen(true);
  };

  const openEditDraftModal = (session: Session) => {
    if (!draftSessionIds.has(session.id)) return;
    setEditingSession(session);
    setModalDate(session.plannedDate);
    setModalTime(session.plannedTime);
    setIsModalOpen(true);
  };

  const buildDraftItem = (
    payload: Omit<Session, 'id' | 'userId' | 'createdAt'>,
    id?: string
  ): Record<string, unknown> => {
    const studentId = getPrimaryStudentId(payload.classId, payload.studentId, enrollments);
    return sessionPayloadToDraftSession(payload, { id: id ?? generateDraftId(), studentId }) as Record<
      string,
      unknown
    >;
  };

  const handleSaveDraft = async (payload: Omit<Session, 'id' | 'userId' | 'createdAt'>) => {
    if (!proposal) return;
    const next = [...proposal.draftSessions, buildDraftItem(payload)];
    await updateDraftSessions(proposal.id, next);
    setIsModalOpen(false);
  };

  const handleUpdateDraft = async (id: string, payload: Partial<Session>) => {
    if (!proposal) return;
    const index = proposal.draftSessions.findIndex((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      return (raw.id as string | undefined) === id;
    });
    if (index === -1) return;

    const existing = proposal.draftSessions[index];
    const existingDraft = draftSessionsToSessions([existing], { proposalId: proposal.id, userId: proposal.userId })[0];
    const merged: Omit<Session, 'id' | 'userId' | 'createdAt'> = {
      classId: payload.classId ?? existingDraft.classId,
      plannedDate: payload.plannedDate ?? existingDraft.plannedDate,
      plannedTime: payload.plannedTime ?? existingDraft.plannedTime,
      actualDate: payload.actualDate ?? existingDraft.actualDate,
      actualTime: payload.actualTime ?? existingDraft.actualTime,
      durationMinutes: payload.durationMinutes ?? existingDraft.durationMinutes,
      rateMode: payload.rateMode ?? existingDraft.rateMode,
      rateValue: payload.rateValue ?? existingDraft.rateValue,
      totalCharge: payload.totalCharge ?? existingDraft.totalCharge,
      status: payload.status ?? existingDraft.status,
      movedFromDate: payload.movedFromDate ?? existingDraft.movedFromDate,
      movedFromTime: payload.movedFromTime ?? existingDraft.movedFromTime,
      notes: payload.notes ?? existingDraft.notes,
    };

    const next = [...proposal.draftSessions];
    next[index] = buildDraftItem(merged, id);
    await updateDraftSessions(proposal.id, next);
    setIsModalOpen(false);
  };

  const handleDeleteDraft = async (id: string) => {
    if (!proposal) return;
    const next = proposal.draftSessions.filter((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      return (raw.id as string | undefined) !== id;
    });
    await updateDraftSessions(proposal.id, next);
    setIsModalOpen(false);
  };

  const handleCommit = async () => {
    if (!proposal || proposal.draftSessions.length === 0) return;
    setCommitting(true);
    setCommitError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const sessionsToInsert = draftSessionsToSessions(proposal.draftSessions, {
        proposalId: proposal.id,
        userId: proposal.userId,
      });

      const rows = sessionsToInsert.map((s) => ({
        user_id: userData.user.id,
        class_id: s.classId,
        planned_date: s.plannedDate,
        planned_time: s.plannedTime,
        actual_date: null as string | null,
        actual_time: null as string | null,
        duration_minutes: s.durationMinutes,
        rate_mode: s.rateMode,
        rate_value: s.rateValue,
        total_charge: null as number | null,
        status: 'scheduled' as const,
        moved_from_date: null as string | null,
        moved_from_time: null as string | null,
        notes: s.notes,
      }));

      const { error: insertError } = await supabase.from('ck_sessions').insert(rows);
      if (insertError) throw new Error(insertError.message);

      await commitProposal(proposal.id);
      toast.success('Proposal committed to calendar');
      navigate('/calendar');
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleArchive = async () => {
    if (!proposal) return;
    setArchiving(true);
    await updateProposalStatus(proposal.id, 'archived');
    setArchiving(false);
    navigate('/proposals');
  };

  const handleExport = async () => {
    if (!proposal || proposal.draftSessions.length === 0) return;
    setExporting(true);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const root = createRoot(container);

    try {
      flushSync(() => {
        root.render(
          <ProposalExport proposal={proposal} classes={classes} students={students} locale="en" />
        );
      });

      const target = container.firstElementChild as HTMLElement | null;
      if (!target) throw new Error('Export target not rendered');

      const canvas = await html2canvas(target, { scale: 2, backgroundColor: null });
      const dataUrl = canvas.toDataURL('image/png');

      const safeTitle = proposal.title
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Proposal';
      const date = new Date().toISOString().split('T')[0];

      const link = document.createElement('a');
      link.download = `Proposal_${safeTitle}_${date}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      root.unmount();
      container.remove();
      setExporting(false);
    }
  };

  if (loading || prefsLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCalendar />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
        Error loading proposal: {error}
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 text-center text-slate-500">
        Proposal not found.
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate('/proposals')}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to proposals
          </button>
        </div>
      </div>
    );
  }

  const canCommit =
    proposal.draftSessions.length > 0 &&
    proposal.status !== 'committed' &&
    proposal.status !== 'archived';

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/proposals')}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCommit}
              disabled={!canCommit || committing}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? 'Committing...' : 'Commit'}
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving || proposal.status === 'archived'}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {archiving ? 'Archiving...' : proposal.status === 'archived' ? 'Archived' : 'Archive'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || proposal.draftSessions.length === 0 || proposal.status === 'archived'}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {commitError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            Commit failed: {commitError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 mt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={proposal.status}
                onChange={(e) => handleStatusChange(e.target.value as Proposal['status'])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="draft">Draft</option>
                <option value="committed">Committed</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <StatusBadge status={proposal.status} />
            <span>Created {formatDate(proposal.createdAt)}</span>
            <span>·</span>
            <span>Updated {formatDate(proposal.updatedAt)}</span>
            {proposal.committedAt && (
              <>
                <span>·</span>
                <span>Committed {formatDate(proposal.committedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {conflictCount > 0 && (
        <div
          className="max-w-4xl mx-auto p-3 rounded-lg text-sm font-medium border"
          style={{
            backgroundColor: `${preferences.colorConflict}15`,
            borderColor: preferences.colorConflict,
            color: preferences.colorConflict,
          }}
        >
          {conflictCount} draft {conflictCount === 1 ? 'session' : 'sessions'} conflict with the existing schedule.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Draft sessions ({proposal.draftSessions.length})
          </h3>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'week'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('day')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'day'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {calendarView === 'week' ? (
          <WeekView
            weekStart={weekStart}
            timezone={TIMEZONE}
            students={students}
            classes={classes}
            enrollments={enrollments}
            sessions={allCalendarSessions}
            preferences={preferences}
            onSlotClick={openNewDraftModal}
            onSessionClick={openEditDraftModal}
          />
        ) : (
          <DayView
            day={day}
            timezone={TIMEZONE}
            students={students}
            classes={classes}
            enrollments={enrollments}
            sessions={allCalendarSessions}
            preferences={preferences}
            onSlotClick={openNewDraftModal}
            onSessionClick={openEditDraftModal}
          />
        )}
      </div>

      <SessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        session={editingSession}
        initialDate={modalDate}
        initialTime={modalTime}
        initialTimezone={TIMEZONE}
        students={students}
        classes={classes}
        isDraft
        onSave={handleSaveDraft}
        onUpdate={handleUpdateDraft}
        onDelete={handleDeleteDraft}
      />
    </div>
  );
}
