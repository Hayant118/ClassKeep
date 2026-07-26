// src/components/HomeView.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ClipboardCheck, Sun, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSessions } from '../hooks/useSessions';
import { useProposals } from '../hooks/useProposals';
import { useReminders } from '../hooks/useReminders';
import type { Reminder, Student, Class, Enrollment, Session } from '../types';
import { CURATED_PALETTE, DEFAULT_COLOR, normalizeColor } from '../utils/colors';

interface HomeViewProps {
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
  onResolveClassForStudent?: (studentId: string) => Promise<string>;
}

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

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getSessionDisplayName(classes: Class[], students: Student[], session: Session): string {
  if (session.classId) {
    return classes.find((c) => c.id === session.classId)?.name ?? 'Class';
  }
  if (session.studentId) {
    return students.find((s) => s.id === session.studentId)?.name ?? 'Student';
  }
  return 'Untitled';
}

function getStudentNames(session: Session, enrollments: Enrollment[], students: Student[]): string {
  if (session.studentId) {
    return students.find((s) => s.id === session.studentId)?.name ?? 'No student';
  }
  if (session.classId) {
    return enrollments
      .filter((e) => e.classId === session.classId)
      .map((e) => students.find((s) => s.id === e.studentId)?.name)
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

    for (const student of students) {
      const normalized = normalizeColor(student.color);
      if (normalized) {
        map.set(student.id, normalized);
      }
    }

    for (const student of students) {
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
    for (const student of students) {
      const key = student.familyGroup?.trim() || undefined;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(student);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
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
  const { sessions, loading: sessionsLoading } = useSessions();
  const { proposals, loading: proposalsLoading } = useProposals();
  const { reminders, dismissReminder } = useReminders();

  const today = todayStr();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set());
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);

  useEffect(() => {
    if (!hasInitializedFilter && students.length > 0) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
      setHasInitializedFilter(true);
    }
  }, [students, hasInitializedFilter]);

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

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.studentId) {
        return selectedStudentIds.has(session.studentId);
      }
      const classStudentIds = session.classId ? classToStudents.get(session.classId) || [] : [];
      return classStudentIds.some((sid) => selectedStudentIds.has(sid));
    });
  }, [sessions, classToStudents, selectedStudentIds]);

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);

  const weekSessionsByDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const day of weekDays) {
      map.set(dateKey(day), []);
    }
    for (const session of filteredSessions) {
      const list = map.get(session.plannedDate);
      if (list) list.push(session);
    }
    return map;
  }, [filteredSessions, weekDays]);

  const todaysSessionsCount = useMemo(
    () => sessions.filter((s) => s.plannedDate === today).length,
    [sessions, today]
  );

  const pendingProposalsCount = useMemo(
    () => proposals.filter((p) => p.status === 'draft').length,
    [proposals]
  );

  const todaysSessions = useMemo(() => {
    return sessions
      .filter((s) => s.plannedDate === today)
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
  }, [sessions, today]);

  const isLoading = sessionsLoading || proposalsLoading;

  const TYPE_CHIP_COLORS: Record<Reminder['type'], string> = {
    pre_class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    low_balance: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    unreviewed: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    daily_digest: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  };

  const TYPE_CHIP_ICONS: Record<Reminder['type'], React.ReactNode> = {
    pre_class: <Clock className="w-3.5 h-3.5" />,
    low_balance: <AlertTriangle className="w-3.5 h-3.5" />,
    unreviewed: <ClipboardCheck className="w-3.5 h-3.5" />,
    daily_digest: <Sun className="w-3.5 h-3.5" />,
  };

  const goToToday = () => setCurrentWeekStart(getWeekStart(new Date()));
  const movePrevious = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };
  const moveNext = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllStudents = () => setSelectedStudentIds(new Set(students.map((s) => s.id)));
  const clearAllStudents = () => setSelectedStudentIds(new Set());

  const handleDayClick = () => {
    navigate('/calendar');
  };

  const getSessionDotColor = (session: Session): string => {
    if (session.studentId) {
      const color = studentColors.get(session.studentId);
      if (color) return color;
    }
    if (session.classId) {
      const classStudentIds = classToStudents.get(session.classId) || [];
      for (const sid of classStudentIds) {
        const color = studentColors.get(sid);
        if (color) return color;
      }
    }
    return DEFAULT_COLOR;
  };

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return '';
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, [weekDays]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Reminder chips */}
      {reminders.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium whitespace-nowrap shrink-0 ${TYPE_CHIP_COLORS[reminder.type]}`}
            >
              <button
                type="button"
                onClick={() => navigate('/reminders')}
                className="flex items-center gap-1.5"
              >
                {TYPE_CHIP_ICONS[reminder.type]}
                <span className="max-w-[160px] truncate">{reminder.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissReminder(reminder.id);
                }}
                className="p-0.5 hover:bg-black/10 rounded-full transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight">ClassKeep</h1>
            <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">{formatToday(today)}</p>
          </div>

          {isLoading ? (
            <div className="text-slate-400 text-sm">Loading dashboard...</div>
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={movePrevious}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={moveNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200">{weekRangeLabel}</h2>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 h-[150px]">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const daySessions = weekSessionsByDay.get(key) ?? [];
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                onClick={handleDayClick}
                className={`flex flex-col items-center justify-start pt-2 pb-1 px-1 rounded-lg border transition-colors min-h-[44px] ${
                  isToday
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
                  {daySessions.map((session) => (
                    <span
                      key={session.id}
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getSessionDotColor(session) }}
                      title={getSessionDisplayName(classes, students, session)}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's upcoming classes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Upcoming Today</h2>
        </div>

        {todaysSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <p>No classes scheduled for today.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaysSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/30 hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col items-center justify-center min-w-[52px] py-1 px-2 bg-white dark:bg-gray-800 rounded-md border border-slate-200 dark:border-gray-600">
                  <span className="text-xs text-slate-500 dark:text-gray-400">{session.plannedTime.slice(0, 5)}</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-gray-200">{session.durationMinutes}m</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {getSessionDisplayName(classes, students, session)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                    {getStudentNames(session, enrollments, students)}
                  </p>
                  <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full capitalize ${
                    session.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : session.status === 'cancelled'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student filter chips */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Filter by student</h3>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAllStudents}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAllStudents}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Hide all
            </button>
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
        </div>
      </div>
    </div>
  );
}
