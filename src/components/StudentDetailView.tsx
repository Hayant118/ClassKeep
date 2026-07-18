// src/components/StudentDetailView.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { useEnrollments } from '../hooks/useEnrollments';
import { useSessions } from '../hooks/useSessions';
import { usePayments } from '../hooks/usePayments';
import { SessionModal } from './SessionModal';
import type { Student, Class, Enrollment, Session } from '../types';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'courseware', label: 'Courseware' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'payments', label: 'Payments' },
] as const;

type Tab = (typeof TABS)[number]['key'];

const COLOR_OPTIONS = [
  '#6366f1',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

const PAYMENT_METHODS = ['WeChat', 'Alipay', 'Cash', 'Bank Transfer', 'Other'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function getSessionCharge(session: Session): number {
  return session.totalCharge ?? 0;
}

function getEnrollmentRate(enrollment: Enrollment, student: Student): number {
  return enrollment.customRate ?? student.defaultRate ?? 0;
}

function statusBadge(status: Session['status']) {
  const styles: Record<Session['status'], string> = {
    scheduled: 'bg-slate-100 text-slate-700',
    completed: 'bg-emerald-100 text-emerald-700',
    moved: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    holiday: 'bg-blue-100 text-blue-700',
    'no-show': 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function paymentTypeLabel(type: Enrollment['paymentType']) {
  const labels: Record<Enrollment['paymentType'], string> = {
    prepaid: 'Prepaid',
    monthly_advance: 'Monthly Advance',
    on_completion: 'On Completion',
  };
  return labels[type];
}

export function StudentDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { students, loading: studentsLoading, updateStudent } = useStudents();
  const { classes, loading: classesLoading, updateClass } = useClasses();
  const { enrollments, loading: enrollmentsLoading, updateEnrollment, fetchEnrollments } = useEnrollments();
  const { sessions, loading: sessionsLoading, updateSession, deleteSession, addSession } = useSessions();
  const { payments, loading: paymentsLoading, fetchPayments, insertPayment } = usePayments();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Session modal state
  const [selectedSession, setSelectedSession] = useState<Session | undefined>();
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentEnrollmentId, setPaymentEnrollmentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const student = useMemo(() => students.find((s) => s.id === id), [students, id]);
  const studentEnrollments = useMemo(
    () => enrollments.filter((e) => e.studentId === id),
    [enrollments, id]
  );
  const enrollmentIds = useMemo(
    () => studentEnrollments.map((e) => e.id),
    [studentEnrollments]
  );
  const enrollmentIdsKey = enrollmentIds.join(',');

  useEffect(() => {
    if (enrollmentIds.length > 0) {
      fetchPayments(enrollmentIds);
    }
  }, [enrollmentIdsKey, enrollmentIds.length, enrollmentIds, fetchPayments]);

  const studentSessions = useMemo(() => {
    const classIds = new Set(studentEnrollments.map((e) => e.classId));
    return sessions
      .filter((s) => classIds.has(s.classId ?? '') || s.studentId === student?.id)
      .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) || a.plannedTime.localeCompare(b.plannedTime));
  }, [sessions, studentEnrollments, student]);

  const upcomingSessions = useMemo(
    () => studentSessions.filter((s) => s.plannedDate >= todayStr()),
    [studentSessions]
  );

  const getClass = (classId: string | undefined): Class | undefined =>
    classId ? classes.find((c) => c.id === classId) : undefined;

  const getSessionLabel = (session: Session): string => {
    if (session.classId) return getClass(session.classId)?.name ?? 'Class';
    return 'Individual';
  };

  const handleUpdateStudent = async (updates: Partial<Student>) => {
    if (!student) return;
    try {
      await updateStudent(student.id, updates);
      toast.success('Student updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update student');
    }
  };

  const handleUpdateClass = async (classId: string, updates: Partial<Class>) => {
    try {
      await updateClass(classId, updates);
      toast.success('Courseware updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update class');
    }
  };

  const openPaymentModal = (enrollmentId?: string) => {
    setPaymentEnrollmentId(enrollmentId || studentEnrollments[0]?.id || '');
    setPaymentAmount('');
    setPaymentDate(todayStr());
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentNotes('');
    setPaymentModalOpen(true);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEnrollmentId) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await insertPayment({
        enrollmentId: paymentEnrollmentId,
        amount,
        paymentDate,
        paymentMethod,
        notes: paymentNotes.trim(),
      });

      const enrollment = studentEnrollments.find((e) => e.id === paymentEnrollmentId);
      if (enrollment && enrollment.paymentType === 'prepaid') {
        await updateEnrollment(paymentEnrollmentId, {
          prepaidBalance: enrollment.prepaidBalance + amount,
        });
      }

      toast.success('Payment recorded');
      setPaymentModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const openSessionModal = (session?: Session) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const handleSessionUpdate = async (sessionId: string, updates: Partial<Session>) => {
    try {
      await updateSession(sessionId, updates);
      await fetchEnrollments();
      toast.success('Session updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const handleSessionSave = async (session: Omit<Session, 'id' | 'userId' | 'createdAt'>) => {
    try {
      await addSession(session);
      await fetchEnrollments();
      toast.success('Session created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      toast.success('Session deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  if (studentsLoading || classesLoading || enrollmentsLoading || sessionsLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-slate-500">Student not found</div>
        <button
          onClick={() => navigate('/students')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Back to Students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/students')}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            ← Back
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-2 ring-slate-200"
              style={{ backgroundColor: student.color || '#6366f1' }}
              aria-label="Change color"
            />
            {showColorPicker && (
              <div className="absolute top-10 left-0 z-20 bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex flex-wrap gap-2 w-40">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      handleUpdateStudent({ color });
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full border border-slate-200"
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            defaultValue={student.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value.trim() !== student.name) {
                handleUpdateStudent({ name: e.target.value.trim() });
              }
            }}
            className="text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1"
          />
        </div>

        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                <input
                  type="text"
                  defaultValue={student.contact}
                  onBlur={(e) => handleUpdateStudent({ contact: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Rate</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={student.defaultRate}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) handleUpdateStudent({ defaultRate: value });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                <input
                  type="text"
                  defaultValue={student.timezone}
                  onBlur={(e) => handleUpdateStudent({ timezone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  defaultValue={student.notes}
                  onBlur={(e) => handleUpdateStudent({ notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Enrollments</h2>
            {studentEnrollments.length === 0 ? (
              <p className="text-sm text-slate-500">No enrollments yet.</p>
            ) : (
              <div className="space-y-4">
                {studentEnrollments.map((enrollment) => {
                  const cls = getClass(enrollment.classId);
                  const rate = getEnrollmentRate(enrollment, student);
                  const lowBalance =
                    enrollment.paymentType === 'prepaid' && rate > 0 && enrollment.prepaidBalance < 2 * rate;
                  return (
                    <div
                      key={enrollment.id}
                      className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{cls?.name || 'Unknown class'}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          {paymentTypeLabel(enrollment.paymentType)} • Rate: {formatCurrency(rate)}
                        </div>
                        {enrollment.paymentType === 'prepaid' && (
                          <div className="text-sm mt-1">
                            Balance:{' '}
                            <span className={enrollment.prepaidBalance < 0 ? 'text-red-600 font-medium' : 'font-medium'}>
                              {formatCurrency(enrollment.prepaidBalance)}
                            </span>
                          </div>
                        )}
                        {lowBalance && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                            Low balance — less than 2 sessions remaining
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            enrollment.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : enrollment.status === 'paused'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {enrollment.status}
                        </span>
                        <button
                          onClick={() => setActiveTab('payments')}
                          className="text-sm text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                          Payments
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {upcomingSessions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Up Next</h2>
              <div className="space-y-3">
                {upcomingSessions.slice(0, 3).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => openSessionModal(session)}
                    className="w-full text-left border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900">
                        {formatDate(session.plannedDate)} {session.plannedTime}
                      </div>
                      {statusBadge(session.status)}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {getSessionLabel(session)} • {session.durationMinutes}m
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courseware */}
      {activeTab === 'courseware' && (
        <div className="space-y-6">
          {studentEnrollments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-slate-500">
              No enrollments yet.
            </div>
          ) : (
            studentEnrollments.map((enrollment) => {
              const cls = getClass(enrollment.classId);
              if (!cls) return null;
              return (
                <div
                  key={enrollment.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                >
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">{cls.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Textbook</label>
                      <input
                        type="text"
                        defaultValue={cls.textbook}
                        onBlur={(e) => handleUpdateClass(cls.id, { textbook: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Current Unit</label>
                      <input
                        type="text"
                        defaultValue={cls.currentUnit}
                        onBlur={(e) => handleUpdateClass(cls.id, { currentUnit: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Schedule */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Schedule</h2>
            <button
              onClick={() => openSessionModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add Session
            </button>
          </div>

          {studentSessions.length === 0 ? (
            <p className="text-slate-500 text-sm">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Class</th>
                    <th className="px-4 py-2 text-left font-medium">Duration</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentSessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() => openSessionModal(session)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(session.plannedDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{session.plannedTime}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getSessionLabel(session)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{session.durationMinutes}m</td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(session.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {session.totalCharge != null ? formatCurrency(session.totalCharge) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {studentEnrollments.map((enrollment) => {
            const cls = getClass(enrollment.classId);
            const rate = getEnrollmentRate(enrollment, student);
            const enrollmentPayments = payments.filter((p) => p.enrollmentId === enrollment.id);
            const totalPaid = enrollmentPayments.reduce((sum, p) => sum + p.amount, 0);
            const completedSessions = studentSessions.filter(
              (s) => s.classId === enrollment.classId && s.status === 'completed'
            );
            const totalCompletedCharge = completedSessions.reduce((sum, s) => sum + getSessionCharge(s), 0);
            const owed = totalCompletedCharge - totalPaid;
            const lowBalance = enrollment.paymentType === 'prepaid' && rate > 0 && enrollment.prepaidBalance < 2 * rate;

            return (
              <div key={enrollment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{cls?.name || 'Unknown class'}</h3>
                    <div className="text-sm text-slate-500">
                      {paymentTypeLabel(enrollment.paymentType)} • Rate: {formatCurrency(rate)}
                    </div>
                  </div>
                  <button
                    onClick={() => openPaymentModal(enrollment.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add Payment
                  </button>
                </div>

                {enrollment.paymentType === 'prepaid' && (
                  <div className="mb-4">
                    <div className="text-sm text-slate-500">Prepaid Balance</div>
                    <div
                      className={`text-3xl font-bold ${
                        enrollment.prepaidBalance < 0 ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(enrollment.prepaidBalance)}
                    </div>
                    {lowBalance && (
                      <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        Balance is below 2 sessions ({formatCurrency(2 * rate)}). Consider topping up.
                      </div>
                    )}
                  </div>
                )}

                {enrollment.paymentType === 'monthly_advance' && (
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-500">Monthly Rate</div>
                      <div className="text-xl font-semibold text-slate-900">{formatCurrency(rate)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Next Due</div>
                      <div className="text-xl font-semibold text-slate-900">
                        {enrollmentPayments.length > 0
                          ? formatDate(addOneMonth(enrollmentPayments[0].paymentDate))
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {enrollment.paymentType === 'on_completion' && (
                  <div className="mb-4">
                    <div className="text-sm text-slate-500">Total Owed (completed sessions)</div>
                    <div className={`text-3xl font-bold ${owed > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                      {formatCurrency(Math.max(0, owed))}
                    </div>
                  </div>
                )}

                <h4 className="text-sm font-semibold text-slate-700 mb-2">Payment History</h4>
                {enrollmentPayments.length === 0 ? (
                  <p className="text-sm text-slate-500">No payments recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Method</th>
                          <th className="px-3 py-2 text-left font-medium">Notes</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {enrollmentPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{payment.paymentMethod}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500">{payment.notes || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                              {formatCurrency(payment.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Record Payment</h2>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment</label>
                <select
                  value={paymentEnrollmentId}
                  onChange={(e) => setPaymentEnrollmentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {studentEnrollments.map((en) => {
                    const cls = getClass(en.classId);
                    return (
                      <option key={en.id} value={en.id}>
                        {cls?.name || 'Unknown class'} ({paymentTypeLabel(en.paymentType)})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Save Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        session={selectedSession}
        students={[student]}
        classes={studentEnrollments.map((e) => getClass(e.classId)).filter(Boolean) as Class[]}
        enrollments={studentEnrollments}
        onSave={handleSessionSave}
        onUpdate={handleSessionUpdate}
        onDelete={handleSessionDelete}
      />
    </div>
  );
}
