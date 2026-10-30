// src/components/HomeView.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ClipboardCheck, Sun, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, UserX, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSessions } from '../hooks/useSessions';
import { useProposals } from '../hooks/useProposals';
import { useReminders } from '../hooks/useReminders';
import { useCurricula } from '../hooks/useCurricula';
import { useProgress } from '../hooks/useProgress';
import { SessionModal } from './SessionModal';
import { ProgressLogModal } from './ProgressLogModal';
import type { ProgressLogPayload } from './ProgressLogModal';
import type { Reminder, Student, Class, Enrollment, Session } from '../types';
import { CURATED_PALETTE, DEFAULT_COLOR, normalizeColor } from '../utils/colors';
import { SessionSymbol } from '../utils/sessionSymbols';
import { getNowInDisplayTz } from '../utils/timezone';
import { isPreClassReminderStale } from '../utils/reminders';
import { Button } from './Button';

interface HomeViewProps {
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
}

function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr(): string {
  return formatLocalDateKey(getNowInDisplayTz());
}

function formatToday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function dateKey(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return formatLocalDateKey(getNowInDisplayTz());
  }
  return formatLocalDateKey(date);
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return formatLocalDateKey(dt);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return getWeekStart(new Date());
  }
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DISMISSED_POSTCLASS_KEY = 'classkeep-dismissed-postclass';
const POSTCLASS_GRACE_MINUTES = 15;

function readDismissedPostClassIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_POSTCLASS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
    return ids;
  } catch {
    return new Set();
  }
}

function writeDismissedPostClassIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_POSTCLASS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable; dismissal just won't persist.
  }
}

/** End-of-session as a wall-clock Date on the display timezone's calendar. */
function getSessionEndWallClock(session: Session): Date {
  const [y, m, d] = session.plannedDate.split('-').map(Number);
  const [hh, mm] = session.plannedTime.slice(0, 5).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm + session.durationMinutes);
}

function getSessionDisplayName(classes: Class[], students: Student[], session: Session): string {
  if (!session) return 'Untitled';
  if (session.classId) {
    return classes?.find((c) => c.id === session.classId)?.name ?? 'Class';
  }
  if (session.studentId) {
    return students?.find((s) => s.id === session.studentId)?.name ?? 'Student';
  }
  return 'Untitled';
}

function getStudentNames(session: Session, enrollments: Enrollment[], students: Student[]): string {
  if (!session) return 'No students';
  if (session.studentId) {
    return students?.find((s) => s.id === session.studentId)?.name ?? 'No student';
  }
  if (session.classId) {
    return (enrollments ?? [])
      .filter((e) => e.classId === session.classId)
      .map((e) => students?.find((s) => s.id === e.studentId)?.name)
      .filter(Boolean)
      .join(', ') || 'No students';
  }
  return 'No students';
}

function useStudentEffectiveColors(students: Student[]) {
  return useMemo(() => {
    const map = new Map<string, string>();
    const palette = CURATED_PALETTE;
    let paletteIndex = 0;

    for (const student of students ?? []) {
      if (!student?.id) continue;
      const normalized = normalizeColor(student.color);
      if (normalized) {
        map.set(student.id, normalized);
      }
    }

    for (const student of students ?? []) {
      if (!student?.id) continue;
      if (!map.has(student.id)) {
        map.set(student.id, palette[paletteIndex % palette.length] ?? DEFAULT_COLOR);
        paletteIndex++;
      }
    }

    return map;
  }, [students]);
}

