import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { useEnrollments } from '../hooks/useEnrollments';
import type { Student, Class } from '../types';
import { DEFAULT_TIMEZONE } from '../utils/timezone';
import { CURATED_PALETTE, normalizeColor } from '../utils/colors';

const COMMON_TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function StudentsView() {
  const navigate = useNavigate();
  const { students, loading: studentsLoading, error: studentsError, addStudent, updateStudent, deleteStudent, fetchStudents } = useStudents();
  const { classes, loading: classesLoading, addClass, updateClass, deleteClass } = useClasses();
  const { enrollments, addEnrollment, deleteEnrollment } = useEnrollments();

  // Student form state
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('');
  const [familyGroup, setFamilyGroup] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Group class form state (student-first model: classes are GROUPS only)
  const [className, setClassName] = useState('');
  const [classCapacity, setClassCapacity] = useState('6');
  const [classFee, setClassFee] = useState('');

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassCapacity, setEditClassCapacity] = useState('6');
  const [editClassFee, setEditClassFee] = useState('');

  // Per-class inline add-student state
  const [enrollPickByClass, setEnrollPickByClass] = useState<Record<string, string>>({});
  const [enrollFeeByClass, setEnrollFeeByClass] = useState<Record<string, string>>({});
  const [quickNameByClass, setQuickNameByClass] = useState<Record<string, string>>({});
  const [quickFeeByClass, setQuickFeeByClass] = useState<Record<string, string>>({});

  const resetStudentForm = () => {
    setName('');
    setContact('');
    setDefaultRate('');
    setTimezone(DEFAULT_TIMEZONE);
    setNotes('');
    setColor('');
    setFamilyGroup('');
    setEditingId(null);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const rate = parseFloat(defaultRate);

    try {
      const normalizedColor = normalizeColor(color.trim());
      const updates: Partial<Student> = {
        name: name.trim(),
        contact: contact.trim(),
        defaultRate: isNaN(rate) ? 0 : rate,
        timezone,
        notes: notes.trim(),
        familyGroup: familyGroup.trim() || undefined,
      };
      if (normalizedColor) updates.color = normalizedColor;

      if (editingId) {
        await updateStudent(editingId, updates);
        toast.success('Student updated');
      } else {
        await addStudent({
          ...updates,
          color: normalizedColor,
        } as Omit<Student, 'id' | 'userId' | 'createdAt'>);
        toast.success('Student added');
      }
      await fetchStudents();
      resetStudentForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save student');
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingId(student.id);
    setName(student.name);
    setContact(student.contact);
    setDefaultRate(student.defaultRate.toString());
    setTimezone(student.timezone);
    setNotes(student.notes);
    setColor(student.color ?? '');
    setFamilyGroup(student.familyGroup ?? '');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => nameInputRef.current?.focus(), 300);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    try {
      await deleteStudent(id);
      toast.success('Student deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete student');
    }
  };

  const parseFee = (raw: string): number | null => {
    const fee = parseFloat(raw);
    return raw.trim() === '' || isNaN(fee) || fee < 0 ? null : fee;
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    try {
      await addClass({
        name: className.trim(),
        type: 'group',
        maxCapacity: Math.max(1, parseInt(classCapacity, 10) || 6),
        defaultRate: parseFee(classFee),
        textbook: '',
        currentUnit: '',
      });
      setClassName('');
      setClassCapacity('6');
      setClassFee('');
      toast.success('Group class created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create class');
    }
  };

  const startEditClass = (cls: Class) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassCapacity(cls.maxCapacity.toString());
    setEditClassFee(cls.defaultRate != null ? cls.defaultRate.toString() : '');
  };

  const cancelEditClass = () => {
    setEditingClassId(null);
    setEditClassName('');
  };

  const handleUpdateClass = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editClassName.trim()) return;
    try {
      await updateClass(id, {
        name: editClassName.trim(),
        maxCapacity: Math.max(1, parseInt(editClassCapacity, 10) || 6),
        defaultRate: parseFee(editClassFee),
      });
      setEditingClassId(null);
      toast.success('Class updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update class');
    }
  };

  const getClassStudents = (classId: string) => {
    const classEnrollments = enrollments.filter(e => e.classId === classId);
    return classEnrollments.map(e => students.find(s => s.id === e.studentId)).filter(Boolean) as Student[];
  };

  const handleEnrollExisting = async (cls: Class) => {
    const studentId = enrollPickByClass[cls.id] ?? '';
    if (!studentId) {
      toast.error('Select a student to add');
      return;
    }

    const alreadyEnrolled = enrollments.some(
      (e) => e.classId === cls.id && e.studentId === studentId
    );
    if (alreadyEnrolled) {
      toast.error('This student is already in that class');
      return;
    }

    const feeInput = enrollFeeByClass[cls.id] ?? '';
    const fee = parseFee(feeInput) ?? cls.defaultRate ?? null;

    try {
      await addEnrollment({
        studentId,
        classId: cls.id,
        joinedAt: new Date().toISOString().split('T')[0],
        leftAt: null,
        customRate: fee,
        paymentType: 'monthly_advance',
        prepaidBalance: 0,
        status: 'active',
      });
      setEnrollPickByClass((prev) => ({ ...prev, [cls.id]: '' }));
      setEnrollFeeByClass((prev) => ({ ...prev, [cls.id]: '' }));
      toast.success('Student added to class');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student');
    }
  };

  const handleQuickAddStudent = async (cls: Class) => {
    const quickName = (quickNameByClass[cls.id] ?? '').trim();
    if (!quickName) {
      toast.error('Enter a name for the new student');
      return;
    }

    const feeInput = quickFeeByClass[cls.id] ?? '';
    const fee = parseFee(feeInput) ?? cls.defaultRate ?? null;

    try {
      const newStudent = await addStudent({
        name: quickName,
        contact: '',
        defaultRate: fee ?? 0,
        timezone: DEFAULT_TIMEZONE,
        notes: '',
      } as Omit<Student, 'id' | 'userId' | 'createdAt'>);

      await addEnrollment({
        studentId: newStudent.id,
        classId: cls.id,
        joinedAt: new Date().toISOString().split('T')[0],
        leftAt: null,
        customRate: fee,
        paymentType: 'monthly_advance',
        prepaidBalance: 0,
        status: 'active',
      });

      setQuickNameByClass((prev) => ({ ...prev, [cls.id]: '' }));
      setQuickFeeByClass((prev) => ({ ...prev, [cls.id]: '' }));
      toast.success(`${quickName} created and added to ${cls.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create student');
    }
  };

  const handleRemoveEnrollment = async (classId: string, studentId: string) => {
    const en = enrollments.find(e => e.classId === classId && e.studentId === studentId);
    if (!en) return;
    try {
      await deleteEnrollment(en.id);
      toast.success('Student removed from class');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove student');
    }
  };

  const getStudentEnrollments = (studentId: string) => {
    return enrollments.filter(e => e.studentId === studentId);
  };

  const groupedStudents = useMemo(() => {
    const groups = new Map<string, Student[]>();
    for (const student of students) {
      const group = student.familyGroup?.trim() || 'Ungrouped';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(student);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Ungrouped') return 1;
      if (b === 'Ungrouped') return -1;
      return a.localeCompare(b);
    });
  }, [students]);

  const familyGroupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const student of students) {
      if (student.familyGroup?.trim()) {
        groups.add(student.familyGroup.trim());
      }
    }
    return Array.from(groups).sort();
  }, [students]);

  // Student-first model: only GROUP classes are shown/managed here.
  const groupClasses = useMemo(
    () => classes.filter((c) => c.type === 'group'),
    [classes]
  );

  if (studentsLoading || classesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (studentsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {studentsError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Student Form */}
      <div ref={formRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 scroll-mt-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {editingId ? 'Edit Student' : 'Add Student'}
        </h2>

        <form onSubmit={handleStudentSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Default hourly rate <span className="text-xs font-normal text-slate-500">(1-on-1)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Color <span className="text-xs font-normal text-slate-500">(manual override)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setColor('')}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-medium text-slate-500 ${
                    !color ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200 bg-white'
                  }`}
                  title="Auto-assign"
                  aria-label="Auto-assign color"
                >
                  A
                </button>
                {CURATED_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border ${
                      color === c ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={normalizeColor(color) || '#e2e8f0'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 p-0 cursor-pointer"
                  aria-label="Custom color"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Auto"
                  className="flex-1 min-w-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Leave blank to auto-assign a color.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Family Group</label>
              <input
                type="text"
                value={familyGroup}
                onChange={(e) => setFamilyGroup(e.target.value)}
                list="family-group-list"
                placeholder="e.g. Smith family"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <datalist id="family-group-list">
                {familyGroupOptions.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
              <p className="text-xs text-slate-500 mt-1">
                Siblings in the same group get shades of the same hue.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {editingId ? 'Save Changes' : 'Add Student'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetStudentForm}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Group Class Management — student-first model: classes are GROUPS only */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Group Classes</h2>
        <p className="text-xs text-slate-500 mb-4">
          1-on-1 lessons need no class — schedule students directly on the calendar.
        </p>

        {/* Create Group Class */}
        <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class name (e.g., Saturday IELTS group)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="number"
            min={2}
            value={classCapacity}
            onChange={(e) => setClassCapacity(e.target.value)}
            placeholder="Capacity"
            title="Max students"
            className="w-full sm:w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            step="0.01"
            min={0}
            value={classFee}
            onChange={(e) => setClassFee(e.target.value)}
            placeholder="Fee/hr (optional)"
            title="Default per-student hourly fee — prefills when adding students"
            className="w-full sm:w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create Class
          </button>
        </form>

        {/* Group Classes List */}
        {groupClasses.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No group classes yet. Create one above, or schedule students directly on the calendar for 1-on-1 lessons.
          </p>
        ) : (
          <div className="space-y-3">
            {groupClasses.map((cls) => {
              const classStudents = getClassStudents(cls.id);
              const isEditing = editingClassId === cls.id;
              const enrolledIds = new Set(
                enrollments.filter((e) => e.classId === cls.id).map((e) => e.studentId)
              );
              const availableStudents = students.filter((s) => !enrolledIds.has(s.id));
              return (
                <div key={cls.id} className="border border-slate-200 rounded-lg p-4">
                  {isEditing ? (
                    <form onSubmit={(e) => handleUpdateClass(e, cls.id)} className="flex flex-col sm:flex-row flex-wrap gap-3">
                      <input
                        type="text"
                        value={editClassName}
                        onChange={(e) => setEditClassName(e.target.value)}
                        className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <input
                        type="number"
                        min={2}
                        value={editClassCapacity}
                        onChange={(e) => setEditClassCapacity(e.target.value)}
                        title="Max students"
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={editClassFee}
                        onChange={(e) => setEditClassFee(e.target.value)}
                        placeholder="Fee/hr"
                        title="Default per-student hourly fee for new additions"
                        className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditClass}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium px-3 py-2 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{cls.name}</div>
                        <div className="text-xs text-slate-500">
                          Group · {classStudents.length}/{cls.maxCapacity} students
                          {cls.defaultRate != null && ` · ${cls.defaultRate.toFixed(2)}/hr default fee`}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => startEditClass(cls)}
                          className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this class? This will also remove its enrollments and sessions.')) return;
                            try {
                              await deleteClass(cls.id);
                              toast.success('Class deleted');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to delete class');
                            }
                          }}
                          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Enrolled students */}
                  {classStudents.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {classStudents.map((s) => {
                        const en = enrollments.find(e => e.classId === cls.id && e.studentId === s.id);
                        return (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: s.color || '#6366f1' }}
                            />
                            {s.name}
                            {en?.customRate != null && (
                              <span className="text-indigo-400">· {en.customRate.toFixed(2)}/hr</span>
                            )}
                            <button
                              onClick={() => handleRemoveEnrollment(cls.id, s.id)}
                              className="text-indigo-400 hover:text-indigo-600"
                              aria-label={`Remove ${s.name} from class`}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Add existing student */}
                  {availableStudents.length > 0 && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <select
                        value={enrollPickByClass[cls.id] ?? ''}
                        onChange={(e) =>
                          setEnrollPickByClass((prev) => ({ ...prev, [cls.id]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Add existing student…</option>
                        {availableStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={enrollFeeByClass[cls.id] ?? ''}
                        onChange={(e) =>
                          setEnrollFeeByClass((prev) => ({ ...prev, [cls.id]: e.target.value }))
                        }
                        placeholder={cls.defaultRate != null ? `${cls.defaultRate.toFixed(2)}/hr` : 'Fee/hr (optional)'}
                        title="Per-student hourly fee for this class — billing uses enrollment.customRate"
                        className="w-full sm:w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleEnrollExisting(cls)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Quick-create new student straight into the class */}
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickNameByClass[cls.id] ?? ''}
                      onChange={(e) =>
                        setQuickNameByClass((prev) => ({ ...prev, [cls.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddStudent(cls);
                        }
                      }}
                      placeholder="New student name — create & add"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={quickFeeByClass[cls.id] ?? ''}
                      onChange={(e) =>
                        setQuickFeeByClass((prev) => ({ ...prev, [cls.id]: e.target.value }))
                      }
                      placeholder={cls.defaultRate != null ? `${cls.defaultRate.toFixed(2)}/hr` : 'Fee/hr (optional)'}
                      title="Also set as the student's 1-on-1 default rate"
                      className="w-full sm:w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickAddStudent(cls)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Create & add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Students List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Students ({students.length})</h2>
        </div>

        {students.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-500">
            No students yet. Add one above.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {groupedStudents.map(([group, groupStudents]) => {
              const familyColor = groupStudents.find((s) => s.color)?.color || '#94a3b8';
              return (
                <div key={group}>
                  <div className="px-6 py-2 bg-slate-50 text-sm font-semibold text-slate-700 border-b border-slate-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: familyColor }} />
                    {group} ({groupStudents.length})
                  </div>
                  <ul
                    className="border-l-4 ml-4 sm:ml-6"
                    style={{ borderColor: familyColor }}
                  >
                    {groupStudents.map((student, idx) => {
                      const studentEnrollments = getStudentEnrollments(student.id);
                      const detailParts = [
                        student.contact,
                        student.defaultRate > 0 ? `1-on-1 rate: ${student.defaultRate.toFixed(2)}/hr` : null,
                      ].filter((part): part is string => Boolean(part));
                      return (
                        <li
                          key={student.id}
                          className={`pl-4 pr-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50 transition-colors ${
                            idx !== groupStudents.length - 1 ? 'border-b border-slate-200' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: student.color || '#6366f1' }}
                              />
                              <p className="font-medium text-slate-900">
                                {student.name}
                              </p>
                            </div>
                            {detailParts.length > 0 && (
                              <p className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                {detailParts.join(' • ')}
                              </p>
                            )}
                            {student.notes.trim() && (
                              <p className="text-sm text-slate-500 mt-1">{student.notes}</p>
                            )}
                            {studentEnrollments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {studentEnrollments.map((en) => {
                                  const cls = classes.find(c => c.id === en.classId);
                                  return cls ? (
                                    <span
                                      key={en.id}
                                      className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded"
                                    >
                                      {cls.name}
                                      {en.customRate != null && ` · ${en.customRate.toFixed(2)}/hr`}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/students/${student.id}`)}
                              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEditStudent(student)}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}