import { useMemo } from 'react';
import type { Session, Student, Class, Enrollment, CalendarPreferences } from '../types';
import {
  addDaysInTz,
  formatDateKeyInTz,
  formatDisplayDateInTz,
  formatDisplayWeekdayInTz,
} from '../utils/timezone';
import { addMinutes, getTimeSlots, getSessionPosition, getTimeFromClickY } from '../utils/date';
import { findOverlappingSessions, getSessionColor, type SessionWithOverlap } from '../utils/calendar';

const ROW_HEIGHT_PX = 40;

function getSessionStudent(session: Session, enrollments: Enrollment[], students: Student[]): Student | undefined {
  const classEnrollments = enrollments.filter(e => e.classId === session.classId && e.status === 'active');
  const primaryStudentId = classEnrollments[0]?.studentId;
  return students.find(s => s.id === primaryStudentId);
}

interface WeekViewProps {
  weekStart: Date;
  timezone: string;
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
  sessions: Session[];
  preferences: CalendarPreferences;
  onSlotClick: (dateKey: string, time: string) => void;
  onSessionClick?: (session: Session) => void;
}

export function WeekView({
  weekStart,
  timezone,
  students,
  classes,
  enrollments,
  sessions,
  preferences,
  onSlotClick,
  onSessionClick,
}: WeekViewProps) {
  const startTimeStr = preferences.calendarStartTime.slice(0, 5);
  const endTimeStr = preferences.calendarEndTime.slice(0, 5);
  const slotMinutes = preferences.calendarSlotMinutes;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysInTz(weekStart, i, timezone));
  }, [weekStart, timezone]);

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

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithOverlap[]>();
    weekDays.forEach((day) => map.set(formatDateKeyInTz(day.toISOString(), timezone), []));
    sessionsWithOverlap.forEach((session) => {
      const dateKey = session.plannedDate;
      const list = map.get(dateKey);
      if (list) list.push(session);
    });
    return map;
  }, [sessionsWithOverlap, weekDays, timezone]);

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
        className="absolute left-1 right-1 rounded-md px-2 py-1 text-xs text-white shadow-sm overflow-hidden text-left z-10"
        style={{
          top: `${top}%`,
          height: `${height}%`,
          backgroundColor: color,
        }}
        title={`${student?.name ?? cls?.name ?? 'Unknown'} • ${timeStr} - ${endTime}`}
      >
        <div className="font-semibold truncate">
          {student?.name ?? cls?.name ?? 'Unknown'}
          {isOverride && <span className="ml-1">⚡</span>}
        </div>
        <div className="truncate opacity-90">
          {timeStr} - {endTime}
        </div>
        <div className="truncate opacity-80">{session.durationMinutes}m</div>
      </button>
    );
  };

  const renderDayColumn = (day: Date, dayIndex: number) => {
    const dateKey = formatDateKeyInTz(day.toISOString(), timezone);
    const daySessions = sessionsByDay.get(dateKey) ?? [];

    const handleColumnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const time = getTimeFromClickY(y, rect.height, startTimeStr, endTimeStr);
      onSlotClick(dateKey, time);
    };

    return (
      <div
        key={dateKey}
        className="relative bg-white border-l border-slate-200 min-w-[100px]"
        style={{
          gridColumn: dayIndex + 2,
          gridRow: `2 / span ${totalRows}`,
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
    );
  };

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
      <div
        className="min-w-[900px]"
        style={{
          display: 'grid',
          gridTemplateColumns: '64px repeat(7, 1fr)',
          gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
        }}
      >
        <div className="border-b border-r border-slate-200 bg-slate-50" />
        {weekDays.map((day, idx) => (
          <div
            key={idx}
            className="px-2 py-3 text-center border-b border-l border-slate-200 bg-slate-50 text-sm font-medium text-slate-700"
          >
            <div>{formatDisplayWeekdayInTz(day.toISOString(), timezone)}</div>
            <div className="text-xs text-slate-500">
              {formatDisplayDateInTz(day.toISOString(), timezone)}
            </div>
          </div>
        ))}

        {timeSlots.map((time, idx) => (
          <div
            key={time}
            className="text-xs text-slate-500 text-right pr-2 border-r border-slate-200 flex items-start justify-end"
            style={{ gridColumn: 1, gridRow: idx + 2 }}
          >
            {time}
          </div>
        ))}

        {weekDays.map((day, idx) => renderDayColumn(day, idx))}
      </div>
    </div>
  );
}
