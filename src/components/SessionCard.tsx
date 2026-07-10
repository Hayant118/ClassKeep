import type { Student } from '../types';
import { getSessionColor, type SessionWithOverlap } from '../utils/calendar';
import { addMinutes } from '../utils/date';

interface SessionCardProps {
  session: SessionWithOverlap;
  student: Student | undefined;
  timezone: string;
  students: Student[];
  onEdit?: (session: SessionWithOverlap) => void;
  onDelete?: (id: string) => void;
}

export function SessionCard({ session, student, timezone, students, onEdit, onDelete }: SessionCardProps) {
  const color = getSessionColor(session, students);
  const isOverride = session.rateMode === 'override';
  const startTime = session.plannedTime;
  const endTime = addMinutes(startTime, session.durationMinutes);

  return (
    <div
      className="rounded-lg p-3 text-sm shadow-sm border border-slate-200"
      style={{ backgroundColor: `${color}15`, borderColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="truncate">{student?.name ?? 'Unknown'}</span>
            {isOverride && <span title="Rate override">⚡</span>}
          </div>
          <div className="text-slate-600 mt-0.5">
            {startTime} - {endTime} ({session.durationMinutes}m)
          </div>
          <div className="text-slate-500 text-xs mt-0.5">
            {session.plannedDate}
            {' • '}
            {timezone}
            {session.status === 'moved' && session.movedFromDate && (
              <span className="ml-1 text-orange-600">
                (moved from {session.movedFromDate} {session.movedFromTime})
              </span>
            )}
          </div>
          {session.notes && <div className="text-slate-600 mt-1.5 text-xs">{session.notes}</div>}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(session)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(session.id)}
              className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}