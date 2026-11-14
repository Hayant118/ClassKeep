// src/components/ProposalEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas-pro';
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
import { TimePicker } from './TimePicker';
import { draftSessionsToSessions, sessionPayloadToDraftSession } from '../utils/draftSessionAdapter';
import { checkOverlap } from '../utils/calendar';
import { timeToMinutes } from '../utils/date';
import { startOfMonthInTz, startOfWeekInTz, addMonthsInTz, addDaysInTz, getDayIndexInWeek, formatDateKeyInTz } from '../utils/timezone';
import type { Proposal, Session, Guest } from '../types';

const TIMEZONE = 'Asia/Shanghai';

const LOCALE_STORAGE_KEY = 'classkeep.proposalLocale';

const LABELS = {
  en: {
    back: '← Back',
    commit: 'Commit',
    committing: 'Committing...',
    archive: 'Archive',
    archiving: 'Archiving...',
    archived: 'Archived',
    delete: 'Delete',
    deleting: 'Deleting...',
    export: 'Export',
    exporting: 'Exporting...',
    titleLabel: 'Title',
    statusLabel: 'Status',
    created: 'Created',
    updated: 'Updated',
    committedOn: 'Committed',
    notSavedYet: 'Not saved yet',
    guestsHeading: 'Guest students',
    guestNamePlaceholder: 'Guest name',
    guestRatePlaceholder: 'Hourly rate',
    addGuest: 'Add guest',
    remove: 'Remove',
    perHour: '/hr',
    guestSuffix: '(guest)',
    billingHeading: 'Billing',
    billingEmpty: 'Add draft sessions to see the calculated total.',
    session: 'session',
    sessions: 'sessions',
    calculatedTotal: 'Calculated total',
    quotedLabel: 'Quoted amount',
    quotedHint: '(manual override)',
    resetQuoted: 'Reset to calculated',
    quotedHelp: 'Prefilled from the calculated total — edit for discounts or carried-over classes.',
    conflictSingular: 'draft session conflicts with the existing schedule.',
    conflictPlural: 'draft sessions conflict with the existing schedule.',
    draftSessions: (n: number) => `Draft sessions (${n})`,
    day: 'Day',
    week: 'Week',
    month: 'Month',
    repeatWeekly: 'Repeat weekly',
    repeatTarget: 'Student / Guest',
    selectStudentOrGuest: 'Select a student or guest',
    studentsGroup: 'Students (1-on-1)',
    guestsGroup: 'Guests',
    guestPrefix: 'Guest: ',
    days: 'Days',
    start: 'Start',
    end: 'End',
    endCondition: 'End condition',
    numberOfWeeks: 'Number of weeks',
    untilDate: 'Until date',
    generate: 'Generate',
    prev: '← Prev',
    today: 'Today',
    next: 'Next →',
    unknown: 'Unknown',
    status: {
      draft: 'Draft',
      committed: 'Committed',
      sent: 'Sent',
      accepted: 'Accepted',
      rejected: 'Rejected',
      archived: 'Archived',
    },
    toast: {
      guestConversionUnsupported: 'Guest conversion not yet supported',
      committed: 'Proposal committed to calendar',
      commitFailed: 'Commit failed',
      deleteConfirm: 'Delete this proposal and all its draft sessions? This cannot be undone.',
      deleteFailed: 'Delete failed',
      guestNameRequired: 'Guest name is required',
      invalidRate: 'Enter a valid hourly rate',
      guestExists: 'A guest with this name already exists',
      guestAdded: 'Guest added',
      guestRemoved: 'Guest removed',
      currencySaveFailed: 'Failed to save currency',
      quotedSaveFailed: 'Failed to save quoted amount',
      quotedResetFailed: 'Failed to reset quoted amount',
      selectStudentOrGuest: 'Select a student or guest',
      selectDay: 'Select at least one day of the week',
      invalidTime: 'Enter a valid start and end time',
      invalidUntilDate: 'Enter a valid until date',
      endDatePast: 'End date must be today or later',
      noNewDrafts: 'No new draft sessions to create',
      createdDrafts: (n: number) => `Created ${n} draft sessions`,
      exportFailed: 'Export failed',
    },
  },
  zh: {
    back: '← 返回',
    commit: '提交',
    committing: '提交中...',
    archive: '归档',
    archiving: '归档中...',
    archived: '已归档',
    delete: '删除',
    deleting: '删除中...',
    export: '导出',
    exporting: '导出中...',
    titleLabel: '标题',
    statusLabel: '状态',
    created: '创建于',
    updated: '更新于',
    committedOn: '提交于',
    notSavedYet: '尚未保存',
    guestsHeading: '学生（访客）',
    guestNamePlaceholder: '访客姓名',
    guestRatePlaceholder: '时薪',
    addGuest: '添加访客',
    remove: '移除',
    perHour: '/小时',
    guestSuffix: '（访客）',
    billingHeading: '费用',
    billingEmpty: '添加 draft 课程后可查看计算总价。',
    session: '节课',
    sessions: '节课',
    calculatedTotal: '计算总价',
    quotedLabel: '报价金额',
    quotedHint: '（手动覆盖）',
    resetQuoted: '重置为计算总价',
    quotedHelp: '预填自计算总价 — 可为折扣或结转课程修改。',
    conflictSingular: '个 draft 课程与现有日程冲突。',
    conflictPlural: '个 draft 课程与现有日程冲突。',
    draftSessions: (n: number) => `Draft 课程（${n}）`,
    day: '日',
    week: '周',
    month: '月',
    repeatWeekly: '每周重复',
    repeatTarget: '学生 / 访客',
    selectStudentOrGuest: '选择学生或访客',
    studentsGroup: '学生（1对1）',
    guestsGroup: '访客',
    guestPrefix: '访客：',
    days: '星期',
    start: '开始',
    end: '结束',
    endCondition: '结束条件',
    numberOfWeeks: '周数',
    untilDate: '截止日期',
    generate: '生成',
    prev: '← 上一周',
    today: '今天',
    next: '下一周 →',
    unknown: '未知',
    status: {
      draft: '草稿',
      committed: '已提交',
      sent: '已发送',
      accepted: '已接受',
      rejected: '已拒绝',
      archived: '已归档',
    },
    toast: {
      guestConversionUnsupported: '暂不支持访客转换',
      committed: '方案已提交到日历',
      commitFailed: '提交失败',
      deleteConfirm: '删除此方案及其所有 draft 课程？此操作无法撤销。',
      deleteFailed: '删除失败',
      guestNameRequired: '请填写访客姓名',
      invalidRate: '请输入有效的时薪',
      guestExists: '已存在同名访客',
      guestAdded: '已添加访客',
      guestRemoved: '已移除访客',
      currencySaveFailed: '保存币种失败',
      quotedSaveFailed: '保存报价金额失败',
      quotedResetFailed: '重置报价金额失败',
      selectStudentOrGuest: '请选择学生或访客',
      selectDay: '请至少选择一周中的一天',
      invalidTime: '请输入有效的开始和结束时间',
      invalidUntilDate: '请输入有效的截止日期',
      endDatePast: '结束日期不能早于今天',
      noNewDrafts: '没有可创建的新 draft 课程',
      createdDrafts: (n: number) => `已创建 ${n} 个 draft 课程`,
      exportFailed: '导出失败',
    },
  },
};

