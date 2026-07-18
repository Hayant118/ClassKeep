import { useEffect, useState } from 'react';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Bell } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useStudents } from './hooks/useStudents';
import { useClasses } from './hooks/useClasses';
import { useEnrollments } from './hooks/useEnrollments';
import { useSessions } from './hooks/useSessions';
import { useReminders } from './hooks/useReminders';
import { useReminderSettings } from './hooks/useReminderSettings';
import type { Reminder } from './types';
import {
  checkPreClassReminders,
  checkLowBalanceReminders,
  checkUnreviewedReminders,
  generateDailyDigest,
} from './utils/reminders';
import { Auth } from './components/Auth';
import { Calendar } from './components/Calendar';
import { SettingsView } from './components/SettingsView';
import { StudentsView } from './components/StudentsView';
import { ProposalsView } from './components/ProposalsView';
import { ProposalEditor } from './components/ProposalEditor';
import { ReviewView } from './components/ReviewView';
import { BillingView } from './components/BillingView';
import { StudentDetailView } from './components/StudentDetailView';
import { HomeView } from './components/HomeView';
import { RemindersView } from './components/RemindersView';

type TabKey = 'home' | 'students' | 'calendar' | 'proposals' | 'review' | 'billing' | 'settings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'students', label: 'Students' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'review', label: 'Review' },
  { key: 'billing', label: 'Billing' },
  { key: 'settings', label: 'Settings' },
];

interface HeaderProps {
  unreadCount: number;
}

function Header({ unreadCount }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab: TabKey = (() => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/proposals')) return 'proposals';
    if (path === '/review') return 'review';
    if (path === '/billing') return 'billing';
    if (path === '/calendar') return 'calendar';
    if (path === '/settings') return 'settings';
    if (path.startsWith('/students')) return 'students';
    return 'home';
  })();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">ClassKeep</h1>
          <div className="flex items-center gap-2 self-start sm:self-auto min-w-0">
            <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg overflow-x-auto scrollbar-hide">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(key === 'home' ? '/' : `/${key}`)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => navigate('/reminders')}
              className="relative p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
              aria-label="Reminders"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function AppContent() {
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { students, loading: studentsLoading, fetchStudents } = useStudents();
  const { classes, loading: classesLoading, fetchClasses, addClass } = useClasses();
  const { enrollments, loading: enrollmentsLoading, fetchEnrollments, addEnrollment } = useEnrollments();
  const { sessions, loading: sessionsLoading, fetchSessions } = useSessions();
  const { fetchReminders, unreadCount } = useReminders();
  const { settings, loading: settingsLoading } = useReminderSettings();

  const resolveClassForStudent = async (studentId: string): Promise<string> => {
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student not found');

    const existingClass = classes.find((cls) => {
      if (cls.type !== 'one-on-one') return false;
      const classEnrollments = enrollments.filter((e) => e.classId === cls.id);
      return classEnrollments.length === 1 && classEnrollments[0].studentId === studentId;
    });

    if (existingClass) return existingClass.id;

    const newClass = await addClass({
      name: `${student.name} (1-on-1)`,
      type: 'one-on-one',
      maxCapacity: 1,
      textbook: '',
      currentUnit: '',
    });

    await addEnrollment({
      studentId,
      classId: newClass.id,
      joinedAt: new Date().toISOString().split('T')[0],
      leftAt: null,
      customRate: null,
      paymentType: 'monthly_advance',
      prepaidBalance: 0,
      status: 'active',
    });

    return newClass.id;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn('[ClassKeep] Auth session check failed.', error.message);
      }
      setAuthSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authSession) {
      fetchStudents();
      fetchClasses();
      fetchEnrollments();
      fetchSessions();
    }
  }, [authSession, fetchStudents, fetchClasses, fetchEnrollments, fetchSessions]);

  // Reminder checks: run on mount and every 60 seconds while the app is open.
  useEffect(() => {
    if (!authSession || studentsLoading || classesLoading || enrollmentsLoading || sessionsLoading || settingsLoading) {
      return;
    }

    const fromDbReminder = (row: Record<string, unknown>): Reminder => ({
      id: row.id as string,
      user_id: row.user_id as string,
      type: row.type as Reminder['type'],
      reference_id: (row.reference_id as string | undefined) ?? undefined,
      title: row.title as string,
      body: (row.body as string | undefined) ?? undefined,
      scheduled_at: (row.scheduled_at as string | undefined) ?? undefined,
      dismissed_at: (row.dismissed_at as string | undefined) ?? undefined,
      created_at: row.created_at as string,
    });

    const runChecks = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('ck_reminders')
        .select('*')
        .eq('user_id', userData.user.id)
        .is('dismissed_at', null);

      const existing = (data || []).map(fromDbReminder);

      if (settings.preClassEnabled) {
        await checkPreClassReminders(
          sessions,
          classes,
          students,
          existing,
          settings.preClassMinutes,
          enrollments
        );
      }

      if (settings.lowBalanceEnabled) {
        await checkLowBalanceReminders(
          enrollments,
          students,
          existing,
          settings.lowBalanceThreshold
        );
      }

      if (settings.unreviewedEnabled) {
        await checkUnreviewedReminders(sessions, classes, students, existing);
      }

      if (settings.dailyDigestEnabled) {
        await generateDailyDigest(sessions, classes, students, existing, settings.dailyDigestTime);
      }

      await fetchReminders();
    };

    runChecks();
    const interval = setInterval(runChecks, 60_000);
    return () => clearInterval(interval);
  }, [
    authSession,
    studentsLoading,
    classesLoading,
    enrollmentsLoading,
    sessionsLoading,
    settingsLoading,
    sessions,
    classes,
    students,
    enrollments,
    settings,
    fetchReminders,
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authSession) {
    return <Auth />;
  }

  const isCalendarLoading = studentsLoading || classesLoading || enrollmentsLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header unreadCount={unreadCount} />
      <Toaster position="top-right" richColors />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Routes>
          <Route
            path="/"
            element={
              <HomeView
                students={students}
                classes={classes}
                enrollments={enrollments}
                onResolveClassForStudent={resolveClassForStudent}
              />
            }
          />
          <Route path="/students" element={<StudentsView />} />
          <Route path="/students/:id" element={<StudentDetailView />} />
          <Route
            path="/calendar"
            element={
              isCalendarLoading ? (
                <div className="p-8 text-center text-slate-500">Loading calendar data...</div>
              ) : (
                <Calendar
                  students={students}
                  classes={classes}
                  enrollments={enrollments}
                  onResolveClassForStudent={resolveClassForStudent}
                />
              )
            }
          />
          <Route path="/proposals" element={<ProposalsView />} />
          <Route path="/proposals/:proposalId" element={<ProposalEditor />} />
          <Route path="/review" element={<ReviewView students={students} classes={classes} />} />
          <Route path="/billing" element={<BillingView classes={classes} students={students} />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/reminders" element={<RemindersView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
