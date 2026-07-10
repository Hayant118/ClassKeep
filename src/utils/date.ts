export const DEFAULT_START_TIME = '08:00';
export const DEFAULT_END_TIME = '22:00';
export const DEFAULT_SLOT_MINUTES = 30;

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function formatTimeRange(startTime: string, durationMinutes: number): string {
  const endTime = addMinutes(startTime, durationMinutes);
  return `${startTime} - ${endTime}`;
}

export function getTimeSlots(
  startTime = DEFAULT_START_TIME,
  endTime = DEFAULT_END_TIME,
  slotMinutes = DEFAULT_SLOT_MINUTES
): string[] {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
    console.warn('[ClassKeep] Invalid time scale for slots.', { startTime, endTime, slotMinutes });
    return [];
  }

  const slots: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += slotMinutes) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

export function getSlotIndex(
  time: string,
  startTime = DEFAULT_START_TIME,
  slotMinutes = DEFAULT_SLOT_MINUTES
): number {
  const minutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  if (isNaN(minutes)) {
    console.warn('[ClassKeep] Invalid time passed to getSlotIndex.', { time, startTime, slotMinutes });
    return 0;
  }
  return (minutes - startMinutes) / slotMinutes;
}

/**
 * Calculate the vertical position (as a percentage of the calendar height)
 * for a session that starts at `time` and lasts `durationMinutes`.
 * The result is clipped to the visible calendar bounds.
 */
export function getSessionPosition(
  time: string,
  durationMinutes: number,
  startTime: string,
  endTime: string
): { top: number; height: number } {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalMinutes = endMinutes - startMinutes;

  if (totalMinutes <= 0) {
    return { top: 0, height: 0 };
  }

  const sessionStart = timeToMinutes(time);
  const sessionEnd = sessionStart + durationMinutes;

  const visibleStart = Math.max(startMinutes, sessionStart);
  const visibleEnd = Math.min(endMinutes, sessionEnd);

  if (visibleEnd <= visibleStart) {
    return { top: 0, height: 0 };
  }

  return {
    top: ((visibleStart - startMinutes) / totalMinutes) * 100,
    height: ((visibleEnd - visibleStart) / totalMinutes) * 100,
  };
}

/**
 * Convert a click Y-coordinate within the calendar body into a time string.
 * `y` is relative to the top of the calendar body and `height` is its total height.
 */
export function getTimeFromClickY(
  y: number,
  height: number,
  startTime: string,
  endTime: string,
  roundMinutes = 5
): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalMinutes = endMinutes - startMinutes;

  if (height <= 0 || totalMinutes <= 0) {
    return startTime;
  }

  const ratio = Math.max(0, Math.min(1, y / height));
  const rawMinutes = startMinutes + ratio * totalMinutes;
  const rounded = Math.round(rawMinutes / roundMinutes) * roundMinutes;
  const clamped = Math.max(startMinutes, Math.min(endMinutes - roundMinutes, rounded));
  return minutesToTime(clamped);
}

export function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour: isNaN(hour) ? 0 : hour, minute: isNaN(minute) ? 0 : minute };
}
