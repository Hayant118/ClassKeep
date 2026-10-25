import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CalendarEvent } from '../types';
import { Button } from './Button';

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayKey(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type EventPayload = Omit<CalendarEvent, 'id' | 'userId' | 'createdAt'>;

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventPayload) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  editingEvent?: CalendarEvent | null;
}

const TYPE_OPTIONS: { value: CalendarEvent['type']; label: string }[] = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'travel', label: 'Travel' },
  { value: 'event', label: 'Event' },
];

const COLOR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const COLOR_SWATCH_CLASSES: Record<string, string> = {
  '#ef4444': 'bg-red-500',
  '#f97316': 'bg-orange-500',
  '#f59e0b': 'bg-amber-500',
  '#10b981': 'bg-emerald-500',
  '#3b82f6': 'bg-blue-500',
  '#8b5cf6': 'bg-violet-500',
  '#ec4899': 'bg-pink-500',
};

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  editingEvent,
}: EventModalProps) {
  const isEditing = !!editingEvent;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('event');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [color, setColor] = useState('#3b82f6');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingEvent) {
      setTitle(editingEvent.title);
      setType(editingEvent.type);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate);
      setColor(editingEvent.color ?? '#3b82f6');
      setNotes(editingEvent.notes ?? '');
    } else {
      setTitle('');
      setType('event');
      setStartDate(todayKey());
      setEndDate(todayKey());
      setColor('#3b82f6');
      setNotes('');
    }
  }, [isOpen, editingEvent]);

  const handleTypeChange = (value: CalendarEvent['type']) => {
    setType(value);
    // Keep the range end in sync when it is still a single-day event.
    if (value !== type && endDate === startDate) {
      setEndDate(startDate);
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      toast.error('Please enter valid dates');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    const payload: EventPayload = {
      title: title.trim(),
      type,
      color: type === 'event' ? color : null,
      notes: notes.trim() || null,
      startDate,
      endDate,
    };

    try {
      if (editingEvent) {
        await onUpdate(editingEvent.id, payload);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event');
    }
  };

  const handleDelete = () => {
    if (!editingEvent) return;
    if (confirm('Delete this event?')) {
      onDelete(editingEvent.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Day holiday"
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as CalendarEvent['type'])}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
          </div>

          {type === 'event' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${COLOR_SWATCH_CLASSES[c] ?? ''} ${color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1">{isEditing ? 'Save Changes' : 'Add Event'}</Button>
            {isEditing && <Button type="button" variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>}
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
