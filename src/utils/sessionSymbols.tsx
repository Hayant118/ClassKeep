import type { ReactElement } from 'react';
import type { Session } from '../types';

// Status symbols mirroring ReviewExport.tsx SYMBOLS.
// The symbol indicates session status; student/class color is shown by the surrounding UI.
// Orange = rescheduled, green = normal, red = cancelled.
// isSource days (where a class was moved FROM) no longer get a marker — render nothing.
export function SessionSymbol({ session, isSource }: { session: Session; isSource?: boolean }): ReactElement {
  if (isSource) {
    return <></>;
  }
  if (session.status === 'cancelled' || session.status === 'no-show') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none">
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    );
  }
  if (session.movedFromDate && session.movedFromDate !== session.plannedDate) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill="#f97316" />
      </svg>
    );
  }
  if (session.movedFromTime && session.movedFromTime !== session.plannedTime) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="8" x2="8" y2="5" />
        <line x1="8" y1="8" x2="11" y2="8" />
      </svg>
    );
  }
  if (session.isAdditional) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" fill="none">
        <line x1="8" y1="4" x2="8" y2="12" />
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    );
  }
  if (session.status === 'completed') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill="#22c55e" />
      </svg>
    );
  }
  // Scheduled, holiday, etc. — hollow outline
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" stroke="#3b82f6" strokeWidth="2" fill="none">
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}
