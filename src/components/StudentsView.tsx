import { Fragment, useMemo, useState } from 'react';
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
  const { students, loading: studentsLoading, error: studentsError, addStudent, updateStudent, deleteStudent } = useStudents();
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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Class form state
  const [className, setClassName] = useState('');
  const [classType, setClassType] = useState<'one-on-one' | 'group'>('one-on-one');
  const [selectedClassForEnroll, setSelectedClassForEnroll] = useState('');
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState('');

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassType, setEditClassType] = useState<'one-on-one' | 'group'>('one-on-one');

  const resetStudentForm = () => {
    setName('');
    setContact('');
    setDefaultRate('');
    setTimezone(DEFAULT_TIMEZONE);
    setNotes('');
    setColor('');
    setFamilyGroup('');
    setShowColorPicker(false);
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
    setShowColorPicker(false);
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

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    try {
      await addClass({
        name: className.trim(),
        type: classType,
        maxCapacity: classType === 'one-on-one' ? 1 : 6,
        textbook: '',
        currentUnit: '',
      });
      setClassName('');
      toast.success('Class created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create class');
    }
  };

  const startEditClass = (cls: Class) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassType(cls.type);
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
        type: editClassType,
        maxCapacity: editClassType === 'one-on-one' ? 1 : 6,
      });
      setEditingClassId(null);
      toast.success('Class updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update class');
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForEnroll || !selectedStudentForEnroll) return;

    const alreadyEnrolled = enrollments.some(
      (e) => e.classId === selectedClassForEnroll && e.studentId === selectedStudentForEnroll
    );
    if (alreadyEnrolled) {
      toast.error('This student is already enrolled in that class');
      return;
    }

    try {
      await addEnrollment({
        studentId: selectedStudentForEnroll,
        classId: selectedClassForEnroll,
        joinedAt: new Date().toISOString().split('T')[0],
        leftAt: null,
        customRate: null,
        paymentType: 'monthly_advance',
        prepaidBalance: 0,
        status: 'active',
      });
      setSelectedClassForEnroll('');
      setSelectedStudentForEnroll('');
      toast.success('Student enrolled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enroll student');
    }
  };

  const getStudentEnrollments = (studentId: string) => {
    return enrollments.filter(e => e.studentId === studentId);
  };

  const getClassStudents = (classId: string) => {
    const classEnrollments = enrollments.filter(e => e.classId === classId);
    return classEnrollments.map(e => students.find(s => s.id === e.studentId)).filter(Boolean) as Student[];
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {editingId ? 'Edit Student' : 'Add Student'}
        </h2>

        <form onSubmit={handleStudentSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Rate</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColorPicker((v) => !v)}
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm ring-2 ring-slate-200"
                    style={{ backgroundColor: color || '#e2e8f0' }}
                    aria-label="Choose color"
                  />
                  {showColorPicker && (
                    <div className="absolute top-12 left-0 z-20 bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex flex-wrap gap-2 w-44">
                      {CURATED_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setColor(c);
                            setShowColorPicker(false);
                          }}
                          className={`w-7 h-7 rounded-full border ${color === c ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200'}`}
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
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Auto"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {color && (
                  <button
                    type="button"
                    onClick={() => setColor('')}
                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                  >
                    Reset
                  </button>
                )}
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
                placeholder="e.g. Smith family"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
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

      {/* Class Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Classes</h2>

        {/* Create Class */}
        <form onSubmit={handleCreateClass} className="flex gap-3 mb-6">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class name (e.g., Abby IELTS)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <select
            value={classType}
            onChange={(e) => setClassType(e.target.value as 'one-on-one' | 'group')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="one-on-one">1-on-1</option>
            <option value="group">Group</option>
          </select>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create Class
          </button>
        </form>

        {/* Enroll Student */}
        {classes.length > 0 && students.length > 0 && (
          <form onSubmit={handleEnroll} className="flex gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
            <select
              value={selectedClassForEnroll}
              onChange={(e) => setSelectedClassForEnroll(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedStudentForEnroll}
              onChange={(e) => setSelectedStudentForEnroll(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Enroll
            </button>
          </form>
        )}

        {/* Classes List */}
        {classes.length === 0 ? (
          <p className="text-slate-500 text-sm">No classes yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => {
              const classStudents = getClassStudents(cls.id);
              const isEditing = editingClassId === cls.id;
              return (
                <div key={cls.id} className="border border-slate-200 rounded-lg p-4">
                  {isEditing ? (
                    <form onSubmit={(e) => handleUpdateClass(e, cls.id)} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={editClassName}
                        onChange={(e) => setEditClassName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <select
                        value={editClassType}
                        onChange={(e) => setEditClassType(e.target.value as 'one-on-one' | 'group')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="one-on-one">1-on-1</option>
                        <option value="group">Group</option>
                      </select>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-800">{cls.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{cls.type}</div>
                      </div>
                      <div className="flex gap-2">
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
                  {classStudents.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {classStudents.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full"
                        >
                          {s.name}
                          <button
                            onClick={async () => {
                              const en = enrollments.find(e => e.classId === cls.id && e.studentId === s.id);
                              if (!en) return;
                              try {
                                await deleteEnrollment(en.id);
                                toast.success('Enrollment removed');
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Failed to remove enrollment');
                              }
                            }}
                            className="text-indigo-400 hover:text-indigo-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
          <ul className="divide-y divide-slate-200">
            {groupedStudents.map(([group, groupStudents]) => (
              <Fragment key={group}>
                <li className="sticky top-32 sm:top-20 z-10 px-6 py-2 bg-slate-50 text-sm font-semibold text-slate-700 border-b border-slate-200">
                  {group} ({groupStudents.length})
                </li>
                {groupStudents.map((student) => {
                  const studentEnrollments = getStudentEnrollments(student.id);
                  const detailParts = [
                    student.contact,
                    student.defaultRate > 0 ? `Rate: ${student.defaultRate.toFixed(2)}` : null,
                    student.timezone,
                  ].filter((part): part is string => Boolean(part));
                  return (
                    <li
                      key={student.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: student.color || '#6366f1' }}
                          />
                          <p className="font-medium text-slate-900 truncate">
                            {student.name}
                          </p>
                        </div>
                        {detailParts.length > 0 && (
                          <p className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                            {detailParts.join(' • ')}
                          </p>
                        )}
                        {student.notes && (
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
              </Fragment>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}