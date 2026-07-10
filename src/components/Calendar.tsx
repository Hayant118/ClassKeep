import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Session, Student, Class, Enrollment } from '../types';
import { usePreferences } from '../hooks/usePreferences';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { SessionModal } from './SessionModal';
import { useSessions } from '../hooks/useSessions';

type CalendarView = 'day' | 'week' | 'month';

interface CalendarProps {
  students: Student[];
  classes: Class[];
  enrollments?: Enrollment[];
  onResolveClassForStudent?: (studentId: string) => Promise<string>;
}

export function Calendar({ students, classes, enrollments = [], onResolveClassForStudent }: CalendarProps) {
  const { preferences, loading: prefsLoading } = usePreferences();
  const { sessions, loading, error, fetchSessions, addSession, updateSession, deleteSession } = useSessions();
  
  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set(students.map((s) => s.id)));
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!hasInitializedFilter && students.length > 0) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
      setHasInitializedFilter(true);
    }
  }, [students, hasInitializedFilter]);
  const [editingSession, setEditingSession] = useState<Session | undefined>();
  const [createInitialDate, setCreateInitialDate] = useState('');
  const [createInitialTime, setCreateInitialTime] = useState('08:00');
  const [createInitialTimezone, setCreateInitialTimezone] = useState<string>('Asia/Shanghai');

  // Build a map of classId -> studentIds for filtering
  const classToStudents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const en of enrollments) {
      const arr = map.get(en.classId) || [];
      arr.push(en.studentId);
      map.set(en.classId, arr);
    }
    return map;
  }, [enrollments]);

  // Filter sessions by selected students (via class enrollments)
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const classStudentIds = classToStudents.get(session.classId) || [];
      return classStudentIds.some((sid) => selectedStudentIds.has(sid));
    });
  }, [sessions, classToStudents, selectedStudentIds]);

  // Fetch sessions for a broad window around the current view so timezone
  // offsets and month/week boundaries don't hide sessions.
  useEffect(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - 35);

    const end = new Date(currentDate);
    end.setDate(end.getDate() + 35);

    fetchSessions({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  }, [currentDate, fetchSessions]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllStudents = () => setSelectedStudentIds(new Set(students.map((s) => s.id)));
  const clearAllStudents = () => setSelectedStudentIds(new Set());

  const goToToday = () => setCurrentDate(new Date());

  const movePrevious = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const moveNext = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const openCreateModal = (dateKey: string, time: string, timezone?: string) => {
    setEditingSession(undefined);
    setCreateInitialDate(dateKey);
    setCreateInitialTime(time);
    setCreateInitialTimezone(timezone ?? 'Asia/Shanghai');
    setIsModalOpen(true);
  };

  const openEditModal = (session: Session) => {
    setEditingSession(session);
    setCreateInitialDate('');
    setCreateInitialTime('');
    setCreateInitialTimezone('Asia/Shanghai');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSession(undefined);
  };

  const handleSaveSession = async (session: Omit<Session, 'id' | 'userId' | 'createdAt'>) => {
    try {
      await addSession(session);
      toast.success('Session saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save session');
    }
  };

  const handleUpdateSession = async (id: string, updates: Partial<Session>) => {
    try {
      await updateSession(id, updates);
      toast.success('Session updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await deleteSession(id);
      toast.success('Session deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const title = useMemo(() => {
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
    }
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(currentDate);
  }, [view, currentDate]);

  if (loading || prefsLoading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={movePrevious} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50">← Prev</button>
          <button type="button" onClick={goToToday} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50">Today</button>
          <button type="button" onClick={moveNext} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50">Next →</button>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 order-first lg:order-none">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Filter by student</h3>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllStudents} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50">Select all</button>
            <button type="button" onClick={clearAllStudents} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100">Hide all</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {students.map((student) => (
            <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedStudentIds.has(student.id) ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className={selectedStudentIds.has(student.id) ? '' : 'line-through'}>{student.name}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'day' && (
        <DayView
          day={currentDate}
          timezone="Asia/Shanghai"
          students={students}
          classes={classes}
          enrollments={enrollments}
          sessions={filteredSessions}
          preferences={preferences}
          onSlotClick={openCreateModal}
          onSessionClick={openEditModal}
          onDeleteSession={handleDeleteSession}
        />
      )}
      {view === 'week' && (
        <WeekView
          weekStart={currentDate}
          timezone="Asia/Shanghai"
          students={students}
          classes={classes}
          enrollments={enrollments}
          sessions={filteredSessions}
          preferences={preferences}
          onSlotClick={openCreateModal}
          onSessionClick={openEditModal}
        />
      )}
      {view === 'month' && (
        <MonthView
          monthStart={currentDate}
          timezone="Asia/Shanghai"
          students={students}
          classes={classes}
          enrollments={enrollments}
          sessions={filteredSessions}
          onMonthChange={(offset) => {
            const d = new Date(currentDate);
            d.setMonth(d.getMonth() + offset);
            setCurrentDate(d);
          }}
          onSessionClick={openEditModal}
          onAddSession={(dateKey) => openCreateModal(dateKey, preferences.calendarStartTime.slice(0, 5), 'Asia/Shanghai')}
          onDeleteSession={handleDeleteSession}
        />
      )}

      <SessionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        session={editingSession}
        initialDate={createInitialDate}
        initialTime={createInitialTime}
        initialTimezone={createInitialTimezone}
        students={students}
        classes={classes}
        enrollments={enrollments}
        onResolveClassForStudent={onResolveClassForStudent}
        onSave={handleSaveSession}
        onUpdate={handleUpdateSession}
        onDelete={handleDeleteSession}
      />
    </div>
  );
}