import { useMemo } from 'react';
import type { Session, Student, Class, Enrollment, CalendarPreferences } from '../types';
import {
  formatDateKeyInTz,
  formatDisplayDateInTz,
  formatDisplayWeekdayInTz,
} from '../utils/timezone';
import { addMinutes, getTimeSlots, getSessionPosition, getTimeFromClickY } from '../utils/date';
import { findOverlappingSessions, getSessionColor, type SessionWithOverlap } from '../utils/calendar';
import { SessionCard } from './SessionCard';

const ROW_HEIGHT_PX = 48;

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

function getSessionStudent(session: Session, enrollments: Enrollment[], students: Student[]): Student | undefined {
  const classEnrollments = enrollments.filter(e => e.classId === session.classId && e.status === 'active');
  const primaryStudentId = classEnrollments[0]?.studentId;
  return students.find(s => s.id === primaryStudentId);
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
  onDeleteSession,
}: DayViewProps) {
  const startTimeStr = preferences.calendarStartTime.slice(0, 5);
  const endTimeStr = preferences.calendarEndTime.slice(0, 5);
  const slotMinutes = preferences.calendarSlotMinutes;

  const dateKey = formatDateKeyInTz(day.toISOString(), timezone);
  const timeSlots = useMemo(
    () => getTimeSlots(startTimeStr, endTimeStr, slotMinutes),
    [startTimeStr, endTimeStr, slotMinutes]
  );
  const totalRows = timeSlots.length;

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

  const handleColumnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const time = getTimeFromClickY(y, rect.height, startTimeStr, endTimeStr);
    onSlotClick(dateKey, time);
  };

  const renderSessionBlock = (session: SessionWithOverlap) => {
    const student = getSessionStudent(session, enrollments, students);
    const cls = classes.find(c => c.id === session.classId);
    const color = getSessionColor(session, students, preferences.colorConflict);
    const isOverride = session.rateMode === 'override';
    const timeStr = session.plannedTime;
    const endTime = addMinutes(timeStr, session.durationMinutes);
    const { top, height } = getSessionPosition(timeStr, session.durationMinutes, startTimeStr, endTimeStr);

    if (height <= 0) return null;

    return (
      <button
        key={session.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSessionClick?.(session);
        }}
        className="absolute left-1 right-1 rounded-md px-3 py-2 text-sm text-white shadow-sm overflow-hidden z-10 text-left"
        style={{
          top: `${top}%`,
          height: `${height}%`,
          backgroundColor: color,
        }}
      >
        <div className="font-semibold flex items-center gap-1">
          {student?.name ?? cls?.name ?? 'Unknown'}
          {isOverride && <span>⚡</span>}
        </div>
        <div className="opacity-90">
          {timeStr} - {endTime} ({session.durationMinutes}m)
        </div>
        {session.notes && <div className="opacity-80 text-xs mt-1 truncate">{session.notes}</div>}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '72px 1fr',
            gridTemplateRows: `repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
          }}
        >
          {timeSlots.map((time, idx) => (
            <div
              key={time}
              className="text-xs text-slate-500 text-right pr-3 border-r border-slate-200 flex items-start justify-end pt-1"
              style={{ gridColumn: 1, gridRow: idx + 1 }}
            >
              {time}
            </div>
          ))}

          <div
            className="relative bg-white"
            style={{
              gridColumn: 2,
              gridRow: `1 / span ${totalRows}`,
              display: 'grid',
              gridTemplateRows: `repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
            }}
          >
            {timeSlots.map((time, idx) => (
              <div
                key={time}
                className="w-full border-b border-slate-100"
                style={{ gridRow: idx + 1 }}
              />
            ))}
            <button
              type="button"
              onClick={handleColumnClick}
              className="absolute inset-0 w-full h-full text-left hover:bg-slate-50/50 transition-colors focus:outline-none focus:bg-indigo-50/50"
              aria-label={`Add session on ${dateKey}`}
            />
            {daySessions.map(renderSessionBlock)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            {formatDisplayWeekdayInTz(day.toISOString(), timezone)},{' '}
            {formatDisplayDateInTz(day.toISOString(), timezone)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Details</h4>
            <button
              type="button"
              onClick={() => onSlotClick(dateKey, startTimeStr)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
            >
              + Add
            </button>
          </div>
          {daySessions.length === 0 ? (
            <p className="text-slate-500 text-sm">No sessions for this day.</p>
          ) : (
            daySessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                student={getSessionStudent(session, enrollments, students)}
                timezone={timezone}
                students={students}
                onEdit={onSessionClick}
                onDelete={onDeleteSession}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
