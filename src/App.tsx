import { useEffect, useState } from 'react';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from './lib/supabase';
import { useStudents } from './hooks/useStudents';
import { useClasses } from './hooks/useClasses';
import { useEnrollments } from './hooks/useEnrollments';
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

function Header() {
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
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">ClassKeep</h1>
          <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(key === 'home' ? '/' : `/${key}`)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </nav>
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
    }
  }, [authSession, fetchStudents, fetchClasses, fetchEnrollments]);

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
      <Header />
      <Toaster position="top-right" richColors />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomeView />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
