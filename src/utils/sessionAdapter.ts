// src/utils/sessionAdapter.ts
import type { Session, Student, Class, Enrollment } from '../types';

export interface LegacySession {
  id: string;
  classId: string;
  studentId: string;
  plannedAt: string;
  actualAt: string | null;
  durationMinutes: number;
  rateMode: 'auto' | 'override' | 'flat';
  rateValue: number | null;
  totalCharge: number | null;
  status: Session['status'];
  movedFromAt: string | null;
  notes: string;
  hasOverlap?: boolean;
  studentName?: string;
  studentColor?: string;
}

export function toLegacySession(
  session: Session,
  classes: Class[],
  enrollments: Enrollment[],
  students: Student[]
): LegacySession {
  // Find the class
  const cls = classes.find(c => c.id === session.classId);
  
  // Find active enrollments for this class
  const classEnrollments = enrollments.filter(
    e => e.classId === session.classId && e.status === 'active'
  );
  
  // Get primary student (first active enrollment)
  const primaryEnrollment = classEnrollments[0];
  const primaryStudent = primaryEnrollment 
    ? students.find(s => s.id === primaryEnrollment.studentId)
    : undefined;
  
  // Build ISO datetime from date + time
  const plannedAt = `${session.plannedDate}T${session.plannedTime}`;
  const actualAt = session.actualDate && session.actualTime 
    ? `${session.actualDate}T${session.actualTime}` 
    : null;
  const movedFromAt = session.movedFromDate && session.movedFromTime
    ? `${session.movedFromDate}T${session.movedFromTime}`
    : null;

  return {
    id: session.id,
    classId: session.classId,
    studentId: primaryStudent?.id || '',
    plannedAt,
    actualAt,
    durationMinutes: session.durationMinutes,
    rateMode: session.rateMode,
    rateValue: session.rateValue,
    totalCharge: session.totalCharge,
    status: session.status,
    movedFromAt,
    notes: session.notes,
    studentName: primaryStudent?.name || cls?.name || 'Unknown',
    studentColor: '#6366f1', // Default indigo - no color in schema yet
  };
}