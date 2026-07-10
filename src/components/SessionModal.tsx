import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Session, Student, Class, Enrollment } from '../types';

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: Session;
  initialDate?: string;
  initialTime?: string;
  initialTimezone?: string;
  students: Student[];
  classes: Class[];
  enrollments?: Enrollment[];
  isDraft?: boolean;
  onResolveClassForStudent?: (studentId: string) => Promise<string>;
  onSave: (session: Omit<Session, 'id' | 'userId' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<Session>) => void;
  onDelete: (id: string) => void;
}

const DURATION_OPTIONS = [30, 60, 90, 120, 150];

interface ChargeInput {
  rateMode: Session['rateMode'];
  rateValue: number | null;
  classId: string;
  students: Student[];
  enrollments: Enrollment[];
}

function computeSessionCharge({
  rateMode,
  rateValue,
  classId,
  students,
  enrollments,
}: ChargeInput): number {
  if ((rateMode === 'override' || rateMode === 'flat') && rateValue != null) {
    return rateValue;
  }
  const enrollment = enrollments.find((e) => e.classId === classId && e.status === 'active');
  if (enrollment?.customRate != null) return enrollment.customRate;
  const student = enrollment ? students.find((s) => s.id === enrollment.studentId) : undefined;
  return student?.defaultRate ?? 0;
}

async function decrementPrepaidBalance(
  classId: string,
  charge: number,
  enrollments: Enrollment[]
) {
  if (charge <= 0) return;
  const enrollment = enrollments.find((e) => e.classId === classId && e.status === 'active');
  if (!enrollment || enrollment.paymentType !== 'prepaid') return;

  const nextBalance = enrollment.prepaidBalance - charge;
  const { error } = await supabase
    .from('ck_enrollments')
    .update({ prepaid_balance: nextBalance })
    .eq('id', enrollment.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to decrement prepaid balance', error);
  }
}

