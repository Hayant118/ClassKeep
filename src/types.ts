// src/types.ts
export interface Student {
  id: string;
  userId: string;
  name: string;
  contact: string;
  defaultRate: number;
  timezone: string;
  color?: string;
  notes: string;
  createdAt: string;
}

export interface Class {
  id: string;
  userId: string;
  name: string;
  type: 'one-on-one' | 'group';
  maxCapacity: number;
  color?: string;
  textbook: string;
  currentUnit: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  joinedAt: string;
  leftAt: string | null;
  customRate: number | null;
  paymentType: 'prepaid' | 'monthly_advance' | 'on_completion';
  prepaidBalance: number;
  status: 'active' | 'paused' | 'dropped';
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  classId: string;
  plannedDate: string;      // YYYY-MM-DD
  plannedTime: string;      // HH:MM
  actualDate: string | null;
  actualTime: string | null;
  durationMinutes: number;
  rateMode: 'auto' | 'override' | 'flat';
  rateValue: number | null;
  totalCharge: number | null;
  status: 'scheduled' | 'completed' | 'moved' | 'cancelled' | 'holiday' | 'no-show';
  movedFromDate: string | null;
  movedFromTime: string | null;
  isAdditional?: boolean;
  isCatchUp?: boolean;
  isOnline?: boolean;
  notes: string;
  createdAt: string;
}

// src/types.ts — update CalendarPreferences
export interface CalendarPreferences {
  id: string;
  userId: string;
  colorConfirmed: string;
  colorMoved: string;
  colorCancelled: string;
  colorDraft: string;
  colorConflict: string;
  calendarStartTime: string;   // was timeScale.startTime
  calendarEndTime: string;     // was timeScale.endTime
  calendarSlotMinutes: number; // was timeScale.slotMinutes
  updatedAt: string;
}

export interface Attendance {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  userId: string;
  title: string;
  status: 'draft' | 'committed' | 'sent' | 'accepted' | 'rejected' | 'archived';
  draftSessions: Record<string, unknown>[];
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  enrollmentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

// Helper type for sessions with overlap flag
export interface SessionWithOverlap extends Session {
  hasOverlap: boolean;
}