// src/components/StudentDetailView.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { useEnrollments } from '../hooks/useEnrollments';
import { useSessions } from '../hooks/useSessions';
import { usePayments } from '../hooks/usePayments';
import { useCurricula } from '../hooks/useCurricula';
import { useProgress } from '../hooks/useProgress';
import { SessionModal } from './SessionModal';
import type { Student, Class, Enrollment, Session, StudentCurriculum, CurriculumStatus } from '../types';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'courseware', label: 'Courseware' },
  { key: 'progress', label: 'Progress' },
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
    scheduled: 'bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300',
    completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    moved: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    holiday: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'no-show': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
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
  const { curricula, addCurriculum } = useCurricula();
  const { studentCurricula, classCurricula, lessonLogs, fetchStudentCurricula, fetchLessonLogs, addStudentCurriculum, updateStudentCurriculum } =
    useProgress();

  // Assign / edit curriculum modal state
  const NEW_CURRICULUM_VALUE = '__new__';
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<StudentCurriculum | null>(null);
  const [assignCurriculumId, setAssignCurriculumId] = useState('');
  const [newCurriculumTitle, setNewCurriculumTitle] = useState('');
  const [newCurriculumSubject, setNewCurriculumSubject] = useState('');
  const [assignCurrentPosition, setAssignCurrentPosition] = useState('');
  const [assignNextUp, setAssignNextUp] = useState('');
  const [assignStatus, setAssignStatus] = useState<CurriculumStatus>('active');

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

  useEffect(() => {
    if (!id) return;
    fetchStudentCurricula(id);
    fetchLessonLogs({ studentId: id });
  }, [id, fetchStudentCurricula, fetchLessonLogs]);

  const getCurriculumTitle = (curriculumId: string): string =>
    curricula.find((c) => c.id === curriculumId)?.title ?? 'Unknown curriculum';

  // Active individual curricula for this student…
  const activeStudentCurricula = useMemo(
    () => studentCurricula.filter((sc) => sc.studentId === id && sc.status === 'active'),
    [studentCurricula, id]
  );

  // …plus active group curricula from their enrolled classes (shown in blue).
  const activeClassCurricula = useMemo(() => {
    const enrolledClassIds = new Set(
      studentEnrollments.filter((e) => e.status === 'active').map((e) => e.classId)
    );
    return classCurricula.filter(
      (cc) => enrolledClassIds.has(cc.classId) && cc.status === 'active'
    );
  }, [classCurricula, studentEnrollments]);

  const recentLessonLogs = useMemo(
    () =>
      lessonLogs
        .filter((l) => l.studentId === id)
        .slice(0, 8),
    [lessonLogs, id]
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

  const openAssignModal = () => {
    const unassigned = curricula.find(
      (c) => !studentCurricula.some((sc) => sc.curriculumId === c.id)
    );
    setEditingCurriculum(null);
    // Empty library defaults to the "create new curriculum" path.
    setAssignCurriculumId(unassigned?.id ?? (curricula.length === 0 ? NEW_CURRICULUM_VALUE : ''));
    setNewCurriculumTitle('');
    setNewCurriculumSubject('');
    setAssignCurrentPosition('');
    setAssignNextUp('');
    setAssignStatus('active');
    setAssignModalOpen(true);
  };

  const openEditCurriculum = (sc: StudentCurriculum) => {
    setEditingCurriculum(sc);
    setAssignCurriculumId(sc.curriculumId);
    setNewCurriculumTitle('');
    setNewCurriculumSubject('');
    setAssignCurrentPosition(sc.currentPosition ?? '');
    setAssignNextUp(sc.nextUp ?? '');
    setAssignStatus(sc.status);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurriculum && !assignCurriculumId) {
      toast.error('Please pick a curriculum');
      return;
    }
    try {
      if (editingCurriculum) {
        await updateStudentCurriculum(editingCurriculum.id, {
          currentPosition: assignCurrentPosition.trim() || undefined,
          nextUp: assignNextUp.trim() || undefined,
          status: assignStatus,
        });
        toast.success('Curriculum updated');
      } else {
        let curriculumId = assignCurriculumId;
        if (assignCurriculumId === NEW_CURRICULUM_VALUE) {
          if (!newCurriculumTitle.trim()) {
            toast.error('Please enter a curriculum title');
            return;
          }
          const existing = curricula.find(
            (c) => c.title.trim().toLowerCase() === newCurriculumTitle.trim().toLowerCase()
          );
          if (existing) {
            // Title already exists — select that curriculum instead of duplicating it.
            curriculumId = existing.id;
          } else {
            const created = await addCurriculum({
              title: newCurriculumTitle.trim(),
              subject: newCurriculumSubject.trim() || undefined,
            });
            curriculumId = created.id;
          }
        }
        await addStudentCurriculum({
          studentId: student!.id,
          curriculumId,
          currentPosition: assignCurrentPosition.trim() || undefined,
          nextUp: assignNextUp.trim() || undefined,
          status: assignStatus,
        });
        toast.success('Curriculum assigned');
      }
      setAssignModalOpen(false);
      await fetchStudentCurricula(student!.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save curriculum');
    }
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

  const handleSessionSave = async (
    session: Omit<Session, 'id' | 'userId' | 'createdAt'> | Array<Omit<Session, 'id' | 'userId' | 'createdAt'>>
  ) => {
    try {
      // Non-draft modal only ever saves one session; array is defensive.
      const items = Array.isArray(session) ? session : [session];
      for (const item of items) {
        await addSession(item);
      }
      await fetchEnrollments();
      toast.success(items.length > 1 ? `${items.length} sessions created` : 'Session created');
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
        <div className="text-slate-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-slate-500 dark:text-gray-400">Student not found</div>
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
            className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
          >
            ← Back
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 shadow-sm ring-2 ring-slate-200 dark:ring-gray-600"
              style={{ backgroundColor: student.color || '#6366f1' }}
              aria-label="Change color"
            />
            {showColorPicker && (
              <div className="absolute top-10 left-0 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-200 dark:border-gray-700 p-2 flex flex-wrap gap-2 w-40">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      handleUpdateStudent({ color });
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full border border-slate-200 dark:border-gray-600"
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
            className="text-2xl font-bold text-slate-900 dark:text-gray-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-gray-600 focus:border-indigo-500 focus:outline-none px-1"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700'
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Contact</label>
                <input
                  type="text"
                  defaultValue={student.contact}
                  onBlur={(e) => handleUpdateStudent({ contact: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Default Rate</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={student.defaultRate}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) handleUpdateStudent({ defaultRate: value });
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Timezone</label>
                <input
                  type="text"
                  defaultValue={student.timezone}
                  onBlur={(e) => handleUpdateStudent({ timezone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Notes</label>
                <input
                  type="text"
                  defaultValue={student.notes}
                  onBlur={(e) => handleUpdateStudent({ notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4">Enrollments</h2>
            {studentEnrollments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-gray-400">No enrollments yet.</p>
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
                      className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div>
                        <div className="font-medium text-slate-900 dark:text-gray-100">{cls?.name || 'Unknown class'}</div>
                        <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                          {paymentTypeLabel(enrollment.paymentType)} • Rate: {formatCurrency(rate)}
                        </div>
                        {enrollment.paymentType === 'prepaid' && (
                          <div className="text-sm mt-1 text-slate-900 dark:text-gray-100">
                            Balance:{' '}
                            <span className={enrollment.prepaidBalance < 0 ? 'text-red-600 font-medium' : 'font-medium'}>
                              {formatCurrency(enrollment.prepaidBalance)}
                            </span>
                          </div>
                        )}
                        {lowBalance && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 inline-block">
                            Low balance — less than 2 sessions remaining
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            enrollment.status === 'active'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : enrollment.status === 'paused'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300'
                          }`}
                        >
                          {enrollment.status}
                        </span>
                        <button
                          onClick={() => setActiveTab('payments')}
                          className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4">Up Next</h2>
              <div className="space-y-3">
                {upcomingSessions.slice(0, 3).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => openSessionModal(session)}
                    className="w-full text-left border border-slate-200 dark:border-gray-700 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900 dark:text-gray-100">
                        {formatDate(session.plannedDate)} {session.plannedTime}
                      </div>
                      {statusBadge(session.status)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 text-slate-500 dark:text-gray-400">
              No enrollments yet.
            </div>
          ) : (
            studentEnrollments.map((enrollment) => {
              const cls = getClass(enrollment.classId);
              if (!cls) return null;
              return (
                <div
                  key={enrollment.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6"
                >
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4">{cls.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Textbook</label>
                      <input
                        type="text"
                        defaultValue={cls.textbook}
                        onBlur={(e) => handleUpdateClass(cls.id, { textbook: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Current Unit</label>
                      <input
                        type="text"
                        defaultValue={cls.currentUnit}
                        onBlur={(e) => handleUpdateClass(cls.id, { currentUnit: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Progress */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Progress</h2>
              <button
                onClick={openAssignModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                + Assign Curriculum
              </button>
            </div>
            {activeStudentCurricula.length === 0 && activeClassCurricula.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-3">No active curricula yet.</p>
                <button
                  onClick={openAssignModal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Assign curriculum
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeClassCurricula.map((cc) => (
                  <div key={cc.id} className="border border-slate-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="h-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: '100%' }} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-gray-100">
                        {getCurriculumTitle(cc.curriculumId)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        Group · {getClass(cc.classId)?.name ?? 'Class'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-300 mt-1">
                      {cc.currentPosition ?? '—'}
                      {cc.nextUp && <span className="text-slate-400 dark:text-gray-500"> → {cc.nextUp}</span>}
                    </div>
                  </div>
                ))}
                {activeStudentCurricula.map((sc) => (
                  <div key={sc.id} className="border border-slate-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-gray-100">
                        {getCurriculumTitle(sc.curriculumId)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          Individual
                        </span>
                        <button
                          onClick={() => openEditCurriculum(sc)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          Edit
                        </button>
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-300 mt-1">
                      {sc.currentPosition ?? '—'}
                      {sc.nextUp && <span className="text-slate-400 dark:text-gray-500"> → {sc.nextUp}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4">Recent Lesson Logs</h2>
            {recentLessonLogs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-gray-400">No progress logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentLessonLogs.map((log) => (
                  <li key={log.id} className="border border-slate-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-gray-100">
                        {getCurriculumTitle(log.curriculumId)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        {formatDate(log.createdAt.slice(0, 10))}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-300 mt-1">
                      Covered: {log.covered}
                      {log.nextUp && <span> · Next: {log.nextUp}</span>}
                    </div>
                    <span
                      className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.progressType === 'group'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {log.progressType === 'group' ? 'Group' : 'Individual'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Schedule */}
      {activeTab === 'schedule' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Schedule</h2>
            <button
              onClick={() => openSessionModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add Session
            </button>
          </div>

          {studentSessions.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400 text-sm">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-gray-900/50 text-slate-600 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Class</th>
                    <th className="px-4 py-2 text-left font-medium">Duration</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-700 text-slate-900 dark:text-gray-100">
                  {studentSessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() => openSessionModal(session)}
                      className="hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
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
              <div key={enrollment.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{cls?.name || 'Unknown class'}</h3>
                    <div className="text-sm text-slate-500 dark:text-gray-400">
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
                    <div className="text-sm text-slate-500 dark:text-gray-400">Prepaid Balance</div>
                    <div
                      className={`text-3xl font-bold ${
                        enrollment.prepaidBalance < 0 ? 'text-red-600' : 'text-slate-900 dark:text-gray-100'
                      }`}
                    >
                      {formatCurrency(enrollment.prepaidBalance)}
                    </div>
                    {lowBalance && (
                      <div className="mt-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                        Balance is below 2 sessions ({formatCurrency(2 * rate)}). Consider topping up.
                      </div>
                    )}
                  </div>
                )}

                {enrollment.paymentType === 'monthly_advance' && (
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-gray-400">Monthly Rate</div>
                      <div className="text-xl font-semibold text-slate-900 dark:text-gray-100">{formatCurrency(rate)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-gray-400">Next Due</div>
                      <div className="text-xl font-semibold text-slate-900 dark:text-gray-100">
                        {enrollmentPayments.length > 0
                          ? formatDate(addOneMonth(enrollmentPayments[0].paymentDate))
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {enrollment.paymentType === 'on_completion' && (
                  <div className="mb-4">
                    <div className="text-sm text-slate-500 dark:text-gray-400">Total Owed (completed sessions)</div>
                    <div className={`text-3xl font-bold ${owed > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-gray-100'}`}>
                      {formatCurrency(Math.max(0, owed))}
                    </div>
                  </div>
                )}

                <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">Payment History</h4>
                {enrollmentPayments.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-gray-400">No payments recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-gray-900/50 text-slate-600 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Method</th>
                          <th className="px-3 py-2 text-left font-medium">Notes</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-700 text-slate-900 dark:text-gray-100">
                        {enrollmentPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{payment.paymentMethod}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-gray-400">{payment.notes || '—'}</td>
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

      {/* Assign / Edit Curriculum Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                {editingCurriculum ? 'Edit Curriculum' : 'Assign Curriculum'}
              </h2>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Curriculum</label>
                {editingCurriculum ? (
                  <div className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-900/50 px-3 py-2 text-sm text-slate-700 dark:text-gray-300">
                    {getCurriculumTitle(editingCurriculum.curriculumId)}
                  </div>
                ) : (
                  <select
                    value={assignCurriculumId}
                    onChange={(e) => setAssignCurriculumId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Pick a curriculum…</option>
                    {curricula.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                    <option value={NEW_CURRICULUM_VALUE}>+ New curriculum</option>
                  </select>
                )}
              </div>
              {!editingCurriculum && assignCurriculumId === NEW_CURRICULUM_VALUE && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      value={newCurriculumTitle}
                      onChange={(e) => setNewCurriculumTitle(e.target.value)}
                      placeholder="e.g. IELTS Speaking Booster"
                      className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Subject</label>
                    <input
                      type="text"
                      value={newCurriculumSubject}
                      onChange={(e) => setNewCurriculumSubject(e.target.value)}
                      placeholder="e.g. English"
                      className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Current Position</label>
                <input
                  type="text"
                  value={assignCurrentPosition}
                  onChange={(e) => setAssignCurrentPosition(e.target.value)}
                  placeholder="e.g. Unit 3, Lesson 2"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Next Up</label>
                <input
                  type="text"
                  value={assignNextUp}
                  onChange={(e) => setAssignNextUp(e.target.value)}
                  placeholder="e.g. Unit 3, Lesson 3"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={assignStatus}
                  onChange={(e) => setAssignStatus(e.target.value as CurriculumStatus)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {editingCurriculum ? 'Save Changes' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Record Payment</h2>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Enrollment</label>
                <select
                  value={paymentEnrollmentId}
                  onChange={(e) => setPaymentEnrollmentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
        sessions={sessions}
        enrollments={studentEnrollments}
        onSave={handleSessionSave}
        onUpdate={handleSessionUpdate}
        onDelete={handleSessionDelete}
      />
    </div>
  );
}