export function SessionModal({
  isOpen,
  onClose,
  session,
  initialDate,
  initialTime,
  initialTimezone,
  students,
  classes,
  enrollments = [],
  isDraft = false,
  onResolveClassForStudent,
  onSave,
  onUpdate,
  onDelete,
}: SessionModalProps) {
  const isEditing = !!session;

  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(
    isValidDateString(initialDate || '') ? initialDate || todayKey() : todayKey()
  );
  const [time, setTime] = useState(
    isValidTimeString(initialTime || '') ? initialTime || '09:00' : '09:00'
  );
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState(60);
  const [rateMode, setRateMode] = useState<'auto' | 'override' | 'flat'>('auto');
  const [rateValue, setRateValue] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Session['status']>('scheduled');

  const defaultTimezone = initialTimezone || 'Asia/Shanghai';
  const selectedClass = classes.find((c) => c.id === classId);

  // Show student names for selected class
  const classStudentNames = selectedClass
    ? enrollments
        .filter((e) => e.classId === selectedClass.id)
        .map((e) => students.find((s) => s.id === e.studentId)?.name)
        .filter(Boolean)
        .join(', ')
    : '';

  useEffect(() => {
    if (!isOpen) return;

    if (session) {
      setClassId(session.classId);
      setStudentId('');
      setDate(session.plannedDate);
      setTime(session.plannedTime);
      const preset = DURATION_OPTIONS.includes(session.durationMinutes);
      setDurationMode(preset ? 'preset' : 'custom');
      setDuration(preset ? session.durationMinutes : 60);
      setCustomDuration(session.durationMinutes);
      setRateMode(session.rateMode);
      setRateValue(session.rateValue?.toString() || '');
      setNotes(session.notes);
      setStatus(session.status);
    } else {
      const firstClass = classes[0];
      setClassId(firstClass?.id ?? '');
      setStudentId('');
      setDate(isValidDateString(initialDate || '') ? initialDate || todayKey() : todayKey());
      setTime(isValidTimeString(initialTime || '') ? initialTime || '09:00' : '09:00');
      setDurationMode('preset');
      setDuration(60);
      setCustomDuration(60);
      setRateMode('auto');
      setRateValue('');
      setNotes('');
      setStatus('scheduled');
    }
  }, [isOpen, session, initialDate, initialTime, classes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classId && !studentId) {
      toast.error('Please select a class or a student');
      return;
    }

    let resolvedClassId = classId;

    if (!resolvedClassId && studentId) {
      if (!onResolveClassForStudent) {
        toast.error('Student-only sessions are not supported here');
        return;
      }
      try {
        resolvedClassId = await onResolveClassForStudent(studentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create class for student');
        return;
      }
    }

    const finalDuration = durationMode === 'preset' ? duration : customDuration;
    const finalRateValue = rateMode === 'auto' ? null : parseFloat(rateValue) || 0;

    const movedFromDate =
      session && session.status !== 'moved' && status === 'moved'
        ? session.plannedDate
        : session?.movedFromDate || null;
    const movedFromTime =
      session && session.status !== 'moved' && status === 'moved'
        ? session.plannedTime
        : session?.movedFromTime || null;

    const wasCompleted = session?.status === 'completed';
    const nowCompleted = status === 'completed';

    const charge = computeSessionCharge({
      rateMode,
      rateValue: finalRateValue,
      classId: resolvedClassId,
      students,
      enrollments,
    });

    const payload = {
      classId: resolvedClassId,
      plannedDate: date,
      plannedTime: time,
      actualDate: nowCompleted ? (session?.actualDate ?? date) : (session?.actualDate ?? null),
      actualTime: nowCompleted ? (session?.actualTime ?? time) : (session?.actualTime ?? null),
      durationMinutes: finalDuration,
      rateMode,
      rateValue: finalRateValue,
      totalCharge: nowCompleted ? charge : (session?.totalCharge ?? null),
      status,
      movedFromDate,
      movedFromTime,
      notes: notes.trim(),
    };

    try {
      if (session) {
        await onUpdate(session.id, payload);
      } else {
        await onSave(payload);
      }

      if (!isDraft && nowCompleted && !wasCompleted) {
        await decrementPrepaidBalance(resolvedClassId, charge, enrollments);
      }

      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save session');
    }
  };

  const handleDelete = () => {
    if (!session) return;
    if (confirm('Are you sure you want to delete this session?')) {
      onDelete(session.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {isDraft ? (isEditing ? 'Edit Draft Session' : 'New Draft Session') : isEditing ? 'Edit Session' : 'New Session'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-500">
            Timezone: {defaultTimezone}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{classes.length > 0 ? 'Select a class (optional)' : 'No classes'}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {!session && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Or select a student</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{students.length > 0 ? 'Select a student (optional)' : 'No students'}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedClass && classStudentNames && (
            <div className="text-xs text-slate-500">
              Students in class: {classStudentNames}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DURATION_OPTIONS.map((mins) => (
                <button key={mins} type="button" onClick={() => { setDurationMode('preset'); setDuration(mins); }} className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${durationMode === 'preset' && duration === mins ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{mins}m</button>
              ))}
              <button type="button" onClick={() => setDurationMode('custom')} className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${durationMode === 'custom' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>Custom</button>
            </div>
            {durationMode === 'custom' && (
              <input type="number" min={15} step={5} value={customDuration} onChange={(e) => setCustomDuration(Math.max(15, parseInt(e.target.value) || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Session['status'])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="moved">Moved</option>
              <option value="cancelled">Cancelled</option>
              <option value="holiday">Holiday</option>
              <option value="no-show">No-show</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rate Mode</label>
            <select value={rateMode} onChange={(e) => setRateMode(e.target.value as Session['rateMode'])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="auto">Auto (student default)</option>
              <option value="override">Override</option>
              <option value="flat">Flat</option>
            </select>
          </div>

          {rateMode !== 'auto' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate Value</label>
              <input type="number" step="0.01" min="0" value={rateValue} onChange={(e) => setRateValue(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">{isDraft ? 'Save Draft' : isEditing ? 'Save Changes' : 'Save Session'}</button>
            {isEditing && <button type="button" onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Delete</button>}
            <button type="button" onClick={onClose} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}