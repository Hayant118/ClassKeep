import { useMemo, useState } from 'react';
import type { Session, Student, Class, Enrollment } from '../types';
import {
  addMonthsInTz,
  formatDateKeyInTz,
  formatDisplayDateInTz,
  formatMonthYearInTz,
  getCalendarDaysForMonth,
  startOfMonthInTz,
} from '../utils/timezone';
import { findOverlappingSessions, type SessionWithOverlap } from '../utils/calendar';
import { SessionCard } from './SessionCard';
import { X } from './icons';
import { isSessionAutoCompleted } from '../hooks/useSessions';

interface MonthViewProps {
  monthStart: Date;
  timezone: string;
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
  sessions: Session[];
  onMonthChange: (offset: number) => void;
  onSessionClick?: (session: Session) => void;
  onAddSession?: (dateKey: string) => void;
  onDeleteSession?: (id: string) => void;
  inlineDetail?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getSessionStudent(session: Session, enrollments: Enrollment[], students: Student[]): Student | undefined {
  const classEnrollments = enrollments.filter(e => e.classId === session.classId && e.status === 'active');
  const primaryStudentId = classEnrollments[0]?.studentId;
  return students.find(s => s.id === primaryStudentId);
}

function getMonthDotColor(
  session: Session,
  classes: Class[],
  enrollments: Enrollment[],
  students: Student[]
): string {
  const cls = classes.find(c => c.id === session.classId);
  if (cls?.color) return cls.color;
  const student = getSessionStudent(session, enrollments, students);
  return student?.color ?? '#6366f1';
}

interface DetailContentProps {
  selectedDay: Date;
  timezone: string;
  sessions: SessionWithOverlap[];
  onClose: () => void;
  onAddSession?: (dateKey: string) => void;
  onSessionClick?: (session: Session) => void;
  onDeleteSession?: (id: string) => void;
  students: Student[];
  enrollments: Enrollment[];
}

function DetailContent({
  selectedDay,
  timezone,
  sessions,
  onClose,
  onAddSession,
  onSessionClick,
  onDeleteSession,
  students,
  enrollments,
}: DetailContentProps) {
  const dateKey = formatDateKeyInTz(selectedDay.toISOString(), timezone);
  return (
    <>
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-slate-800">
          {formatDisplayDateInTz(selectedDay.toISOString(), timezone)}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </span>
          {onAddSession && (
            <button
              type="button"
              onClick={() => {
                onAddSession(dateKey);
                onClose();
              }}
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add session
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-slate-500 text-sm">No sessions for this day.</p>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              student={getSessionStudent(session, enrollments, students)}
              timezone={timezone}
              students={students}
              onEdit={onSessionClick}
              onDelete={(id) => {
                onDeleteSession?.(id);
                if (sessions.length <= 1) onClose();
              }}
            />
          ))
        )}
      </div>
    </>
  );
}

export function MonthView({
  monthStart,
  timezone,
  students,
  classes,
  enrollments,
  sessions,
  onMonthChange,
  onSessionClick,
  onAddSession,
  onDeleteSession,
  inlineDetail,
}: MonthViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const normalizedMonthStart = useMemo(
    () => startOfMonthInTz(monthStart, timezone),
    [monthStart, timezone]
  );

  const calendarDays = useMemo(
    () => getCalendarDaysForMonth(normalizedMonthStart, timezone),
    [normalizedMonthStart, timezone]
  );

  const sessionsWithOverlap = useMemo<SessionWithOverlap[]>(() => {
    const overlapIds = findOverlappingSessions(sessions);
    return sessions.map((session) => ({
      ...session,
      hasOverlap: overlapIds.has(session.id),
    }));
  }, [sessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithOverlap[]>();
    calendarDays.forEach((day) => map.set(formatDateKeyInTz(day.toISOString(), timezone), []));
    sessionsWithOverlap.forEach((session) => {
      const dateKey = session.plannedDate;
      const list = map.get(dateKey);
      if (list) list.push(session);
    });
    return map;
  }, [sessionsWithOverlap, calendarDays, timezone]);

  const monthEnd = addMonthsInTz(normalizedMonthStart, 1, timezone);
  const isCurrentMonth = (day: Date) => {
    return day.getTime() >= normalizedMonthStart.getTime() && day.getTime() < monthEnd.getTime();
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
  };

  const handleMonthChange = (offset: number) => {
    setSelectedDay(null);
    onMonthChange(offset);
  };

  const closeDetail = () => setSelectedDay(null);

  const selectedDayKey = selectedDay ? formatDateKeyInTz(selectedDay.toISOString(), timezone) : null;
  const selectedDaySessions = selectedDayKey
    ? (sessionsByDay.get(selectedDayKey) ?? []).sort((a, b) => a.plannedTime.localeCompare(b.plannedTime))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleMonthChange(-1)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          aria-label="Previous month"
        >
          ← Prev
        </button>
        <h2 className="text-xl font-semibold text-slate-800">
          {formatMonthYearInTz(normalizedMonthStart, timezone)}
        </h2>
        <button
          type="button"
          onClick={() => handleMonthChange(1)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          aria-label="Next month"
        >
          Next →
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-semibold text-slate-600">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {calendarDays.map((day) => {
            const dateKey = formatDateKeyInTz(day.toISOString(), timezone);
            const daySessions = sessionsByDay.get(dateKey) ?? [];
            const active = selectedDayKey === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 text-left border-b border-r border-slate-100 transition-colors hover:bg-slate-50 focus:outline-none ${
                  active ? 'bg-indigo-50' : ''
                } ${isCurrentMonth(day) ? '' : 'bg-slate-50/50 text-slate-400'}`}
                style={{ gridColumn: ((day.getDay() + 6) % 7) + 1 }}
              >
                <div className={`font-medium ${isCurrentMonth(day) ? 'text-slate-700' : 'text-slate-400'} text-xs sm:text-sm`}>
                  {formatDisplayDateInTz(day.toISOString(), timezone).replace(/[^0-9]/g, '')}
                </div>
                <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-1">
                  {daySessions.slice(0, 4).map((session) => (
                    <span
                      key={session.id}
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        isSessionAutoCompleted(session.id) ? 'ring-1 ring-amber-400' : ''
                      }`}
                      style={{ backgroundColor: getMonthDotColor(session, classes, enrollments, students) }}
                    />
                  ))}
                  {daySessions.length > 4 && (
                    <span className="text-[9px] sm:text-[10px] text-slate-500 leading-none">+{daySessions.length - 4}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && !inlineDetail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={closeDetail}
        >
          <div
            className="bg-white w-full max-w-lg sm:rounded-xl rounded-t-xl shadow-lg max-h-[75vh] sm:max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DetailContent
              selectedDay={selectedDay}
              timezone={timezone}
              sessions={selectedDaySessions}
              onClose={closeDetail}
              onAddSession={onAddSession}
              onSessionClick={onSessionClick}
              onDeleteSession={onDeleteSession}
              students={students}
              enrollments={enrollments}
            />
          </div>
        </div>
      )}

      {selectedDay && inlineDetail && (
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm mt-4">
            <DetailContent
            selectedDay={selectedDay}
            timezone={timezone}
            sessions={selectedDaySessions}
            onClose={closeDetail}
            onAddSession={onAddSession}
            onSessionClick={onSessionClick}
            onDeleteSession={onDeleteSession}
            students={students}
            enrollments={enrollments}
          />
        </div>
      )}
    </div>
  );
}
