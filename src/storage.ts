import type { Student, Class, Enrollment, Session, Attendance, CalendarPreferences } from './types';

const STORAGE_KEYS = {
  students: 'classkeep_students',
  classes: 'classkeep_classes',
  enrollments: 'classkeep_enrollments',
  sessions: 'classkeep_sessions',
  attendance: 'classkeep_attendance',
  preferences: 'classkeep_preferences',
} as const;

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getItems<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function setItems<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function createItem<T extends { id: string }>(
  key: string,
  item: Omit<T, 'id'>
): T {
  const items = getItems<T>(key);
  const newItem = { ...item, id: generateId() } as T;
  setItems(key, [...items, newItem]);
  return newItem;
}

function getAllItems<T>(key: string): T[] {
  return getItems<T>(key);
}

function getItemById<T extends { id: string }>(key: string, id: string): T | null {
  return getItems<T>(key).find((item) => item.id === id) ?? null;
}

function updateItem<T extends { id: string }>(
  key: string,
  id: string,
  updates: Partial<Omit<T, 'id'>>
): T | null {
  const items = getItems<T>(key);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = { ...items[index], ...updates } as T;
  items[index] = updated;
  setItems(key, items);
  return updated;
}

function deleteItem<T extends { id: string }>(key: string, id: string): boolean {
  const items = getItems<T>(key);
  const filtered = items.filter((item) => item.id !== id);
  if (filtered.length === items.length) return false;
  setItems(key, filtered);
  return true;
}

// Students
export function createStudent(
  student: Omit<Student, 'id' | 'createdAt' | 'timezone' | 'color'> & {
    timezone?: string;
    color?: string;
  }
): Student {
  return createItem<Student>(STORAGE_KEYS.students, {
    ...student,
    timezone: student.timezone || 'Asia/Shanghai',
    color: student.color || getNextStudentColor(),
    createdAt: new Date().toISOString(),
  });
}

export function getStudents(): Student[] {
  return getAllItems<Student>(STORAGE_KEYS.students);
}

export function getStudentById(id: string): Student | null {
  return getItemById<Student>(STORAGE_KEYS.students, id);
}

export function updateStudent(id: string, updates: Partial<Omit<Student, 'id'>>): Student | null {
  return updateItem<Student>(STORAGE_KEYS.students, id, updates);
}

export function deleteStudent(id: string): boolean {
  return deleteItem<Student>(STORAGE_KEYS.students, id);
}

// Classes
export function createClass(cls: Omit<Class, 'id'>): Class {
  return createItem<Class>(STORAGE_KEYS.classes, cls);
}

export function getClasses(): Class[] {
  return getAllItems<Class>(STORAGE_KEYS.classes);
}

export function getClassById(id: string): Class | null {
  return getItemById<Class>(STORAGE_KEYS.classes, id);
}

export function updateClass(id: string, updates: Partial<Omit<Class, 'id'>>): Class | null {
  return updateItem<Class>(STORAGE_KEYS.classes, id, updates);
}

export function deleteClass(id: string): boolean {
  return deleteItem<Class>(STORAGE_KEYS.classes, id);
}

// Enrollments
export function createEnrollment(enrollment: Omit<Enrollment, 'id'>): Enrollment {
  return createItem<Enrollment>(STORAGE_KEYS.enrollments, enrollment);
}

export function getEnrollments(): Enrollment[] {
  return getAllItems<Enrollment>(STORAGE_KEYS.enrollments);
}

export function getEnrollmentById(id: string): Enrollment | null {
  return getItemById<Enrollment>(STORAGE_KEYS.enrollments, id);
}

export function updateEnrollment(
  id: string,
  updates: Partial<Omit<Enrollment, 'id'>>
): Enrollment | null {
  return updateItem<Enrollment>(STORAGE_KEYS.enrollments, id, updates);
}

export function deleteEnrollment(id: string): boolean {
  return deleteItem<Enrollment>(STORAGE_KEYS.enrollments, id);
}

// Sessions
export function createSession(session: Omit<Session, 'id'>): Session {
  return createItem<Session>(STORAGE_KEYS.sessions, session);
}

export function getSessions(): Session[] {
  return getAllItems<Session>(STORAGE_KEYS.sessions);
}

export function getSessionById(id: string): Session | null {
  return getItemById<Session>(STORAGE_KEYS.sessions, id);
}

export function updateSession(id: string, updates: Partial<Omit<Session, 'id'>>): Session | null {
  return updateItem<Session>(STORAGE_KEYS.sessions, id, updates);
}

export function deleteSession(id: string): boolean {
  return deleteItem<Session>(STORAGE_KEYS.sessions, id);
}

// Attendance
export function createAttendance(attendance: Omit<Attendance, 'id'>): Attendance {
  return createItem<Attendance>(STORAGE_KEYS.attendance, attendance);
}

export function getAttendance(): Attendance[] {
  return getAllItems<Attendance>(STORAGE_KEYS.attendance);
}

export function getAttendanceById(id: string): Attendance | null {
  return getItemById<Attendance>(STORAGE_KEYS.attendance, id);
}

export function updateAttendance(
  id: string,
  updates: Partial<Omit<Attendance, 'id'>>
): Attendance | null {
  return updateItem<Attendance>(STORAGE_KEYS.attendance, id, updates);
}

export function deleteAttendance(id: string): boolean {
  return deleteItem<Attendance>(STORAGE_KEYS.attendance, id);
}

// Preferences
export const DEFAULT_STUDENT_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#84cc16',
];

function getNextStudentColor(): string {
  const students = getStudents();
  return DEFAULT_STUDENT_COLORS[students.length % DEFAULT_STUDENT_COLORS.length];
}

export const DEFAULT_PREFERENCES: CalendarPreferences = {
  id: '',
  userId: '',
  colorConfirmed: '#22c55e',
  colorMoved: '#f97316',
  colorCancelled: '#6b7280',
  colorDraft: '#3b82f6',
  colorConflict: '#ef4444',
  calendarStartTime: '08:00:00',
  calendarEndTime: '22:00:00',
  calendarSlotMinutes: 30,
  updatedAt: new Date().toISOString(),
};

export function getPreferences(): CalendarPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.preferences);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<CalendarPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: CalendarPreferences): void {
  localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
}

export function resetPreferences(): CalendarPreferences {
  localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(DEFAULT_PREFERENCES));
  return DEFAULT_PREFERENCES;
}
