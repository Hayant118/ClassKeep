// src/components/HomeView.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ClipboardCheck, Sun, X, Calendar as CalendarIcon } from 'lucide-react';
import { useSessions } from '../hooks/useSessions';
import { useProposals } from '../hooks/useProposals';
import { useReminders } from '../hooks/useReminders';
import { Calendar } from './Calendar';
import type { Reminder, Student, Class, Enrollment, Session } from '../types';

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

export function HomeView({ students, classes, enrollments, onResolveClassForStudent }: HomeViewProps) {
  const navigate = useNavigate();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { proposals, loading: proposalsLoading } = useProposals();
  const { reminders, dismissReminder } = useReminders();

  const today = todayStr();

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

      {/* Embedded calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <Calendar
          students={students}
          classes={classes}
          enrollments={enrollments}
          onResolveClassForStudent={onResolveClassForStudent}
        />
      </div>
    </div>
  );
}
