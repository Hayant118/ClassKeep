// src/components/BillingView.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingUp, Calendar, CreditCard, Users } from 'lucide-react';
import { useSessions } from '../hooks/useSessions';
import { useEnrollments } from '../hooks/useEnrollments';
import { usePayments } from '../hooks/usePayments';
import { useBilling } from '../hooks/useBilling';
import type { Session, Class, Student } from '../types';
import type { BillingPeriod } from '../utils/billing';
import {
  formatCurrency,
  formatCurrencyCompact,
  getPeriods,
  getSessionCharge,
  isDateInPeriod,
} from '../utils/billing';

interface BillingViewProps {
  sessions?: Session[];
  classes: Class[];
  students: Student[];
}

type TabKey = 'overview' | 'students' | 'classes';
type TimeRange = 'monthly' | 'quarterly' | 'yearly';
type ChartType = 'line' | 'bar' | 'area';

const CHART_COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtext?: string;
}

function SummaryCard({ icon, label, value, subtext }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
          {icon}
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
          {subtext && <div className="text-xs text-slate-500 dark:text-gray-400">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}

function getStudentClassIds(studentId: string, enrollments: Array<{ studentId: string; classId: string }>) {
  return enrollments.filter((e) => e.studentId === studentId).map((e) => e.classId);
}

function sessionBelongsToStudent(
  session: Session,
  studentId: string,
  classIds: string[]
): boolean {
  return session.studentId === studentId || (!!session.classId && classIds.includes(session.classId));
}

function getStudentIncomeInPeriod(
  studentId: string,
  sessions: Session[],
  enrollments: Array<{ studentId: string; classId: string }>,
  period: BillingPeriod
) {
  const classIds = getStudentClassIds(studentId, enrollments);
  return sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        sessionBelongsToStudent(s, studentId, classIds) &&
        isDateInPeriod(s.actualDate || s.plannedDate, period)
    )
    .reduce((sum, s) => sum + getSessionCharge(s), 0);
}

function getStudentSessionCount(
  studentId: string,
  status: Session['status'],
  sessions: Session[],
  enrollments: Array<{ studentId: string; classId: string }>
) {
  const classIds = getStudentClassIds(studentId, enrollments);
  return sessions.filter((s) => s.status === status && sessionBelongsToStudent(s, studentId, classIds)).length;
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-2 shadow-sm">
        <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percent?: number } }> }) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const percent = p.payload.percent ? Math.round(p.payload.percent * 100) : 0;
    return (
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-2 shadow-sm">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          {formatCurrency(p.value)} ({percent}%)
        </p>
      </div>
    );
  }
  return null;
}

function StudentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { month: string } }> }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-2 shadow-sm">
        <p className="text-xs text-slate-500 dark:text-gray-400">{payload[0].payload.month}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