function useGroupedStudents(students: Student[]) {
  return useMemo(() => {
    const groups = new Map<string | undefined, Student[]>();
    for (const student of students ?? []) {
      if (!student?.id) continue;
      const rawGroup = student.familyGroup;
      const key = typeof rawGroup === 'string' ? rawGroup.trim() || undefined : undefined;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(student);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }
    return Array.from(groups.entries()).sort((a, b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [students]);
}

export function HomeView({ students, classes, enrollments }: HomeViewProps) {
  const navigate = useNavigate();
  const { sessions, loading: sessionsLoading, updateSession, fetchSessions } = useSessions();
  const { proposals, loading: proposalsLoading } = useProposals();
  const { reminders, dismissReminder } = useReminders();
  const { curricula } = useCurricula();
  const {
    classCurricula,
    studentCurricula,
    logLessonProgress,
    addStudentCurriculum,
    updateStudentCurriculum,
    fetchAllProgress,
  } = useProgress();

  const [editingSession, setEditingSession] = useState<Session | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progressSession, setProgressSession] = useState<Session | undefined>();
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [dismissedPostClassIds, setDismissedPostClassIds] = useState<Set<string>>(() =>
    readDismissedPostClassIds()
  );

  const today = todayStr();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(getNowInDisplayTz()));
  const [selectedDayKey, setSelectedDayKey] = useState<string>(today);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set());
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(() => new Set());
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);

  useEffect(() => {
    if (!hasInitializedFilter && students.length > 0) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
      setSelectedClassIds(new Set(classes.map((c) => c.id)));
      setHasInitializedFilter(true);
    }
  }, [students, classes, hasInitializedFilter]);

  const studentColors = useStudentEffectiveColors(students);
  const groupedStudents = useGroupedStudents(students);

  const classToStudents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const en of enrollments) {
      const arr = map.get(en.classId) || [];
      arr.push(en.studentId);
      map.set(en.classId, arr);
    }
    return map;
  }, [enrollments]);

  // Filter: student chip on, class chip on, or enrolled student chip on
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.studentId) {
        return selectedStudentIds.has(session.studentId);
      }
      if (session.classId) {
        if (selectedClassIds.has(session.classId)) return true;
        const classStudentIds = classToStudents.get(session.classId) || [];
        return classStudentIds.some((sid) => selectedStudentIds.has(sid));
      }
      return false;
    });
  }, [sessions, classToStudents, selectedStudentIds, selectedClassIds]);

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);

  const weekSessionsByDay = useMemo(() => {
    const map = new Map<string, { session: Session }[]>();
    for (const day of weekDays) {
      map.set(dateKey(day), []);
    }
    for (const session of filteredSessions) {
      const list = map.get(session.plannedDate);
      if (list) list.push({ session });
    }
    return map;
  }, [filteredSessions, weekDays]);

  const todaysSessionsCount = useMemo(
    () => sessions.filter((s) => s.plannedDate === today).length,
    [sessions, today]
  );

  // Post-class summary: scheduled sessions that still need marking.
  // Past dates always qualify; today's sessions only qualify once the
  // session's end plus a grace period has passed, so upcoming classes
  // (e.g. one starting later tonight) never appear in the banner.
  const unmarkedPostClassSessions = useMemo(() => {
    const now = getNowInDisplayTz();
    return sessions
      .filter((session) => {
        if (session.status !== 'scheduled') return false;
        if (session.plannedDate > today) return false;
        if (session.plannedDate < today) return true;
        const graceMs = POSTCLASS_GRACE_MINUTES * 60 * 1000;
        return now.getTime() > getSessionEndWallClock(session).getTime() + graceMs;
      })
      .sort((a, b) =>
        `${a.plannedDate} ${a.plannedTime}`.localeCompare(`${b.plannedDate} ${b.plannedTime}`)
      );
  }, [sessions, today]);

  const visiblePostClassSessions = useMemo(
    () => unmarkedPostClassSessions.filter((session) => !dismissedPostClassIds.has(session.id)),
    [unmarkedPostClassSessions, dismissedPostClassIds]
  );

  // Self-heal: if a banner session is no longer present in the sessions
  // state at all (e.g. deleted or moved in another tab), refetch to
  // reconcile. Guarded so a refetch can't trigger an infinite loop.
  const postClassRevalidatedRef = useRef(false);
  useEffect(() => {
    const missing = unmarkedPostClassSessions.filter(
      (bannerSession) => !sessions.some((s) => s.id === bannerSession.id)
    );
    if (missing.length > 0) {
      if (!postClassRevalidatedRef.current) {
        postClassRevalidatedRef.current = true;
        fetchSessions();
      }
    } else {
      postClassRevalidatedRef.current = false;
    }
  }, [unmarkedPostClassSessions, sessions, fetchSessions]);

  const dismissPostClassBanner = () => {
    const next = new Set(dismissedPostClassIds);
    for (const session of visiblePostClassSessions) next.add(session.id);
    setDismissedPostClassIds(next);
    writeDismissedPostClassIds(next);
  };

  const pendingProposalsCount = useMemo(
    () => proposals.filter((p) => p.status === 'draft').length,
    [proposals]
  );

  const selectedDaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.plannedDate === selectedDayKey)
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
  }, [sessions, selectedDayKey]);

  const sessionsHeading = useMemo(() => {
    if (selectedDayKey === today) return 'Upcoming Today';
    const [y, m, d] = selectedDayKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `Sessions — ${date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })}`;
  }, [selectedDayKey, today]);

  // Ignore pre_class reminders whose session started >30 min ago, even if the
  // background scan has not dismissed them yet.
  const visibleReminders = useMemo(
    () =>
      reminders.filter(
        (r) => !isPreClassReminderStale(r, sessions, getNowInDisplayTz())
      ),
    [reminders, sessions]
  );

  const isLoading = sessionsLoading || proposalsLoading;

  const TYPE_ACCENTS: Record<Reminder['type'], { dot: string; icon: string; border: string }> = {
    pre_class: { dot: 'bg-blue-500', icon: 'text-blue-300', border: 'border-l-blue-500' },
    low_balance: { dot: 'bg-amber-500', icon: 'text-amber-300', border: 'border-l-amber-500' },
    unreviewed: { dot: 'bg-purple-500', icon: 'text-purple-300', border: 'border-l-purple-500' },
    daily_digest: { dot: 'bg-emerald-500', icon: 'text-emerald-300', border: 'border-l-emerald-500' },
  };

  const TYPE_CHIP_ICONS: Record<Reminder['type'], React.ReactNode> = {
    pre_class: <Clock className="w-3.5 h-3.5" />,
    low_balance: <AlertTriangle className="w-3.5 h-3.5" />,
    unreviewed: <ClipboardCheck className="w-3.5 h-3.5" />,
    daily_digest: <Sun className="w-3.5 h-3.5" />,
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(getNowInDisplayTz()));
    setSelectedDayKey(today);
  };
  const movePrevious = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
    setSelectedDayKey((prev) => shiftDateKey(prev, -7));
  };
  const moveNext = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
    setSelectedDayKey((prev) => shiftDateKey(prev, 7));
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStudentIds(new Set(students.map((s) => s.id)));
    setSelectedClassIds(new Set(classes.map((c) => c.id)));
  };
  const clearAll = () => {
    setSelectedStudentIds(new Set());
    setSelectedClassIds(new Set());
  };

  const handleDayClick = (key: string) => {
    setSelectedDayKey(key);
  };

  useEffect(() => {
    fetchAllProgress();
  }, [fetchAllProgress]);

  // Curriculum progress previews shown on session cards, e.g. "RE3: Unit 3B → 3C".
  const classProgressPreview = useMemo(() => {
    const map = new Map<string, string>();
    for (const cc of classCurricula) {
      if (cc.status !== 'active' || map.has(cc.classId)) continue;
      if (!cc.currentPosition && !cc.nextUp) continue;
      const title = curricula.find((c) => c.id === cc.curriculumId)?.title ?? 'Curriculum';
      map.set(
        cc.classId,
        `${title}: ${cc.currentPosition ?? '—'}${cc.nextUp ? ` → ${cc.nextUp}` : ''}`
      );
    }
    return map;
  }, [classCurricula, curricula]);

  const studentProgressPreview = useMemo(() => {
    const map = new Map<string, string>();
    for (const sc of studentCurricula) {
      if (sc.status !== 'active' || map.has(sc.studentId)) continue;
      if (!sc.currentPosition && !sc.nextUp) continue;
      const title = curricula.find((c) => c.id === sc.curriculumId)?.title ?? 'Curriculum';
      map.set(
        sc.studentId,
        `${title}: ${sc.currentPosition ?? '—'}${sc.nextUp ? ` → ${sc.nextUp}` : ''}`
      );
    }
    return map;
  }, [studentCurricula, curricula]);

  const dismissFromBanner = (sessionId: string) => {
    // Belt and braces: even if a stale refetch momentarily brings back the
    // old status, the dismissed list keeps it out of the banner.
    setDismissedPostClassIds((prev) => {
      if (prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.add(sessionId);
      writeDismissedPostClassIds(next);
      return next;
    });
  };

  const handleQuickStatus = async (session: Session, status: Session['status']) => {
    try {
      await updateSession(session.id, { status });
      await fetchSessions();
      dismissFromBanner(session.id);
      if (status === 'completed') {
        setProgressSession(session);
        setIsProgressModalOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const closeProgressModal = () => {
    setIsProgressModalOpen(false);
    setProgressSession(undefined);
  };

  const handleProgressSave = async (payload: ProgressLogPayload) => {
    try {
      await updateSession(payload.sessionId, { status: 'completed' });
      await logLessonProgress(
        payload.sessionId,
        payload.classId,
        payload.studentId,
        payload.curriculumId,
        payload.covered,
        payload.nextUp,
        payload.progressType
      );

      // Group progress also advances every enrolled student's individual position.
      if (payload.progressType === 'group' && payload.classId) {
        const memberIds = enrollments
          .filter((e) => e.classId === payload.classId && e.status === 'active')
          .map((e) => e.studentId);
        for (const studentId of memberIds) {
          const existing = studentCurricula.find(
            (sc) => sc.studentId === studentId && sc.curriculumId === payload.curriculumId
          );
          if (existing) {
            await updateStudentCurriculum(existing.id, {
              currentPosition: payload.covered,
              nextUp: payload.nextUp,
            });
          } else {
            await addStudentCurriculum({
              studentId,
              curriculumId: payload.curriculumId,
              currentPosition: payload.covered,
              nextUp: payload.nextUp,
              status: 'active',
            });
          }
        }
      }

      dismissFromBanner(payload.sessionId);
      await fetchSessions();
      await fetchAllProgress();
      toast.success('Progress logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log progress');
    } finally {
      closeProgressModal();
    }
  };

  const openEditModal = (session: Session) => {
    setEditingSession(session);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSession(undefined);
  };

  const handleUpdateSession = async (id: string, updates: Partial<Session>) => {
    try {
      await updateSession(id, updates);
      await fetchSessions();
      toast.success('Session updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return '';
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, [weekDays]);

  const groupClasses = classes.filter((c) => c.type === 'group');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Post-class summary banner */}
      {visiblePostClassSessions.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 dark:bg-amber-900/20 dark:border-amber-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {visiblePostClassSessions.length === 1
                  ? 'You have 1 unmarked class from today'
                  : `You have ${visiblePostClassSessions.length} unmarked classes from today`}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                onClick={() => fetchSessions()}
                className="inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button variant="ghost" onClick={dismissPostClassBanner}>
                Dismiss
              </Button>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Don't forget to mark your classes!
          </p>
          <ul className="mt-3 space-y-2">
            {visiblePostClassSessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 dark:bg-gray-800 dark:border-amber-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {getSessionDisplayName(classes, students, session)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-500">
                    {session.plannedDate} · {session.plannedTime.slice(0, 5)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickStatus(session, 'completed')}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/50"
                  >
                    <Check className="w-3 h-3" />
                    Taught
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatus(session, 'cancelled')}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 text-[10px] font-medium hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50"
                  >
                    <X className="w-3 h-3" />
                    Cancelled
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatus(session, 'moved')}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-[10px] font-medium hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    Moved
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reminder notifications */}
      {visibleReminders.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-2">
          {(showAllReminders ? visibleReminders : visibleReminders.slice(0, 2)).map((reminder) => (
            <div
              key={reminder.id}
              className={`flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700 border-l-2 ${TYPE_ACCENTS[reminder.type].border}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_ACCENTS[reminder.type].dot}`} />
              <button
                type="button"
                onClick={() => navigate('/reminders')}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
              >
                <span className={TYPE_ACCENTS[reminder.type].icon}>{TYPE_CHIP_ICONS[reminder.type]}</span>
                <span className="truncate text-sm text-slate-100">{reminder.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissReminder(reminder.id);
                }}
                className="p-1 hover:bg-slate-700 rounded-full transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          ))}
          {!showAllReminders && visibleReminders.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllReminders(true)}
              className="w-full text-left text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              +{visibleReminders.length - 2} more
            </button>
          )}
        </div>
      )}

      {/* Dashboard summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ClassKeep</h1>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{formatToday(today)}</p>
          </div>

          {isLoading ? (
            <div className="text-sm text-slate-500 dark:text-gray-500">Loading dashboard...</div>
          ) : (
            <div className="flex gap-3">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{todaysSessionsCount}</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Session{todaysSessionsCount !== 1 ? 's' : ''} today</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingProposalsCount}</div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Pending proposal{pendingProposalsCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact week overview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center gap-2 flex-nowrap">
            <Button variant="secondary" onClick={movePrevious} className="inline-flex items-center gap-1 shrink-0">
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            <Button variant="secondary" onClick={goToToday} className="shrink-0">
              Today
            </Button>
            <Button variant="secondary" onClick={moveNext} className="inline-flex items-center gap-1 shrink-0">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </Button>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{weekRangeLabel}</h2>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 h-[150px]">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const daySessions = weekSessionsByDay.get(key) ?? [];
            const isToday = key === today;
            const isSelected = key === selectedDayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDayClick(key)}
                className={`flex flex-col items-center justify-start pt-2 pb-1 px-1 rounded-lg border transition-colors min-h-[44px] ${
                  isToday
                    ? 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                    : isSelected
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                    : 'bg-white border-slate-100 hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">
                  {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span
                  className={`text-sm sm:text-base font-semibold mt-0.5 mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-900 dark:text-gray-100'
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-wrap justify-center gap-1 px-0.5 overflow-hidden">
                  {daySessions.map((entry) => (
                    <span
                      key={entry.session.id}
                      className="inline-flex w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 [&_svg]:w-full [&_svg]:h-full"
                      title={getSessionDisplayName(classes, students, entry.session)}
                    >
                      <SessionSymbol session={entry.session} />
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions for the selected day */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{sessionsHeading}</h2>
        </div>

        {selectedDaySessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <p>No classes scheduled for this day.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedDaySessions.map((session) => {
              const progressPreview = session.classId
                ? classProgressPreview.get(session.classId)
                : session.studentId
                ? studentProgressPreview.get(session.studentId)
                : undefined;
              return (
              <div
                key={session.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/30 hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col items-center justify-center min-w-[52px] py-1 px-2 bg-white dark:bg-gray-800 rounded-md border border-slate-200 dark:border-gray-600">
                  <span className="text-xs text-slate-500 dark:text-gray-400">{session.plannedTime.slice(0, 5)}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-gray-500">{session.durationMinutes}m</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {getSessionDisplayName(classes, students, session)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                    {getStudentNames(session, enrollments, students)}
                  </p>
                  {progressPreview && (
                    <p
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 truncate"
                      title={progressPreview}
                    >
                      {progressPreview}
                    </p>
                  )}
                  <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full capitalize ${
                    session.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : session.status === 'cancelled'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {session.status}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(session, 'completed')}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/50"
                      >
                        <Check className="w-3 h-3" />
                        Taught
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(session, 'no-show')}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-medium hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/50"
                      >
                        <UserX className="w-3 h-3" />
                        No-show
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(session, 'cancelled')}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 text-[10px] font-medium hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50"
                      >
                        <X className="w-3 h-3" />
                        Cancelled
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(session)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-[10px] font-medium hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <CalendarIcon className="w-3 h-3" />
                        Move
                      </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student + class filter chips */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Filter by student / class</h3>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="ghost" onClick={clearAll}>
              Hide all
            </Button>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {groupedStudents.map(([groupName, groupStudents]) => (
            <div key={groupName ?? '__ungrouped__'} className="flex flex-col gap-1.5 shrink-0">
              {groupName && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 px-1">
                  {groupName}
                </span>
              )}
              <div className="flex gap-2">
                {groupStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  const color = studentColors.get(student.id) ?? DEFAULT_COLOR;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className={isSelected ? '' : 'line-through'}>{student.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groupClasses.length > 0 && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 px-1">
                Group classes
              </span>
              <div className="flex gap-2">
                {groupClasses.map((cls) => {
                  const isSelected = selectedClassIds.has(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClass(cls.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cls.color || '#6366f1' }}
                      />
                      <span className={isSelected ? '' : 'line-through'}>{cls.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <SessionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        session={editingSession}
        students={students}
        classes={classes}
        sessions={sessions}
        enrollments={enrollments}
        curricula={curricula}
        onSave={() => {}}
        onUpdate={handleUpdateSession}
        onDelete={() => {}}
        onLogProgress={handleProgressSave}
      />

      {progressSession && (
        <ProgressLogModal
          isOpen={isProgressModalOpen}
          onClose={closeProgressModal}
          session={progressSession}
          students={students}
          classes={classes}
          curricula={curricula}
          onSave={handleProgressSave}
        />
      )}
    </div>
  );
}