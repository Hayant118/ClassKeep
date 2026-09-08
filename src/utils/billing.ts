// src/utils/billing.ts
import { format, parseISO } from 'date-fns';
import type { Enrollment, Session, Student } from '../types';

export interface BillingPeriod {
  startDate: Date;
  endDate: Date;
}

export interface StudentBillingMetrics {
  studentId: string;
  studentName: string;
  color?: string;
  income: number;
  sessionCount: number;
  hours: number;
  averageRate: number;
  trend: { month: string; income: number }[];
}

export interface MonthlyIncome {
  month: string;
  income: number;
  sessionCount: number;
}

export interface QuarterlyIncome {
  quarter: string;
  income: number;
  sessionCount: number;
}

export interface YearlyIncome {
  year: string;
  income: number;
  sessionCount: number;
}

function getSessionDateStr(session: Session): string | null {
  return session.actualDate || session.plannedDate || null;
}

function getMonthKey(session: Session): string | null {
  const dateStr = getSessionDateStr(session);
  return dateStr ? dateStr.slice(0, 7) : null;
}

function getQuarterKey(session: Session): string | null {
  const dateStr = getSessionDateStr(session);
  if (!dateStr) return null;
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

function getYearKey(session: Session): string | null {
  const dateStr = getSessionDateStr(session);
  return dateStr ? dateStr.slice(0, 4) : null;
}

export function getPeriods(): {
  month: BillingPeriod;
  quarter: BillingPeriod;
  year: BillingPeriod;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return {
    month: {
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
    },
    quarter: {
      startDate: new Date(year, Math.floor(month / 3) * 3, 1),
      endDate: new Date(year, Math.floor(month / 3) * 3 + 3, 0, 23, 59, 59, 999),
    },
    year: {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31, 23, 59, 59, 999),
    },
  };
}

export function isDateInPeriod(dateStr: string, period: BillingPeriod): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const startStr = format(period.startDate, 'yyyy-MM-dd');
  const endStr = format(period.endDate, 'yyyy-MM-dd');
  return dateStr >= startStr && dateStr <= endStr;
}

export function parseSessionDate(session: Session): Date | null {
  const dateStr = session.actualDate || session.plannedDate;
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Same rate logic as proposal billing: guest sessions bill guestRate
// hourly; 'flat' is a fixed per-session charge; 'override' bills rateValue
// hourly; 'auto' bills the active enrollment's customRate, falling back to
// the student's defaultRate, hourly.
export function resolveSessionCharge(
  session: Session,
  students: Student[],
  enrollments: Enrollment[]
): number {
  const hours = session.durationMinutes / 60;
  if (session.guestName) {
    return (session.guestRate ?? 0) * hours;
  }
  if (session.rateMode === 'flat' && session.rateValue != null) {
    return session.rateValue;
  }
  let student: Student | undefined;
  if (session.studentId) {
    student = students.find((s) => s.id === session.studentId);
  }
  let enrollment: Enrollment | undefined;
  if (session.classId) {
    enrollment = enrollments.find(
      (e) =>
        e.classId === session.classId &&
        e.status === 'active' &&
        (!student || e.studentId === student.id)
    );
    if (!student && enrollment) {
      student = students.find((s) => s.id === enrollment!.studentId);
    }
  }
  if (session.rateMode === 'override' && session.rateValue != null) {
    return session.rateValue * hours;
  }
  if (student) {
    const hourly = enrollment?.customRate ?? student.defaultRate ?? 0;
    const computed = hourly * hours;
    if (computed === 0 && session.totalCharge != null) {
      return session.totalCharge;
    }
    return computed;
  }
  return session.totalCharge ?? 0;
}

export function calculateMonthlyIncome(sessions: Session[], students: Student[], enrollments: Enrollment[]): MonthlyIncome[] {
  const map = new Map<string, { income: number; sessionCount: number }>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const key = getMonthKey(session);
    if (!key) continue;
    const charge = resolveSessionCharge(session, students, enrollments);
    const current = map.get(key) ?? { income: 0, sessionCount: 0 };
    current.income += charge;
    current.sessionCount += 1;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function calculateQuarterlyIncome(sessions: Session[], students: Student[], enrollments: Enrollment[]): QuarterlyIncome[] {
  const map = new Map<string, { income: number; sessionCount: number }>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const key = getQuarterKey(session);
    if (!key) continue;
    const charge = resolveSessionCharge(session, students, enrollments);
    const current = map.get(key) ?? { income: 0, sessionCount: 0 };
    current.income += charge;
    current.sessionCount += 1;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([quarter, data]) => ({ quarter, ...data }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export function calculateYearlyIncome(sessions: Session[], students: Student[], enrollments: Enrollment[]): YearlyIncome[] {
  const map = new Map<string, { income: number; sessionCount: number }>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const key = getYearKey(session);
    if (!key) continue;
    const charge = resolveSessionCharge(session, students, enrollments);
    const current = map.get(key) ?? { income: 0, sessionCount: 0 };
    current.income += charge;
    current.sessionCount += 1;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  if (amount === 0) return '¥0';
  if (amount >= 10_000) {
    return `¥${(amount / 10_000).toFixed(1)}w`;
  }
  if (amount >= 1_000) {
    return `¥${(amount / 1_000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
}