export function BillingView({ sessions: sessionsProp, classes, students }: BillingViewProps) {
  const { sessions: fetchedSessions, loading: sessionsLoading, error: sessionsError } = useSessions();
  const { enrollments, loading: enrollmentsLoading } = useEnrollments();
  const { payments, fetchPayments, loading: paymentsLoading } = usePayments();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const sessions = sessionsProp ?? fetchedSessions;

  const { summary, studentMetrics, classMetrics, monthlyIncome, quarterlyIncome, yearlyIncome } =
    useBilling(sessions, students, classes, enrollments, payments);

  const trendData = useMemo(() => {
    if (timeRange === 'monthly') {
      return monthlyIncome.slice(-12).map((item) => ({ label: item.month, income: item.income }));
    }
    if (timeRange === 'quarterly') {
      return quarterlyIncome.slice(-12).map((item) => ({ label: item.quarter, income: item.income }));
    }
    return yearlyIncome.slice(-12).map((item) => ({ label: item.year, income: item.income }));
  }, [timeRange, monthlyIncome, quarterlyIncome, yearlyIncome]);

  const pieData = useMemo(() => {
    const periods = getPeriods();
    const period = timeRange === 'monthly' ? periods.month : timeRange === 'quarterly' ? periods.quarter : periods.year;
    return students
      .map((student) => {
        const income = getStudentIncomeInPeriod(student.id, sessions, enrollments, period);
        return {
          name: student.name,
          value: income,
          color: student.color,
        };
      })
      .filter((d) => d.value > 0);
  }, [timeRange, sessions, students, enrollments]);

  const selectedStudent = useMemo(
    () => studentMetrics.find((m) => m.studentId === selectedStudentId) || null,
    [studentMetrics, selectedStudentId]
  );

  const isLoading = sessionsLoading || enrollmentsLoading || paymentsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400">Loading billing data...</div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
        Error loading sessions: {sessionsError}
      </div>
    );
  }

  const tabButtonClass = (tab: TabKey) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'bg-indigo-600 text-white'
        : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
    }`;

  const toggleButtonClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Billing</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400">Income tracking and analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          icon={<DollarSign className="w-5 h-5" />}
          label="This Month"
          value={formatCurrency(summary.totalIncomeThisMonth)}
          subtext="Completed sessions"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="This Quarter"
          value={formatCurrency(summary.totalIncomeThisQuarter)}
        />
        <SummaryCard
          icon={<Calendar className="w-5 h-5" />}
          label="Total Sessions"
          value={summary.totalSessions}
          subtext={`${summary.completedSessions} completed, ${summary.cancelledSessions} cancelled`}
        />
        <SummaryCard
          icon={<CreditCard className="w-5 h-5" />}
          label="Prepaid Balance Outstanding"
          value={formatCurrency(summary.outstandingPrepaid)}
        />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveTab('overview')} className={tabButtonClass('overview')}>
          Overview
        </button>
        <button type="button" onClick={() => setActiveTab('students')} className={tabButtonClass('students')}>
          Students
        </button>
        <button type="button" onClick={() => setActiveTab('classes')} className={tabButtonClass('classes')}>
          Classes
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              {(['monthly', 'quarterly', 'yearly'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={toggleButtonClass(timeRange === r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              {(['line', 'bar', 'area'] as ChartType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartType(t)}
                  className={toggleButtonClass(chartType === t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
              No income data for the selected period.
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Income Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                {chartType === 'line' ? (
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip content={<TrendTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#6366f1' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip content={<TrendTooltip />} />
                    <Bar dataKey="income" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip content={<TrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {pieData.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
              No student income data for the selected period.
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Income by Student</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {selectedStudent ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                ← Back to students
              </button>

              {(() => {
                const periods = getPeriods();
                const thisMonth = getStudentIncomeInPeriod(selectedStudent.studentId, sessions, enrollments, periods.month);
                const thisQuarter = getStudentIncomeInPeriod(selectedStudent.studentId, sessions, enrollments, periods.quarter);
                const thisYear = getStudentIncomeInPeriod(selectedStudent.studentId, sessions, enrollments, periods.year);
                const completedCount = getStudentSessionCount(selectedStudent.studentId, 'completed', sessions, enrollments);
                const cancelledCount = getStudentSessionCount(selectedStudent.studentId, 'cancelled', sessions, enrollments);
                const studentEnrollments = enrollments.filter((e) => e.studentId === selectedStudent.studentId);
                const prepaidBalance = studentEnrollments
                  .filter((e) => e.paymentType === 'prepaid')
                  .reduce((sum, e) => sum + e.prepaidBalance, 0);

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedStudent.color || '#6366f1' }}
                      />
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedStudent.studentName}</h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <SummaryCard icon={<DollarSign className="w-5 h-5" />} label="This Month" value={formatCurrency(thisMonth)} />
                      <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="This Quarter" value={formatCurrency(thisQuarter)} />
                      <SummaryCard icon={<Calendar className="w-5 h-5" />} label="This Year" value={formatCurrency(thisYear)} />
                      <SummaryCard icon={<CreditCard className="w-5 h-5" />} label="All Time" value={formatCurrency(selectedStudent.income)} />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-gray-400">Completed</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{completedCount}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-gray-400">Cancelled</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{cancelledCount}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-gray-400">Avg Rate</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(selectedStudent.averageRate)}</div>
                      </div>
                    </div>

                    {prepaidBalance > 0 && (
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                        Prepaid balance outstanding: {formatCurrency(prepaidBalance)}
                      </div>
                    )}

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">6-Month Trend</h3>
                      {selectedStudent.trend.every((t) => t.income === 0) ? (
                        <div className="p-8 text-center text-slate-500 dark:text-gray-400">No recent income data.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={selectedStudent.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                            <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                            <Tooltip content={<StudentTooltip />} />
                            <Bar dataKey="income" fill={selectedStudent.color || '#6366f1'} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : studentMetrics.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
              <Users className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-gray-400">No students yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studentMetrics.map((metric) => {
                const periods = getPeriods();
                const thisMonthIncome = getStudentIncomeInPeriod(metric.studentId, sessions, enrollments, periods.month);
                const hasPrepaid = enrollments.some(
                  (e) => e.studentId === metric.studentId && e.paymentType === 'prepaid'
                );

                return (
                  <button
                    key={metric.studentId}
                    type="button"
                    onClick={() => setSelectedStudentId(metric.studentId)}
                    className="text-left bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: metric.color || '#6366f1' }}
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">{metric.studentName}</span>
                      {hasPrepaid && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Prepaid
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">This Month</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatCurrencyCompact(thisMonthIncome)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">Sessions</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{metric.sessionCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">Avg Rate</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatCurrencyCompact(metric.averageRate)}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 dark:text-gray-400">
                      All-time income: {formatCurrency(metric.income)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {classMetrics.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
              <Calendar className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-gray-400">No classes yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classMetrics.map((metric) => {
                const studentCount = enrollments.filter((e) => e.classId === metric.classId).length;
                return (
                  <div
                    key={metric.classId}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: metric.color || '#6366f1' }}
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">{metric.className}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">Total Income</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatCurrencyCompact(metric.income)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">Sessions</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{metric.sessionCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">Students</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{studentCount}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
