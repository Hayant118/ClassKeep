// src/hooks/useBilling.ts
import { useMemo } from 'react';
import type { Class, Enrollment, Payment, Session, Student } from '../types';
import {
  calculateMonthlyIncome,
  calculateQuarterlyIncome,
  calculateYearlyIncome,
  getPeriods,
  getSessionCharge,
  isDateInPeriod,
  parseSessionDate,
} from '../utils/billing';
import type {
  MonthlyIncome,
  QuarterlyIncome,
  StudentBillingMetrics,
  YearlyIncome,
} from '../utils/billing';

export interface ClassBillingMetrics {
  classId: string;
  className: string;
  color?: string;
  income: number;
  sessionCount: number;
  hours: number;
}

export interface BillingSummary {
  totalIncome: number;
  totalIncomeThisMonth: number;
  totalIncomeThisQuarter: number;
  totalIncomeThisYear: number;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  averageSessionRate: number;
  outstandingPrepaid: number;
}

export interface UseBillingResult {
  summary: BillingSummary;
  studentMetrics: StudentBillingMetrics[];
  classMetrics: ClassBillingMetrics[];
  monthlyIncome: MonthlyIncome[];
  quarterlyIncome: QuarterlyIncome[];
  yearlyIncome: YearlyIncome[];
}

function buildSixMonthTrend(sessions: Session[]): { month: string; income: number }[] {
  const now = new Date();
  const trend: { month: string; income: number }[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const income = sessions
      .filter((session) => {
        const date = parseSessionDate(session);
        if (!date) return false;
        const sessionMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return sessionMonth === monthKey;
      })
      .reduce((sum, session) => sum + getSessionCharge(session), 0);
    trend.push({ month: monthKey, income });
  }

  return trend;
}

export function useBilling(
  sessions: Session[],
  students: Student[],
  classes: Class[],
  enrollments: Enrollment[],
  _payments: Payment[]
): UseBillingResult {
  return useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const totalIncome = completedSessions.reduce(
      (sum, session) => sum + getSessionCharge(session),
      0
    );

    const periods = getPeriods();
    const totalIncomeThisMonth = completedSessions
      .filter((session) => {
        const dateStr = session.actualDate || session.plannedDate;
        return dateStr ? isDateInPeriod(dateStr, periods.month) : false;
      })
      .reduce((sum, session) => sum + getSessionCharge(session), 0);

    const totalIncomeThisQuarter = completedSessions
      .filter((session) => {
        const dateStr = session.actualDate || session.plannedDate;
        return dateStr ? isDateInPeriod(dateStr, periods.quarter) : false;
      })
      .reduce((sum, session) => sum + getSessionCharge(session), 0);

    const totalIncomeThisYear = completedSessions
      .filter((session) => {
        const dateStr = session.actualDate || session.plannedDate;
        return dateStr ? isDateInPeriod(dateStr, periods.year) : false;
      })
      .reduce((sum, session) => sum + getSessionCharge(session), 0);

    const totalSessions = sessions.length;
    const completedSessionsCount = completedSessions.length;
    const cancelledSessions = sessions.filter((s) => s.status === 'cancelled').length;
    const averageSessionRate = completedSessionsCount > 0 ? totalIncome / completedSessionsCount : 0;

    const outstandingPrepaid = enrollments
      .filter((enrollment) => enrollment.paymentType === 'prepaid')
      .reduce((sum, enrollment) => sum + enrollment.prepaidBalance, 0);

    const classMetrics: ClassBillingMetrics[] = classes.map((cls) => {
      const classSessions = completedSessions.filter((s) => s.classId === cls.id);
      const income = classSessions.reduce(
        (sum, session) => sum + getSessionCharge(session),
        0
      );
      const hours = classSessions.reduce(
        (sum, session) => sum + session.durationMinutes / 60,
        0
      );
      return {
        classId: cls.id,
        className: cls.name,
        color: cls.color,
        income,
        sessionCount: classSessions.length,
        hours,
      };
    });

    const studentMetrics: StudentBillingMetrics[] = students.map((student) => {
      const studentClassIds = enrollments
        .filter((enrollment) => enrollment.studentId === student.id)
        .map((enrollment) => enrollment.classId);
      const studentSessions = completedSessions.filter(
        (session) =>
          session.studentId === student.id ||
          (!!session.classId && studentClassIds.includes(session.classId))
      );
      const income = studentSessions.reduce(
        (sum, session) => sum + getSessionCharge(session),
        0
      );
      const hours = studentSessions.reduce(
        (sum, session) => sum + session.durationMinutes / 60,
        0
      );
      const sessionCount = studentSessions.length;
      const averageRate = sessionCount > 0 ? income / sessionCount : 0;

      return {
        studentId: student.id,
        studentName: student.name,
        color: student.color,
        income,
        sessionCount,
        hours,
        averageRate,
        trend: buildSixMonthTrend(studentSessions),
      };
    });

    const summary: BillingSummary = {
      totalIncome,
      totalIncomeThisMonth,
      totalIncomeThisQuarter,
      totalIncomeThisYear,
      totalSessions,
      completedSessions: completedSessionsCount,
      cancelledSessions,
      averageSessionRate,
      outstandingPrepaid,
    };

    return {
      summary,
      studentMetrics,
      classMetrics,
      monthlyIncome: calculateMonthlyIncome(completedSessions),
      quarterlyIncome: calculateQuarterlyIncome(completedSessions),
      yearlyIncome: calculateYearlyIncome(completedSessions),
    };
  }, [sessions, students, classes, enrollments]);
}
