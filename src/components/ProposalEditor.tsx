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
import { MonthView } from './MonthView';
import { SessionModal } from './SessionModal';
import { ProposalExport } from './ProposalExport';
import { draftSessionsToSessions, sessionPayloadToDraftSession } from '../utils/draftSessionAdapter';
import { checkOverlap } from '../utils/calendar';
import { timeToMinutes } from '../utils/date';
import { startOfMonthInTz, startOfWeekInTz, addMonthsInTz, addDaysInTz, getDayIndexInWeek, formatDateKeyInTz, formatWeekRangeInTz } from '../utils/timezone';
import type { Proposal, Session, Enrollment, Guest } from '../types';

const TIMEZONE = 'Asia/Shanghai';

const WEEKDAY_CHIPS = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 1 },
  { label: 'Wed', value: 2 },
  { label: 'Thu', value: 3 },
  { label: 'Fri', value: 4 },
  { label: 'Sat', value: 5 },
  { label: 'Sun', value: 6 },
];

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Not saved yet';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Not saved yet';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const CURRENCIES = [
  { code: 'CNY', symbol: '¥' },
  { code: 'HKD', symbol: 'HK$' },
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
];

const CURRENCY_LOCALES: Record<string, string> = {
  CNY: 'zh-CN',
  HKD: 'zh-HK',
  GBP: 'en-GB',
  USD: 'en-US',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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
  const { proposals, loading, error, updateProposal, updateProposalStatus, updateDraftSessions, commitProposal, deleteProposal } =
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
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | undefined>(undefined);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('08:00');

  const [committing, setCommitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [repeatExpanded, setRepeatExpanded] = useState(false);
  const [repeatClassId, setRepeatClassId] = useState('');
  const [repeatDays, setRepeatDays] = useState<Set<number>>(new Set());
  const [repeatStartTime, setRepeatStartTime] = useState('08:00');
  const [repeatEndTime, setRepeatEndTime] = useState('09:00');
  const [repeatEndMode, setRepeatEndMode] = useState<'weeks' | 'date'>('weeks');
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');

  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestRateInput, setGuestRateInput] = useState('');

  const [currency, setCurrency] = useState('CNY');
  const [quotedInput, setQuotedInput] = useState('');
  const [quotedTouched, setQuotedTouched] = useState(false);

  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title);
    }
  }, [proposal]);

  useEffect(() => {
    if (proposal) {
      setCurrency(proposal.currency ?? 'CNY');
      const quoted = proposal.quotedAmount;
      setQuotedTouched(quoted != null);
      setQuotedInput(quoted != null ? quoted.toFixed(2) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);

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

  const billing = useMemo(() => {
    const rows = new Map<string, { key: string; name: string; sessions: number; subtotal: number }>();

    for (const s of calendarSessions) {
      const hours = s.durationMinutes / 60;
      let key: string;
      let name: string;
      let charge: number;

      if (s.guestName) {
        key = `guest:${s.guestName}`;
        name = `${s.guestName} (guest)`;
        charge = (s.guestRate ?? 0) * hours;
      } else {
        const student = s.studentId ? students.find((st) => st.id === s.studentId) : undefined;
        key = student ? student.id : s.classId ?? 'unknown';
        name = student?.name ?? classes.find((c) => c.id === s.classId)?.name ?? 'Unknown';

        if (s.rateMode === 'flat' && s.rateValue != null) {
          charge = s.rateValue;
        } else {
          let hourly = 0;
          if (s.rateMode === 'override' && s.rateValue != null) {
            hourly = s.rateValue;
          } else if (student) {
            const enrollment = s.classId
              ? enrollments.find(
                  (e) => e.studentId === student.id && e.classId === s.classId && e.status === 'active'
                )
              : undefined;
            hourly = enrollment?.customRate ?? student.defaultRate ?? 0;
          }
          charge = hourly * hours;
        }
      }

      const row = rows.get(key) ?? { key, name, sessions: 0, subtotal: 0 };
      row.sessions += 1;
      row.subtotal += charge;
      rows.set(key, row);
    }

    const list = Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
    const total = Math.round(list.reduce((sum, r) => sum + r.subtotal, 0) * 100) / 100;
    return { rows: list, total };
  }, [calendarSessions, students, classes, enrollments]);

  const billingRows = billing.rows;
  const calculatedTotal = billing.total;
  const quotedDisplay = quotedTouched ? quotedInput : calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '';

  const anchorDate = useMemo(() => {
    const firstDate = calendarSessions.find(s => s.plannedDate)?.plannedDate;
    return firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();
  }, [calendarSessions]);

  const [weekStart, setWeekStart] = useState(() => startOfWeekInTz(anchorDate, TIMEZONE));
  const day = useMemo(() => anchorDate, [anchorDate]);

  useEffect(() => {
    setWeekStart(startOfWeekInTz(anchorDate, TIMEZONE));
  }, [anchorDate]);

  const [monthStart, setMonthStart] = useState(() => startOfMonthInTz(anchorDate, TIMEZONE));

  useEffect(() => {
    setMonthStart(startOfMonthInTz(anchorDate, TIMEZONE));
  }, [anchorDate]);

  const handleMonthChange = (offset: number) => {
    setMonthStart((prev) => addMonthsInTz(prev, offset, TIMEZONE));
  };

  const handleWeekPrev = () => {
    setWeekStart((prev) => addDaysInTz(prev, -7, TIMEZONE));
  };

  const handleWeekNext = () => {
    setWeekStart((prev) => addDaysInTz(prev, 7, TIMEZONE));
  };

  const handleWeekToday = () => {
    setWeekStart(startOfWeekInTz(new Date(), TIMEZONE));
  };

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
      studentId: payload.studentId ?? existingDraft.studentId,
      guestName: payload.guestName ?? existingDraft.guestName,
      guestRate: payload.guestRate ?? existingDraft.guestRate,
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
    if (proposal.guests.length > 0) {
      toast.error('Guest conversion not yet supported');
      return;
    }
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

  const handleDelete = async () => {
    if (!proposal) return;
    if (!window.confirm('Delete this proposal and all its draft sessions? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteProposal(proposal.id);
      navigate('/proposals');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal) return;
    const name = guestNameInput.trim();
    const rate = parseFloat(guestRateInput);
    if (!name) {
      toast.error('Guest name is required');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      toast.error('Enter a valid hourly rate');
      return;
    }
    if (proposal.guests.some((g) => g.name === name)) {
      toast.error('A guest with this name already exists');
      return;
    }

    const nextGuests: Guest[] = [...proposal.guests, { name, hourlyRate: rate }];
    await updateProposal(proposal.id, { guests: nextGuests });
    setGuestNameInput('');
    setGuestRateInput('');
    toast.success('Guest added');
  };

  const handleRemoveGuest = async (name: string) => {
    if (!proposal) return;
    const nextGuests = proposal.guests.filter((g) => g.name !== name);
    await updateProposal(proposal.id, { guests: nextGuests });
    toast.success('Guest removed');
  };

  const handleCurrencyChange = async (value: string) => {
    setCurrency(value);
    if (!proposal) return;
    try {
      await updateProposal(proposal.id, { currency: value });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save currency');
    }
  };

  const handleQuotedChange = (value: string) => {
    setQuotedTouched(true);
    setQuotedInput(value);
  };

  const handleQuotedBlur = async () => {
    if (!proposal) return;
    const trimmed = quotedInput.trim();
    const parsed = parseFloat(trimmed);
    const value = trimmed === '' || isNaN(parsed) || parsed < 0 ? null : Math.round(parsed * 100) / 100;
    try {
      await updateProposal(proposal.id, { quotedAmount: value });
      if (value == null) {
        setQuotedTouched(false);
        setQuotedInput('');
      } else {
        setQuotedInput(value.toFixed(2));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quoted amount');
    }
  };

  const handleResetQuoted = async () => {
    setQuotedTouched(false);
    setQuotedInput('');
    if (proposal && proposal.quotedAmount != null) {
      try {
        await updateProposal(proposal.id, { quotedAmount: null });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reset quoted amount');
      }
    }
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleGenerateRepeat = async () => {
    if (!proposal) return;

    if (!repeatClassId) {
      toast.error('Select a class or guest');
      return;
    }
    if (repeatDays.size === 0) {
      toast.error('Select at least one day of the week');
      return;
    }

    const startMinutes = timeToMinutes(repeatStartTime);
    const endMinutes = timeToMinutes(repeatEndTime);
    if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
      toast.error('Enter a valid start and end time');
      return;
    }
    const durationMinutes = endMinutes - startMinutes;

    const todayDate = new Date();
    const todayKey = formatDateKeyInTz(todayDate.toISOString(), TIMEZONE);

    let endKey: string;
    if (repeatEndMode === 'weeks') {
      const endDate = addDaysInTz(todayDate, repeatWeeks * 7, TIMEZONE);
      endKey = formatDateKeyInTz(endDate.toISOString(), TIMEZONE);
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(repeatUntilDate)) {
        toast.error('Enter a valid until date');
        return;
      }
      endKey = repeatUntilDate;
    }

    if (endKey < todayKey) {
      toast.error('End date must be today or later');
      return;
    }

    const repeatGuest = repeatClassId.startsWith('guest:')
      ? proposal.guests.find((g) => g.name === repeatClassId.slice(6)) ?? null
      : null;

    const existingKeys = new Set(
      calendarSessions
        .filter((s) =>
          repeatGuest ? s.guestName === repeatGuest.name : s.classId === repeatClassId
        )
        .map((s) => `${s.plannedDate}|${s.plannedTime}`)
    );

    const newDrafts: Record<string, unknown>[] = [];
    const targetDays = Array.from(repeatDays).sort();

    for (const dayIndex of targetDays) {
      let current = todayDate;
      for (let i = 0; i < 7; i++) {
        if (getDayIndexInWeek(current, TIMEZONE) === dayIndex) break;
        current = addDaysInTz(current, 1, TIMEZONE);
      }

      while (true) {
        const currentKey = formatDateKeyInTz(current.toISOString(), TIMEZONE);
        if (currentKey > endKey) break;

        if (currentKey >= todayKey) {
          const key = `${currentKey}|${repeatStartTime}`;
          if (!existingKeys.has(key)) {
            const payload: Omit<Session, 'id' | 'userId' | 'createdAt'> = {
              classId: repeatGuest ? undefined : repeatClassId,
              guestName: repeatGuest?.name,
              guestRate: repeatGuest?.hourlyRate,
              plannedDate: currentKey,
              plannedTime: repeatStartTime,
              actualDate: null,
              actualTime: null,
              durationMinutes,
              rateMode: repeatGuest ? 'override' : 'auto',
              rateValue: repeatGuest ? repeatGuest.hourlyRate : null,
              totalCharge: null,
              status: 'scheduled',
              movedFromDate: null,
              movedFromTime: null,
              notes: '',
            };
            newDrafts.push(buildDraftItem(payload));
            existingKeys.add(key);
          }
        }

        current = addDaysInTz(current, 7, TIMEZONE);
      }
    }

    if (newDrafts.length === 0) {
      toast.error('No new draft sessions to create');
      return;
    }

    await updateDraftSessions(proposal.id, [...proposal.draftSessions, ...newDrafts]);
    toast.success(`Created ${newDrafts.length} draft sessions`);
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
          <ProposalExport
            proposal={proposal}
            classes={classes}
            students={students}
            locale="en"
            currency={currency}
            calculatedTotal={calculatedTotal}
          />
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
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
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

      <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Guest students</h3>

        <form onSubmit={handleAddGuest} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={guestNameInput}
            onChange={(e) => setGuestNameInput(e.target.value)}
            placeholder="Guest name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={guestRateInput}
            onChange={(e) => setGuestRateInput(e.target.value)}
            placeholder="Hourly rate"
            className="w-full sm:w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Add guest
          </button>
        </form>

        {proposal.guests.length > 0 && (
          <ul className="space-y-2">
            {proposal.guests.map((guest) => (
              <li
                key={guest.name}
                className="flex items-center justify-between gap-3 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2"
              >
                <span>
                  {guest.name} — {formatMoney(guest.hourlyRate, currency)}/hr
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveGuest(guest.name)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-700">Billing</h3>
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {billingRows.length === 0 ? (
          <p className="text-sm text-slate-500">Add draft sessions to see the calculated total.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {billingRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span className="min-w-0">
                    {row.name}{' '}
                    <span className="text-slate-400">
                      · {row.sessions} {row.sessions === 1 ? 'session' : 'sessions'}
                    </span>
                  </span>
                  <span className="font-medium whitespace-nowrap">{formatMoney(row.subtotal, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <span className="font-medium text-slate-700">Calculated total</span>
              <span className="font-semibold text-slate-900">{formatMoney(calculatedTotal, currency)}</span>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Quoted amount <span className="font-normal text-slate-500">(manual override)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              step="0.01"
              value={quotedDisplay}
              onChange={(e) => handleQuotedChange(e.target.value)}
              onBlur={handleQuotedBlur}
              placeholder="0.00"
              className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {quotedTouched && (
              <button
                type="button"
                onClick={handleResetQuoted}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                Reset to calculated
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prefilled from the calculated total — edit for discounts or carried-over classes.
          </p>
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
              onClick={() => setCalendarView('day')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'day'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
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
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'month'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setRepeatExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-indigo-600"
          >
            <span>{repeatExpanded ? '▾' : '▸'}</span>
            Repeat weekly
          </button>

          {repeatExpanded && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Class / Guest</label>
                <select
                  value={repeatClassId}
                  onChange={(e) => setRepeatClassId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a class or guest</option>
                  <optgroup label="Classes">
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </optgroup>
                  {proposal.guests.length > 0 && (
                    <optgroup label="Guests">
                      {proposal.guests.map((guest) => (
                        <option key={guest.name} value={`guest:${guest.name}`}>
                          Guest: {guest.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Days</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_CHIPS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRepeatDay(value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        repeatDays.has(value)
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start</label>
                  <input
                    type="time"
                    value={repeatStartTime}
                    onChange={(e) => setRepeatStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End</label>
                  <input
                    type="time"
                    value={repeatEndTime}
                    onChange={(e) => setRepeatEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End condition</label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setRepeatEndMode('weeks')}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      repeatEndMode === 'weeks'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Number of weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatEndMode('date')}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      repeatEndMode === 'date'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Until date
                  </button>
                </div>

                {repeatEndMode === 'weeks' ? (
                  <input
                    type="number"
                    min={1}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <input
                    type="date"
                    value={repeatUntilDate}
                    onChange={(e) => setRepeatUntilDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerateRepeat}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                Generate
              </button>
            </div>
          )}
        </div>

        {calendarView === 'week' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWeekPrev}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={handleWeekToday}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleWeekNext}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Next →
                </button>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                {formatWeekRangeInTz(weekStart, TIMEZONE)}
              </h2>
            </div>
            <WeekView
              weekStart={weekStart}
              timezone={TIMEZONE}
              students={students}
              classes={classes}
              enrollments={enrollments}
              sessions={allCalendarSessions}
              preferences={preferences}
              onSlotClick={(dateKey) => openNewDraftModal(dateKey, preferences.calendarStartTime.slice(0, 5))}
              onSessionClick={openEditDraftModal}
            />
          </div>
        )}

        {calendarView === 'day' && (
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

        {calendarView === 'month' && (
          <MonthView
            monthStart={monthStart}
            timezone={TIMEZONE}
            students={students}
            classes={classes}
            enrollments={enrollments}
            sessions={calendarSessions}
            onMonthChange={handleMonthChange}
            onSessionClick={openEditDraftModal}
            onAddSession={(dateKey) => openNewDraftModal(dateKey, preferences.calendarStartTime.slice(0, 5))}
            inlineDetail
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
        guests={proposal.guests}
        isDraft
        onSave={handleSaveDraft}
        onUpdate={handleUpdateDraft}
        onDelete={handleDeleteDraft}
      />
    </div>
  );
}