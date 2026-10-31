// src/components/ProgressLogModal.tsx
import { useEffect, useMemo, useState } from 'react';
import type { Class, Curriculum, Session, Student } from '../types';
import { useProgress } from '../hooks/useProgress';
import { Button } from './Button';

export interface ProgressLogPayload {
  sessionId: string;
  classId?: string;
  studentId?: string;
  curriculumId: string;
  covered: string;
  nextUp?: string;
  progressType: 'group' | 'individual';
}

interface ProgressLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  students: Student[];
  classes: Class[];
  curricula: Curriculum[];
  onSave: (payload: ProgressLogPayload) => void;
}

export function ProgressLogModal({
  isOpen,
  onClose,
  session,
  students,
  classes,
  curricula,
  onSave,
}: ProgressLogModalProps) {
  const isGroup = Boolean(session.classId);
  const {
    classCurricula,
    studentCurricula,
    fetchClassCurricula,
    fetchStudentCurricula,
  } = useProgress();

  const [curriculumId, setCurriculumId] = useState('');
  const [covered, setCovered] = useState('');
  const [nextUp, setNextUp] = useState('');

  // Multi-book state for 1-on-1 sessions with several active curricula:
  // one entry (covered / next_up) per selected book.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, { covered: string; nextUp: string }>>({});

  // Load curriculum links for this class/student so the dropdown can be
  // limited to active curricula and "Next up" can be auto-suggested.
  useEffect(() => {
    if (!isOpen) return;
    if (session.classId) {
      fetchClassCurricula(session.classId);
    } else if (session.studentId) {
      fetchStudentCurricula(session.studentId);
    }
  }, [isOpen, session.classId, session.studentId, fetchClassCurricula, fetchStudentCurricula]);

  // Reset fields each time the modal opens for a (new) session.
  useEffect(() => {
    if (isOpen) {
      setCurriculumId('');
      setCovered('');
      setNextUp('');
      setSelectedIds([]);
      setEntries({});
    }
  }, [isOpen, session.id]);

  const links = isGroup ? classCurricula : studentCurricula;

  // Curricula with an active link for this class/student; fall back to all
  // curricula when nothing has been linked yet.
  const availableCurricula = useMemo(() => {
    const activeIds = new Set(
      links.filter((l) => l.status === 'active').map((l) => l.curriculumId)
    );
    const filtered = curricula.filter((c) => activeIds.has(c.id));
    return filtered.length > 0 ? filtered : curricula;
  }, [links, curricula]);

  // 1-on-1 with several active books → checkbox flow (one log row per book).
  const activeLinks = useMemo(() => links.filter((l) => l.status === 'active'), [links]);
  const multiMode = !isGroup && activeLinks.length > 1;

  const toggleCurriculum = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const link = activeLinks.find((l) => l.curriculumId === id);
      setEntries((e) => ({
        ...e,
        [id]: { covered: e[id]?.covered ?? '', nextUp: e[id]?.nextUp ?? link?.nextUp ?? '' },
      }));
      return [...prev, id];
    });
  };

  const updateEntry = (id: string, field: 'covered' | 'nextUp', value: string) => {
    setEntries((prev) => ({
      ...prev,
      [id]: { covered: prev[id]?.covered ?? '', nextUp: prev[id]?.nextUp ?? '', [field]: value },
    }));
  };

  const multiCanSubmit =
    selectedIds.length > 0 && selectedIds.every((id) => entries[id]?.covered.trim());

  const handleCurriculumChange = (id: string) => {
    setCurriculumId(id);
    const link = links.find((l) => l.curriculumId === id && l.status === 'active');
    setNextUp(link?.nextUp ?? '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (multiMode) {
      if (!multiCanSubmit) return;
      for (const id of selectedIds) {
        onSave({
          sessionId: session.id,
          classId: session.classId,
          studentId: session.studentId,
          curriculumId: id,
          covered: entries[id].covered.trim(),
          nextUp: entries[id].nextUp.trim() || undefined,
          progressType: 'individual',
        });
      }
      return;
    }
    if (!curriculumId || !covered.trim()) return;
    onSave({
      sessionId: session.id,
      classId: session.classId,
      studentId: session.studentId,
      curriculumId,
      covered: covered.trim(),
      nextUp: nextUp.trim() || undefined,
      progressType: isGroup ? 'group' : 'individual',
    });
  };

  if (!isOpen) return null;

  const className = session.classId
    ? classes.find((c) => c.id === session.classId)?.name
    : undefined;
  const studentName = session.studentId
    ? students.find((s) => s.id === session.studentId)?.name
    : undefined;
  const contextName = className ?? studentName ?? 'Session';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
            {isGroup ? 'Group Progress' : 'Individual Progress'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-500 dark:text-gray-400">
            {contextName} · {session.plannedDate} · {session.plannedTime.slice(0, 5)}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
              Curriculum
            </label>
            {availableCurricula.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-gray-500">
                No curricula available. Add one in Curricula settings first.
              </p>
            ) : multiMode ? (
              <div className="space-y-2">
                {availableCurricula.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`rounded-lg border transition-colors ${
                        checked
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-gray-700'
                      }`}
                    >
                      <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCurriculum(c.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-900 dark:text-gray-100">
                          {c.title}
                          {c.subject ? ` (${c.subject})` : ''}
                        </span>
                      </label>
                      {checked && (
                        <div className="px-3 pb-3 pt-1 space-y-2">
                          <input
                            type="text"
                            value={entries[c.id]?.covered ?? ''}
                            onChange={(e) => updateEntry(c.id, 'covered', e.target.value)}
                            placeholder="Covered — e.g., Unit 3B, p.45-48"
                            className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            value={entries[c.id]?.nextUp ?? ''}
                            onChange={(e) => updateEntry(c.id, 'nextUp', e.target.value)}
                            placeholder="Next up — e.g., Unit 3C, p.49-52"
                            className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <select
                value={curriculumId}
                onChange={(e) => handleCurriculumChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a curriculum…</option>
                {availableCurricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.subject ? ` (${c.subject})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!multiMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Covered
                </label>
                <input
                  type="text"
                  value={covered}
                  onChange={(e) => setCovered(e.target.value)}
                  placeholder="e.g., Unit 3B, p.45-48"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Next up
                </label>
                <input
                  type="text"
                  value={nextUp}
                  onChange={(e) => setNextUp(e.target.value)}
                  placeholder="e.g., Unit 3C, p.49-52"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={multiMode ? !multiCanSubmit : !curriculumId || !covered.trim()}>
              Save Progress
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Skip
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