export type ProposalLocale = keyof typeof LABELS;

function readStoredLocale(): ProposalLocale {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

const WEEKDAY_CHIPS: Record<ProposalLocale, { label: string; value: number }[]> = {
  en: [
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 1 },
    { label: 'Wed', value: 2 },
    { label: 'Thu', value: 3 },
    { label: 'Fri', value: 4 },
    { label: 'Sat', value: 5 },
    { label: 'Sun', value: 6 },
  ],
  zh: [
    { label: '一', value: 0 },
    { label: '二', value: 1 },
    { label: '三', value: 2 },
    { label: '四', value: 3 },
    { label: '五', value: 4 },
    { label: '六', value: 5 },
    { label: '日', value: 6 },
  ],
};

const STATUS_STYLES: Record<Proposal['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-gray-300 dark:border-gray-600',
  committed: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  sent: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  accepted: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  archived: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-gray-400 dark:border-gray-600',
};

function StatusBadge({ status, locale }: { status: Proposal['status']; locale: ProposalLocale }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
    >
      {LABELS[locale].status[status]}
    </span>
  );
}

function formatDate(iso: string | null | undefined, locale: ProposalLocale): string {
  if (!iso) return LABELS[locale].notSavedYet;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return LABELS[locale].notSavedYet;
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Week range label in the active locale, on the display timezone's calendar. */
function formatWeekRange(weekStartUtc: Date, locale: ProposalLocale): string {
  const end = new Date(weekStartUtc.getTime() + 6 * 24 * 60 * 60 * 1000);
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  const startStr = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(weekStartUtc);
  const endStr = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(end);
  return `${startStr} - ${endStr}`;
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

function SkeletonHeader() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="h-9 w-24 bg-slate-200 dark:bg-gray-700 rounded-lg" />
      <div className="flex items-center gap-2">
        <div className="h-9 w-24 bg-slate-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-24 bg-slate-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm space-y-4 animate-pulse mt-6">
      <div className="h-10 bg-slate-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-4 w-1/3 bg-slate-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

function SkeletonCalendar() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm animate-pulse">
      <div className="h-6 w-32 bg-slate-200 dark:bg-gray-700 rounded mb-4" />
      <div className="h-96 bg-slate-100 dark:bg-gray-700 rounded-lg" />
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
  const [locale, setLocale] = useState<ProposalLocale>(readStoredLocale);
  const t = LABELS[locale];
  const handleLocaleChange = (value: ProposalLocale) => {
    setLocale(value);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      // Private mode etc. — the choice just won't persist.
    }
  };

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
  // Student-first model: repeat targets a STUDENT directly (or a guest), not a class.
  const [repeatTarget, setRepeatTarget] = useState('');
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
        name = `${s.guestName} ${t.guestSuffix}`;
        charge = (s.guestRate ?? 0) * hours;
      } else {
        const student = s.studentId ? students.find((st) => st.id === s.studentId) : undefined;
        key = student ? student.id : s.classId ?? 'unknown';
        name = student?.name ?? classes.find((c) => c.id === s.classId)?.name ?? t.unknown;

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
  }, [calendarSessions, students, classes, enrollments, t]);

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
    // Student-first: keep the direct studentId from the payload; no class resolution.
    return sessionPayloadToDraftSession(payload, {
      id: id ?? generateDraftId(),
      studentId: payload.studentId,
    }) as Record<string, unknown>;
  };

  const handleSaveDraft = async (
    payload: Omit<Session, 'id' | 'userId' | 'createdAt'> | Array<Omit<Session, 'id' | 'userId' | 'createdAt'>>
  ) => {
    if (!proposal) return;
    const items = (Array.isArray(payload) ? payload : [payload]).map((p) => buildDraftItem(p));
    const next = [...proposal.draftSessions, ...items];
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
      prepaidDeducted: payload.prepaidDeducted ?? existingDraft.prepaidDeducted,
      status: payload.status ?? existingDraft.status,
      movedFromDate: payload.movedFromDate ?? existingDraft.movedFromDate,
      movedFromTime: payload.movedFromTime ?? existingDraft.movedFromTime,
      originalPlannedDate: payload.originalPlannedDate ?? existingDraft.originalPlannedDate,
      originalPlannedTime: payload.originalPlannedTime ?? existingDraft.originalPlannedTime,
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
      toast.error(t.toast.guestConversionUnsupported);
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
        class_id: s.classId ?? null,
        student_id: s.studentId ?? null,
        guest_name: s.guestName ?? null,
        guest_rate: s.guestRate ?? null,
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
      toast.success(t.toast.committed);
      navigate('/calendar');
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : t.toast.commitFailed);
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
    if (!window.confirm(t.toast.deleteConfirm)) return;
    setDeleting(true);
    try {
      await deleteProposal(proposal.id);
      navigate('/proposals');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.toast.deleteFailed);
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
      toast.error(t.toast.guestNameRequired);
      return;
    }
    if (isNaN(rate) || rate < 0) {
      toast.error(t.toast.invalidRate);
      return;
    }
    if (proposal.guests.some((g) => g.name === name)) {
      toast.error(t.toast.guestExists);
      return;
    }

    const nextGuests: Guest[] = [...proposal.guests, { name, hourlyRate: rate }];
    await updateProposal(proposal.id, { guests: nextGuests });
    setGuestNameInput('');
    setGuestRateInput('');
    toast.success(t.toast.guestAdded);
  };

  const handleRemoveGuest = async (name: string) => {
    if (!proposal) return;
    const nextGuests = proposal.guests.filter((g) => g.name !== name);
    await updateProposal(proposal.id, { guests: nextGuests });
    toast.success(t.toast.guestRemoved);
  };

  const handleCurrencyChange = async (value: string) => {
    setCurrency(value);
    if (!proposal) return;
    try {
      await updateProposal(proposal.id, { currency: value });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.toast.currencySaveFailed);
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
      toast.error(err instanceof Error ? err.message : t.toast.quotedSaveFailed);
    }
  };

  const handleResetQuoted = async () => {
    setQuotedTouched(false);
    setQuotedInput('');
    if (proposal && proposal.quotedAmount != null) {
      try {
        await updateProposal(proposal.id, { quotedAmount: null });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.toast.quotedResetFailed);
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

    if (!repeatTarget) {
      toast.error(t.toast.selectStudentOrGuest);
      return;
    }
    if (repeatDays.size === 0) {
      toast.error(t.toast.selectDay);
      return;
    }

    const startMinutes = timeToMinutes(repeatStartTime);
    const endMinutes = timeToMinutes(repeatEndTime);
    if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
      toast.error(t.toast.invalidTime);
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
        toast.error(t.toast.invalidUntilDate);
        return;
      }
      endKey = repeatUntilDate;
    }

    if (endKey < todayKey) {
      toast.error(t.toast.endDatePast);
      return;
    }

    const repeatStudent = repeatTarget.startsWith('student:')
      ? students.find((s) => s.id === repeatTarget.slice(8)) ?? null
      : null;
    const repeatGuest = repeatTarget.startsWith('guest:')
      ? proposal.guests.find((g) => g.name === repeatTarget.slice(6)) ?? null
      : null;

    const existingKeys = new Set(
      calendarSessions
        .filter((s) =>
          repeatGuest ? s.guestName === repeatGuest.name : s.studentId === repeatStudent?.id
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
              classId: undefined,
              studentId: repeatStudent?.id,
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
              prepaidDeducted: false,
              status: 'scheduled',
              movedFromDate: null,
              movedFromTime: null,
              originalPlannedDate: null,
              originalPlannedTime: null,
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
      toast.error(t.toast.noNewDrafts);
      return;
    }

    await updateDraftSessions(proposal.id, [...proposal.draftSessions, ...newDrafts]);
    toast.success(t.toast.createdDrafts(newDrafts.length));
  };

  const handleExport = async () => {
    if (!proposal || proposal.draftSessions.length === 0) return;
    setExporting(true);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.zIndex = '-1';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const root = createRoot(container);

    try {
      flushSync(() => {
        root.render(
          <ProposalExport
            proposal={proposal}
            classes={classes}
            students={students}
            enrollments={enrollments}
            locale={locale}
            currency={currency}
            calculatedTotal={calculatedTotal}
          />
        );
      });

      const target = container.firstElementChild as HTMLElement | null;
      if (!target) throw new Error('Export target not rendered');

            await document.fonts.ready;
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#0b1120' });
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
      toast.error(err instanceof Error ? err.message : t.toast.exportFailed);
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
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm">
        Error loading proposal: {error}
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-gray-400">
        {locale === 'zh' ? '未找到方案。' : 'Proposal not found.'}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate('/proposals')}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            {locale === 'zh' ? '返回方案列表' : 'Back to proposals'}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/proposals')}
            className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            {t.back}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value as ProposalLocale)}
              aria-label="Language / 语言"
              className="min-h-[44px] rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="en">EN</option>
              <option value="zh">中文</option>
            </select>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!canCommit || committing}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? t.committing : t.commit}
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving || proposal.status === 'archived'}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {archiving ? t.archiving : proposal.status === 'archived' ? t.archived : t.archive}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? t.deleting : t.delete}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || proposal.draftSessions.length === 0 || proposal.status === 'archived'}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? t.exporting : t.export}
            </button>
          </div>
        </div>

        {commitError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm">
            {t.toast.commitFailed}: {commitError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm space-y-4 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">{t.titleLabel}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-lg font-semibold text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">{t.statusLabel}</label>
              <select
                value={proposal.status}
                onChange={(e) => handleStatusChange(e.target.value as Proposal['status'])}
                className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="draft">{t.status.draft}</option>
                <option value="committed">{t.status.committed}</option>
                <option value="sent">{t.status.sent}</option>
                <option value="accepted">{t.status.accepted}</option>
                <option value="rejected">{t.status.rejected}</option>
                <option value="archived">{t.status.archived}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-100 dark:border-gray-700">
            <StatusBadge status={proposal.status} locale={locale} />
            <span>{t.created} {formatDate(proposal.createdAt, locale)}</span>
            <span>·</span>
            <span>{t.updated} {formatDate(proposal.updatedAt, locale)}</span>
            {proposal.committedAt && (
              <>
                <span>·</span>
                <span>{t.committedOn} {formatDate(proposal.committedAt, locale)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">{t.guestsHeading}</h3>

        <form onSubmit={handleAddGuest} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={guestNameInput}
            onChange={(e) => setGuestNameInput(e.target.value)}
            placeholder={t.guestNamePlaceholder}
            className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={guestRateInput}
            onChange={(e) => setGuestRateInput(e.target.value)}
            placeholder={t.guestRatePlaceholder}
            className="w-full sm:w-40 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            {t.addGuest}
          </button>
        </form>

        {proposal.guests.length > 0 && (
          <ul className="space-y-2">
            {proposal.guests.map((guest) => (
              <li
                key={guest.name}
                className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-gray-900/50 rounded-lg px-3 py-2"
              >
                <span>
                  {guest.name} — {formatMoney(guest.hourlyRate, currency)}{t.perHour}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveGuest(guest.name)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">{t.billingHeading}</h3>
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {billingRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-400">{t.billingEmpty}</p>
        ) : (
          <>
            <ul className="space-y-1">
              {billingRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-gray-300">
                  <span className="min-w-0">
                    {row.name}{' '}
                    <span className="text-slate-400 dark:text-gray-500">
                      · {row.sessions} {row.sessions === 1 ? t.session : t.sessions}
                    </span>
                  </span>
                  <span className="font-medium whitespace-nowrap">{formatMoney(row.subtotal, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-700 pt-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-gray-300">{t.calculatedTotal}</span>
              <span className="font-semibold text-slate-900 dark:text-gray-100">{formatMoney(calculatedTotal, currency)}</span>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
            {t.quotedLabel} <span className="font-normal text-slate-500 dark:text-gray-400">{t.quotedHint}</span>
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
              className="w-full sm:w-48 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {quotedTouched && (
              <button
                type="button"
                onClick={handleResetQuoted}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 whitespace-nowrap"
              >
                {t.resetQuoted}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            {t.quotedHelp}
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
          {conflictCount} {conflictCount === 1 ? t.conflictSingular : t.conflictPlural}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">
            {t.draftSessions(proposal.draftSessions.length)}
          </h3>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setCalendarView('day')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'day'
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100'
              }`}
            >
              {t.day}
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'week'
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100'
              }`}
            >
              {t.week}
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                calendarView === 'month'
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100'
              }`}
            >
              {t.month}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-gray-700 pt-3">
          <button
            type="button"
            onClick={() => setRepeatExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <span>{repeatExpanded ? '▾' : '▸'}</span>
            {t.repeatWeekly}
          </button>

          {repeatExpanded && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">{t.repeatTarget}</label>
                <select
                  value={repeatTarget}
                  onChange={(e) => setRepeatTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t.selectStudentOrGuest}</option>
                  <optgroup label={t.studentsGroup}>
                    {students.map((student) => (
                      <option key={student.id} value={`student:${student.id}`}>
                        {student.name}
                      </option>
                    ))}
                  </optgroup>
                  {proposal.guests.length > 0 && (
                    <optgroup label={t.guestsGroup}>
                      {proposal.guests.map((guest) => (
                        <option key={guest.name} value={`guest:${guest.name}`}>
                          {t.guestPrefix}{guest.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">{t.days}</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_CHIPS[locale].map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRepeatDay(value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        repeatDays.has(value)
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                          : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">{t.start}</label>
                  <TimePicker
                    value={repeatStartTime}
                    onChange={setRepeatStartTime}
                    className="w-full"
                    aria-label={t.start}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">{t.end}</label>
                  <TimePicker
                    value={repeatEndTime}
                    onChange={setRepeatEndTime}
                    className="w-full"
                    aria-label={t.end}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">{t.endCondition}</label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setRepeatEndMode('weeks')}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      repeatEndMode === 'weeks'
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.numberOfWeeks}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatEndMode('date')}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      repeatEndMode === 'date'
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.untilDate}
                  </button>
                </div>

                {repeatEndMode === 'weeks' ? (
                  <input
                    type="number"
                    min={1}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <input
                    type="date"
                    value={repeatUntilDate}
                    onChange={(e) => setRepeatUntilDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerateRepeat}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                {t.generate}
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
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  {t.prev}
                </button>
                <button
                  type="button"
                  onClick={handleWeekToday}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  {t.today}
                </button>
                <button
                  type="button"
                  onClick={handleWeekNext}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  {t.next}
                </button>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                {formatWeekRange(weekStart, locale)}
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
            onDeleteSession={handleDeleteDraft}
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