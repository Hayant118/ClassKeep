// src/components/CoursewareView.tsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurricula } from '../hooks/useCurricula';
import { useProgress } from '../hooks/useProgress';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { useEnrollments } from '../hooks/useEnrollments';
import type { ClassCurriculum, Curriculum, CurriculumStatus, StudentCurriculum } from '../types';

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

const SERIES_COLLAPSED_STORAGE_KEY = 'ck_courseware_collapsed';

function readSeriesCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SERIES_COLLAPSED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.series === 'object' && parsed.series !== null) {
        return parsed.series as Record<string, boolean>;
      }
    }
  } catch {
    // Malformed or unavailable storage — fall through to defaults.
  }
  return {};
}

function writeSeriesCollapsed(series: Record<string, boolean>) {
  try {
    localStorage.setItem(SERIES_COLLAPSED_STORAGE_KEY, JSON.stringify({ series }));
  } catch {
    // Storage unavailable — collapse state just won't persist.
  }
}

type AssignKind = 'class' | 'student';

interface AssignFormState {
  curriculum: Curriculum;
  kind: AssignKind;
  targetId: string;
  currentPosition: string;
  nextUp: string;
  status: CurriculumStatus;
}

interface EditFormState {
  kind: AssignKind;
  linkId: string;
  name: string;
  classId?: string;
  applyToStudents: boolean;
  currentPosition: string;
  nextUp: string;
  status: CurriculumStatus;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const LABEL_CLASS = 'block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1';

function chipPosition(current?: string, next?: string): string {
  const base = current?.trim() || '—';
  return next?.trim() ? `${base} → ${next.trim()}` : base;
}

export function CoursewareView() {
  const { curricula, loading: curriculaLoading, error: curriculaError, addCurriculum, updateCurriculum, deleteCurriculum } = useCurricula();
  const {
    classCurricula,
    studentCurricula,
    loading: progressLoading,
    error: progressError,
    fetchAllProgress,
    addClassCurriculum,
    updateClassCurriculum,
    deleteClassCurriculum,
    addStudentCurriculum,
    updateStudentCurriculum,
    deleteStudentCurriculum,
  } = useProgress();
  const { students } = useStudents();
  const { classes } = useClasses();
  const { enrollments } = useEnrollments();

  useEffect(() => {
    fetchAllProgress();
  }, [fetchAllProgress]);

  // New curriculum modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newSeries, setNewSeries] = useState('');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);

  // Series folder collapse state (persisted in localStorage; default = expanded)
  const [collapsedSeries, setCollapsedSeries] = useState<Record<string, boolean>>(readSeriesCollapsed);

  const toggleSeries = (name: string) => {
    setCollapsedSeries((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      writeSeriesCollapsed(next);
      return next;
    });
  };

  // Assign modal
  const [assignForm, setAssignForm] = useState<AssignFormState | null>(null);

  // Edit modal
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Book edit / delete state
  const [bookEdit, setBookEdit] = useState<{ curriculum: Curriculum; title: string; subject: string; series: string; color: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Curriculum | null>(null);

  // Guards every mutation against double-taps
  const [saving, setSaving] = useState(false);

  const studentName = (studentId: string) =>
    students.find((s) => s.id === studentId)?.name ?? 'Unknown student';
  const className = (classId: string) =>
    classes.find((c) => c.id === classId)?.name ?? 'Unknown class';

  const openAssign = (curriculum: Curriculum, kind: AssignKind) => {
    setAssignForm({
      curriculum,
      kind,
      targetId: '',
      currentPosition: '',
      nextUp: '',
      status: 'active',
    });
  };

  function openEditLink(kind: AssignKind, link: ClassCurriculum | StudentCurriculum) {
    setConfirmRemove(false);
    const isClass = kind === 'class';
    const classLink = link as ClassCurriculum;
    setEditForm({
      kind,
      linkId: link.id,
      name: isClass ? className(classLink.classId) : studentName((link as StudentCurriculum).studentId),
      classId: isClass ? classLink.classId : undefined,
      applyToStudents: true,
      currentPosition: link.currentPosition ?? '',
      nextUp: link.nextUp ?? '',
      status: link.status,
    });
  }

  const openBookEdit = (curriculum: Curriculum) => {
    setBookEdit({
      curriculum,
      title: curriculum.title,
      subject: curriculum.subject ?? '',
      series: curriculum.series ?? '',
      color: curriculum.color || COLOR_OPTIONS[0],
    });
  };

  const handleCreateCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    const existing = curricula.find(
      (c) => c.title.trim().toLowerCase() === newTitle.trim().toLowerCase()
    );
    if (existing) {
      // Reuse the matching curriculum instead of creating a duplicate.
      toast.info(`"${existing.title}" already exists — nothing to create`);
      setNewModalOpen(false);
      setNewTitle('');
      setNewSubject('');
      setNewSeries('');
      setNewColor(COLOR_OPTIONS[0]);
      return;
    }
    try {
      await addCurriculum({
        title: newTitle.trim(),
        subject: newSubject.trim() || undefined,
        series: newSeries.trim() || undefined,
        color: newColor,
      });
      toast.success('Curriculum created');
      setNewModalOpen(false);
      setNewTitle('');
      setNewSubject('');
      setNewSeries('');
      setNewColor(COLOR_OPTIONS[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create curriculum');
    }
  };

  const handleAssignSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm || saving) return;
    if (!assignForm.targetId) {
      toast.error(assignForm.kind === 'class' ? 'Please pick a class' : 'Please pick a student');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        curriculumId: assignForm.curriculum.id,
        currentPosition: assignForm.currentPosition.trim() || undefined,
        nextUp: assignForm.nextUp.trim() || undefined,
        status: assignForm.status,
      };
      if (assignForm.kind === 'class') {
        await addClassCurriculum({ classId: assignForm.targetId, ...payload });
      } else {
        await addStudentCurriculum({ studentId: assignForm.targetId, ...payload });
      }
      toast.success('Assigned');
      setAssignForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || saving) return;
    setSaving(true);
    try {
      const updates = {
        currentPosition: editForm.currentPosition.trim() || undefined,
        nextUp: editForm.nextUp.trim() || undefined,
        status: editForm.status,
      };
      if (editForm.kind === 'class') {
        await updateClassCurriculum(editForm.linkId, updates);
        // Mirror the class position onto every enrolled student, matching the
        // lesson-log fan-out behavior. Status is left untouched per student.
        if (editForm.applyToStudents && editForm.classId) {
          const curriculumId = classCurricula.find((cc) => cc.id === editForm.linkId)?.curriculumId;
          const studentIds = enrollments
            .filter((en) => en.classId === editForm.classId)
            .map((en) => en.studentId);
          if (curriculumId && studentIds.length > 0) {
            const { error: fanOutError } = await supabase
              .from('ck_student_curricula')
              .upsert(
                studentIds.map((studentId) => ({
                  student_id: studentId,
                  curriculum_id: curriculumId,
                  current_position: updates.currentPosition ?? null,
                  next_up: updates.nextUp ?? null,
                })),
                { onConflict: 'student_id,curriculum_id' }
              );
            if (fanOutError) throw new Error(fanOutError.message);
            await fetchAllProgress();
          }
        }
      } else {
        await updateStudentCurriculum(editForm.linkId, updates);
      }
      toast.success('Updated');
      setEditForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLink = async () => {
    if (!editForm || saving) return;
    setSaving(true);
    try {
      if (editForm.kind === 'class') {
        await deleteClassCurriculum(editForm.linkId);
      } else {
        await deleteStudentCurriculum(editForm.linkId);
      }
      toast.success(`Unassigned ${editForm.name}`);
      setEditForm(null);
      setConfirmRemove(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const handleBookEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookEdit || saving) return;
    if (!bookEdit.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    setSaving(true);
    try {
      await updateCurriculum(bookEdit.curriculum.id, {
        title: bookEdit.title.trim(),
        subject: bookEdit.subject.trim() || undefined,
        series: bookEdit.series.trim() || undefined,
        color: bookEdit.color,
      });
      toast.success('Book updated');
      setBookEdit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update book');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      // Keep lesson history: detach logs from this book first. If the column
      // isn't nullable or an FK blocks it, abort with an explanation.
      const { error: detachError } = await supabase
        .from('ck_lesson_logs')
        .update({ curriculum_id: null })
        .eq('curriculum_id', deleteTarget.id);
      if (detachError) {
        toast.error(
          `Cannot delete "${deleteTarget.title}": lesson history is linked to this book and cannot be detached (${detachError.message}).`
        );
        return;
      }
      // Remove all assignments, then the book itself.
      const { error: scError } = await supabase
        .from('ck_student_curricula')
        .delete()
        .eq('curriculum_id', deleteTarget.id);
      if (scError) throw new Error(scError.message);
      const { error: ccError } = await supabase
        .from('ck_class_curricula')
        .delete()
        .eq('curriculum_id', deleteTarget.id);
      if (ccError) throw new Error(ccError.message);
      await deleteCurriculum(deleteTarget.id);
      await fetchAllProgress();
      toast.success(`"${deleteTarget.title}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete book');
    } finally {
      setSaving(false);
    }
  };

  const unassignedTargets = useMemo(() => {
    if (!assignForm) return [];
    if (assignForm.kind === 'class') {
      const assigned = new Set(
        classCurricula
          .filter((cc) => cc.curriculumId === assignForm.curriculum.id)
          .map((cc) => cc.classId)
      );
      return classes.filter((c) => !assigned.has(c.id));
    }
    const assigned = new Set(
      studentCurricula
        .filter((sc) => sc.curriculumId === assignForm.curriculum.id)
        .map((sc) => sc.studentId)
    );
    return students.filter((s) => !assigned.has(s.id));
  }, [assignForm, classCurricula, studentCurricula, classes, students]);

  // Books without a series render ungrouped at the top; the rest are folders.
  const { ungroupedCurricula, seriesGroups } = useMemo(() => {
    const ungrouped: Curriculum[] = [];
    const groups = new Map<string, Curriculum[]>();
    for (const c of curricula) {
      const series = c.series?.trim();
      if (!series) {
        ungrouped.push(c);
        continue;
      }
      const arr = groups.get(series) ?? [];
      arr.push(c);
      groups.set(series, arr);
    }
    return {
      ungroupedCurricula: ungrouped,
      seriesGroups: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)),
    };
  }, [curricula]);

  const isLoading = curriculaLoading || progressLoading;
  const loadError = curriculaError ?? progressError;

  function renderCurriculumCard(curriculum: Curriculum) {
    const classLinks = classCurricula.filter((cc) => cc.curriculumId === curriculum.id);
    const studentLinks = studentCurricula.filter((sc) => sc.curriculumId === curriculum.id);
    return (
      <div
        key={curriculum.id}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: curriculum.color || '#6366f1' }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-gray-100 truncate">
              {curriculum.title}
            </h3>
            {curriculum.subject && (
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                {curriculum.subject}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => openBookEdit(curriculum)}
            disabled={saving}
            className="p-2 rounded-lg text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label={`Edit ${curriculum.title}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(curriculum)}
            disabled={saving}
            className="p-2 rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label={`Delete ${curriculum.title}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Assigned group classes (blue chips) */}
        {classLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {classLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => openEditLink('class', link)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors ${
                  link.status !== 'active' ? 'opacity-60' : ''
                }`}
                title="Edit position"
              >
                <span className="truncate max-w-[10rem]">{className(link.classId)}</span>
                <span className="opacity-75">· {chipPosition(link.currentPosition, link.nextUp)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Assigned students (green chips) */}
        {studentLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {studentLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => openEditLink('student', link)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors ${
                  link.status !== 'active' ? 'opacity-60' : ''
                }`}
                title="Edit position"
              >
                <span className="truncate max-w-[10rem]">{studentName(link.studentId)}</span>
                <span className="opacity-75">· {chipPosition(link.currentPosition, link.nextUp)}</span>
              </button>
            ))}
          </div>
        )}

        {classLinks.length === 0 && studentLinks.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">Not assigned yet.</p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => openAssign(curriculum, 'class')}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign class
          </button>
          <button
            type="button"
            onClick={() => openAssign(curriculum, 'student')}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign student
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
        Error loading courseware: {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Courseware</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Curricula library and assignments</p>
        </div>
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Curriculum
        </button>
      </div>

      {curricula.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
            No curricula yet. Create your first curriculum to start tracking progress.
          </p>
          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Curriculum
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {ungroupedCurricula.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ungroupedCurricula.map((curriculum) => renderCurriculumCard(curriculum))}
            </div>
          )}

          {seriesGroups.map(([series, books]) => {
            const isCollapsed = !!collapsedSeries[series];
            return (
              <div
                key={series}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleSeries(series)}
                  aria-expanded={!isCollapsed}
                  className="w-full min-h-[44px] flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-gray-900/50 text-sm font-semibold text-slate-600 dark:text-gray-400 text-left"
                >
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <span className="flex-1 truncate">{series}</span>
                  <span className="text-xs bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">
                    {books.length} {books.length === 1 ? 'book' : 'books'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    {books.map((curriculum) => renderCurriculumCard(curriculum))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Curriculum Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">New Curriculum</h2>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCurriculum} className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLASS}>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. IELTS Speaking Booster"
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Subject</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. English"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Series <span className="text-xs font-normal text-slate-500 dark:text-gray-500">(optional — groups the book into a folder)</span></label>
                <input
                  type="text"
                  value={newSeries}
                  onChange={(e) => setNewSeries(e.target.value)}
                  placeholder="e.g. Reading Explorer"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-colors ${
                        newColor === color
                          ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'
                          : 'border-white dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                Assign · {assignForm.curriculum.title}
              </h2>
              <button
                type="button"
                onClick={() => setAssignForm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignSave} className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLASS}>Assign to</label>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-900/50 p-1 rounded-lg w-fit">
                  {(['class', 'student'] as AssignKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setAssignForm((prev) => (prev ? { ...prev, kind, targetId: '' } : prev))}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        assignForm.kind === kind
                          ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {kind === 'class' ? 'Group class' : 'Student'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  {assignForm.kind === 'class' ? 'Group class' : 'Student'}
                </label>
                {unassignedTargets.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    {assignForm.kind === 'class'
                      ? 'All classes already have this curriculum.'
                      : 'All students already have this curriculum.'}
                  </p>
                ) : (
                  <select
                    value={assignForm.targetId}
                    onChange={(e) =>
                      setAssignForm((prev) => (prev ? { ...prev, targetId: e.target.value } : prev))
                    }
                    className={INPUT_CLASS}
                    required
                  >
                    <option value="">
                      {assignForm.kind === 'class' ? 'Pick a class…' : 'Pick a student…'}
                    </option>
                    {unassignedTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={LABEL_CLASS}>Current Position</label>
                <input
                  type="text"
                  value={assignForm.currentPosition}
                  onChange={(e) =>
                    setAssignForm((prev) => (prev ? { ...prev, currentPosition: e.target.value } : prev))
                  }
                  placeholder="e.g. Unit 3, Lesson 2"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Next Up</label>
                <input
                  type="text"
                  value={assignForm.nextUp}
                  onChange={(e) =>
                    setAssignForm((prev) => (prev ? { ...prev, nextUp: e.target.value } : prev))
                  }
                  placeholder="e.g. Unit 3, Lesson 3"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select
                  value={assignForm.status}
                  onChange={(e) =>
                    setAssignForm((prev) =>
                      prev ? { ...prev, status: e.target.value as CurriculumStatus } : prev
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={unassignedTargets.length === 0 || saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignForm(null)}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                Edit · {editForm.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLASS}>Current Position</label>
                <input
                  type="text"
                  value={editForm.currentPosition}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, currentPosition: e.target.value } : prev))
                  }
                  placeholder="e.g. Unit 3, Lesson 2"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Next Up</label>
                <input
                  type="text"
                  value={editForm.nextUp}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, nextUp: e.target.value } : prev))
                  }
                  placeholder="e.g. Unit 3, Lesson 3"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, status: e.target.value as CurriculumStatus } : prev
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              {editForm.kind === 'class' && (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.applyToStudents}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, applyToStudents: e.target.checked } : prev
                      )
                    }
                    className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  Apply to all enrolled students
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(null)}
                  disabled={saving}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-gray-700">
                {confirmRemove ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-gray-400 flex-1">
                      Unassign {editForm.name} from this book?
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveLink}
                      disabled={saving}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                    >
                      {saving ? 'Removing…' : 'Confirm Remove'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      disabled={saving}
                      className="text-xs font-medium text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 px-2 py-2 transition-colors disabled:opacity-50"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={saving}
                    className="w-full text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Remove assignment
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {bookEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Edit Book</h2>
              <button
                type="button"
                onClick={() => setBookEdit(null)}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleBookEditSave} className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLASS}>Title</label>
                <input
                  type="text"
                  value={bookEdit.title}
                  onChange={(e) => setBookEdit((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Subject</label>
                <input
                  type="text"
                  value={bookEdit.subject}
                  onChange={(e) => setBookEdit((prev) => (prev ? { ...prev, subject: e.target.value } : prev))}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Series <span className="text-xs font-normal text-slate-500 dark:text-gray-500">(optional)</span></label>
                <input
                  type="text"
                  value={bookEdit.series}
                  onChange={(e) => setBookEdit((prev) => (prev ? { ...prev, series: e.target.value } : prev))}
                  placeholder="e.g. Reading Explorer"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBookEdit((prev) => (prev ? { ...prev, color } : prev))}
                      className={`w-7 h-7 rounded-full border-2 transition-colors ${
                        bookEdit.color === color
                          ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'
                          : 'border-white dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setBookEdit(null)}
                  disabled={saving}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Book Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                Delete "{deleteTarget.title}"?
              </h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-300">
                This removes the book and all assignments. Lesson history is kept.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteBook}
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Deleting…' : 'Delete Book'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={saving}
                  className="flex-1 bg-white hover:bg-slate-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
