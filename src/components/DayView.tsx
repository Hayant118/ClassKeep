import { useMemo } from 'react';
import { Check, ArrowRightLeft, X, Circle, Star } from 'lucide-react';
import type { Session, Student, Class, Enrollment, CalendarPreferences } from '../types';
import {
  formatDateKeyInTz,
  formatDisplayDateInTz,
  formatDisplayWeekdayInTz,
} from '../utils/timezone';
import { addMinutes } from '../utils/date';
import { findOverlappingSessions, getSessionColor, type SessionWithOverlap } from '../utils/calendar';
import { isSessionAutoCompleted } from '../hooks/useSessions';

function StatusIcon({ status }: { status: Session['status'] }) {
  const className = 'w-4 h-4 flex-shrink-0';
  switch (status) {
    case 'completed':
      return <Check className={`${className} text-emerald-600`} />;
    case 'moved':
      return <ArrowRightLeft className={`${className} text-amber-600`} />;
    case 'cancelled':
      return <X className={`${className} text-red-600`} />;
    case 'no-show':
      return <Circle className={`${className} text-slate-400`} />;
    case 'holiday':
      return <Star className={`${className} text-purple-600`} />;
    default:
      return null;
  }
}

function getSessionStudent(
  session: Session,
  enrollments: Enrollment[],
  students: Student[]
): Student | undefined {
  const classEnrollments = enrollments.filter(
    (e) => e.classId === session.classId && e.status === 'active'
  );
  const primaryStudentId = classEnrollments[0]?.studentId;
  return students.find((s) => s.id === primaryStudentId);
}

interface DayViewProps {
  day: Date;
  timezone: string;
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
  sessions: Session[];
  preferences: CalendarPreferences;
  onSlotClick: (dateKey: string, time: string) => void;
  onSessionClick?: (session: Session) => void;
  onDeleteSession?: (id: string) => void;
}

export function DayView({
  day,
  timezone,
  students,
  classes,
  enrollments,
  sessions,
  preferences,
  onSlotClick,
  onSessionClick,
}: DayViewProps) {
  const startTimeStr = preferences.calendarStartTime.slice(0, 5);
  const dateKey = formatDateKeyInTz(day.toISOString(), timezone);

  const sessionsWithOverlap = useMemo<SessionWithOverlap[]>(() => {
    const overlapIds = findOverlappingSessions(sessions);
    return sessions.map((session) => ({
      ...session,
      hasOverlap: overlapIds.has(session.id),
    }));
  }, [sessions]);

  const daySessions = useMemo(() => {
    return sessionsWithOverlap
      .filter((session) => session.plannedDate === dateKey)
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
  }, [sessionsWithOverlap, dateKey]);

  const renderSession = (session: SessionWithOverlap) => {
    const student = getSessionStudent(session, enrollments, students);
    const cls = classes.find((c) => c.id === session.classId);
    const color = getSessionColor(session, students, preferences.colorConflict);
    const isOverride = session.rateMode === 'override';
    const isAutoCompleted = isSessionAutoCompleted(session.id);
    const startTime = session.plannedTime;
    const endTime = addMinutes(startTime, session.durationMinutes);

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => onSessionClick?.(session)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
          isAutoCompleted ? 'ring-2 ring-amber-300' : ''
        }`}
        style={{ borderColor: color, backgroundColor: `${color}15` }}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
            <span className="truncate">{student?.name ?? cls?.name ?? 'Unknown'}</span>
            <StatusIcon status={session.status} />
            {isOverride && <span title="Rate override">⚡</span>}
          </div>
          <div className="text-xs text-slate-600">
            {startTime} - {endTime} ({session.durationMinutes}m)
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {formatDisplayWeekdayInTz(day.toISOString(), timezone)},{' '}
            {formatDisplayDateInTz(day.toISOString(), timezone)}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSlotClick(dateKey, startTimeStr)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 border border-indigo-100"
        >
          + Add
        </button>
      </div>

      <div className="p-3">
        {daySessions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">No sessions today</p>
            <button
              type="button"
              onClick={() => onSlotClick(dateKey, startTimeStr)}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
            >
              Add a session
            </button>
          </div>
        ) : (
          <div className="space-y-2">{daySessions.map(renderSession)}</div>
        )}
      </div>
    </div>
  );
}
